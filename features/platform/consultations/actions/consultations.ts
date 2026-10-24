'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { fail, ok, operationKey, workflowState, type FormState } from '@/features/platform/lib/formState';

export type Question = { id: string; label: string; type?: string; required?: boolean };
export interface TemplateVersion { id: string; version: string; titleSnapshot: string; purposeSnapshot?: string | null; questions?: Question[] | null; effectiveFrom: string; effectiveUntil?: string | null; supersededBy?: { id: string } | null }
export interface ConsultationTemplate { id: string; name: string; type?: string | null; description?: string | null; isActive?: boolean | null; requiredForCategories: { name?: string | null }[]; versions: TemplateVersion[] }
export interface Submission {
  id: string; reviewStatus: string; submittedAt: string; signerName: string; signerRole: string; guardianAuthority?: string | null; answers?: Record<string, unknown> | null;
  client?: { id: string; name?: string | null; email?: string | null } | null;
  appointment?: { id: string; startTime?: string | null; services: { name?: string | null }[]; location?: { timezone?: string | null } | null } | null;
  templateVersion?: { version: string; titleSnapshot: string; questions?: Question[] | null } | null;
  reviews: { id: string; status: string; reason: string; occurredAt: string; actor?: { name?: string | null } | null }[];
}

const STATUSES = ['submitted', 'needs_clarification', 'accepted_for_service', 'reviewed', 'deferred'];

export async function getConsultations(status: string) {
  const where = status === 'all' ? {} : { reviewStatus: { equals: STATUSES.includes(status) ? status : 'submitted' } };
  const response = await keystoneClient<{ formTemplates: ConsultationTemplate[]; consultationSubmissions: Submission[]; counts: { reviewStatus: string }[] }>(`
    query Consultations($where: ConsultationSubmissionWhereInput!) {
      formTemplates(orderBy: { name: asc }, take: 100) {
        id name type description isActive requiredForCategories { name }
        versions(orderBy: { effectiveFrom: desc }) { id version titleSnapshot purposeSnapshot questions effectiveFrom effectiveUntil supersededBy { id } }
      }
      consultationSubmissions(where: $where, orderBy: { submittedAt: desc }, take: 100) {
        id reviewStatus submittedAt signerName signerRole guardianAuthority answers
        client { id name email }
        appointment { id startTime services { name } location { timezone } }
        templateVersion { version titleSnapshot questions }
        reviews(orderBy: { occurredAt: desc }) { id status reason occurredAt actor { name } }
      }
      counts: consultationSubmissions(take: 5000) { reviewStatus }
    }
  `, { where });
  if (!response.success) return null;
  const counts: Record<string, number> = { all: response.data.counts.length };
  for (const row of response.data.counts) counts[row.reviewStatus] = (counts[row.reviewStatus] || 0) + 1;
  return { templates: response.data.formTemplates || [], submissions: response.data.consultationSubmissions || [], counts };
}

function refresh() {
  revalidatePath('/dashboard/platform/consultations');
  revalidatePath('/account');
}

export async function createTemplate(_previous: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') || '').trim();
  const type = String(formData.get('type') || 'consent');
  if (!name) return fail('Enter a name.');
  const response = await keystoneClient(`mutation CreateFormTemplate($data: FormTemplateCreateInput!) { createFormTemplate(data: $data) { id } }`, {
    data: { name, type, description: String(formData.get('description') || '').trim(), isActive: true },
  });
  if (!response.success) return fail('The form could not be created. Check your care-record access.');
  refresh();
  return ok('Form created. Publish its first version below.');
}

export async function setTemplateActive(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  const isActive = formData.get('isActive') === 'true';
  const response = await keystoneClient(`mutation SetFormTemplateActive($id: ID!, $isActive: Boolean!) { updateFormTemplate(where: { id: $id }, data: { isActive: $isActive }) { id } }`, { id, isActive });
  if (!response.success) return fail('The form could not be updated.');
  refresh();
  return ok(isActive ? 'Clients can sign this form.' : 'Form withdrawn from the account page.');
}

/** Publishes a new, hashed version; the current version is superseded, never edited. */
export async function publishVersion(_previous: FormState, formData: FormData): Promise<FormState> {
  const templateId = String(formData.get('templateId') || '');
  const title = String(formData.get('title') || '').trim();
  const purpose = String(formData.get('purpose') || '').trim();
  const version = String(formData.get('version') || '').trim();
  let questions: Question[] = [];
  try { questions = JSON.parse(String(formData.get('questions') || '[]')); } catch { return fail('Questions could not be read.'); }
  questions = questions.filter((question) => question.label?.trim()).map((question, index) => ({
    id: question.id || `q${index + 1}-${question.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`,
    label: question.label.trim().slice(0, 500), type: question.type || 'text', required: Boolean(question.required),
  }));
  if (!templateId) return fail('Form not found.');
  if (!title || !purpose || !version) return fail('Enter a title, purpose and version.');
  if (!questions.length) return fail('Add at least one question.');
  const response = await keystoneClient<{ publishConsultationTemplateVersion: { success: boolean; error?: string | null } }>(`
    mutation PublishVersion($templateId: ID!, $version: String!, $title: String!, $purpose: String!, $questions: JSON!, $effectiveFrom: String!, $supersedesId: ID, $idempotencyKey: String!) {
      publishConsultationTemplateVersion(templateId: $templateId, version: $version, title: $title, purpose: $purpose, questions: $questions, effectiveFrom: $effectiveFrom, supersedesId: $supersedesId, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { templateId, version, title, purpose, questions, effectiveFrom: new Date().toISOString(), supersedesId: String(formData.get('supersedesId') || '') || null, idempotencyKey: operationKey('consultation-version') });
  const state = workflowState(response, 'publishConsultationTemplateVersion', 'Version published.', 'The version could not be published.');
  if (state.status === 'success') refresh();
  return state;
}

export async function reviewSubmission(_previous: FormState, formData: FormData): Promise<FormState> {
  const submissionId = String(formData.get('submissionId') || '');
  const status = String(formData.get('status') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!reason) return fail('Enter a note for the decision.');
  const response = await keystoneClient<{ reviewConsultation: { success: boolean; error?: string | null } }>(`
    mutation ReviewConsultation($submissionId: ID!, $status: String!, $reason: String!, $idempotencyKey: String!) {
      reviewConsultation(submissionId: $submissionId, status: $status, reason: $reason, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { submissionId, status, reason, idempotencyKey: operationKey('consultation-review') });
  const state = workflowState(response, 'reviewConsultation', 'Decision recorded.', 'The decision could not be recorded. Check your care-record access.');
  if (state.status === 'success') refresh();
  return state;
}
