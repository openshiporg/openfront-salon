import { ClipboardCheck, FileSignature, Plus } from 'lucide-react';
import { createTemplate, getConsultations, publishVersion, reviewSubmission, setTemplateActive, type ConsultationTemplate, type Submission } from '../actions/consultations';
import { QuestionsEditor } from './QuestionsEditor';
import { ActionForm } from '../../components/ActionForm';
import { EmptyState, ErrorState, fieldLabelClass, inputClass, labelize, Notice, PageHeader, Panel, pillClass, PillLink, PlatformPage, SegmentTabs, StatusCell, TitleStatus, textareaClass, type Tone } from '../../components/salon-ui';

function plural(count: number, word: string) { return `${count} ${word}${count === 1 ? '' : 's'}`; }
import { getSalonTimezone } from '../../lib/salonTimezone';

const tabs = [
  { value: 'submitted', label: 'To review' },
  { value: 'needs_clarification', label: 'Needs clarification' },
  { value: 'accepted_for_service', label: 'Accepted' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'all', label: 'All' },
] as const;
const reviewTone: Record<string, Tone> = { submitted: 'amber', needs_clarification: 'orange', accepted_for_service: 'emerald', reviewed: 'blue', deferred: 'zinc' };
const reviewLabel: Record<string, string> = { submitted: 'To review', needs_clarification: 'Needs clarification', accepted_for_service: 'Accepted for service', reviewed: 'Reviewed', deferred: 'Deferred' };

export async function ConsultationsPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const status = tabs.some((tab) => tab.value === params.status) ? params.status! : 'submitted';
  const [data, timeZone] = await Promise.all([getConsultations(status), getSalonTimezone()]);
  if (!data) return <PlatformPage breadcrumbs={[{ type: 'page', label: 'Consultations' }]}><ErrorState id="consultations-error" title="Consultations couldn't be loaded" message="Consultation records need care-record access." action={null} /></PlatformPage>;
  const toReview = data.counts.submitted || 0;
  const current = (template: ConsultationTemplate) => template.versions.find((version) => !version.supersededBy);
  const liveForms = data.templates.filter((template) => template.isActive && current(template)).length;
  const consentForms = data.templates.filter((template) => template.type === 'consent' && template.isActive);
  const consentLive = consentForms.some((template) => current(template));
  const consentWithoutVersion = consentForms.filter((template) => !current(template));

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Consultations' }]}>
      <PageHeader title="Consultations" status={toReview ? <TitleStatus tone="amber">{toReview} to review</TitleStatus> : null} meta={<span>{plural(liveForms, 'live form')}</span>} />
      {!consentLive ? (
        <Notice tone="rose" title="No published consent version">
          {consentWithoutVersion.length ? <>Publish a version of {consentWithoutVersion.map((template) => template.name).join(', ')}. </> : null}<a href="#forms" className="underline underline-offset-4 hover:text-foreground">Forms</a>
        </Notice>
      ) : null}

      <SegmentTabs label="Review status" active={status} tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label, href: tab.value === 'submitted' ? '/dashboard/platform/consultations' : `/dashboard/platform/consultations?status=${tab.value}`, count: data.counts[tab.value] || 0 }))} />
      {data.submissions.length === 0 ? <EmptyState icon={ClipboardCheck} title={status === 'submitted' ? 'No forms waiting for review' : 'No consultations in this view'} /> : (
        <div className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
          <div aria-hidden="true" className="hidden h-9 grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_9rem_9rem_5rem] items-center gap-3 border-b bg-muted/40 px-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Client</span><span>Form · appointment</span><span>Signed</span><span>Status</span><span />
          </div>
          <ul className="divide-y">{data.submissions.map((submission) => <SubmissionRow key={submission.id} submission={submission} timeZone={timeZone} />)}</ul>
        </div>
      )}

      <Panel id="forms" title="Forms" icon={FileSignature} padded={false}>
        {data.templates.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No consultation forms yet.</p> : (
          <ul className="divide-y">{data.templates.map((template) => <TemplateRow key={template.id} template={template} timeZone={timeZone} />)}</ul>
        )}
        <details className="border-t px-4 py-3">
          <summary className={`${pillClass('raised', 'sm')} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}><Plus />New form</summary>
          <div className="mt-3">
            <ActionForm action={createTemplate} submitLabel="Create form" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={fieldLabelClass}>Name<input name="name" required maxLength={200} className={inputClass} /></label>
                <label className={fieldLabelClass}>Type<select name="type" className={inputClass}>{['consent', 'intake', 'medical', 'waiver'].map((type) => <option key={type} value={type}>{labelize(type)}</option>)}</select></label>
              </div>
              <label className={fieldLabelClass}>Description<input name="description" maxLength={1000} className={inputClass} /></label>
            </ActionForm>
          </div>
        </details>
      </Panel>
    </PlatformPage>
  );
}

function SubmissionRow({ submission, timeZone }: { submission: Submission; timeZone?: string }) {
  const zone = submission.appointment?.location?.timezone || timeZone;
  const when = (value?: string | null) => value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone }) : '—';
  const questions = submission.templateVersion?.questions || [];
  const answers = submission.answers || {};
  return (
    <li className="min-w-0">
      <details className="group">
        <summary className="grid cursor-pointer list-none gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm hover:bg-muted/30 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_9rem_9rem_5rem] md:items-center [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 truncate font-medium">{submission.client?.name || submission.signerName}</span>
          <span className="min-w-0 truncate text-muted-foreground">{submission.templateVersion?.titleSnapshot} v{submission.templateVersion?.version}{submission.appointment ? ` · ${submission.appointment.services.map((service) => service.name).filter(Boolean).join(', ')} ${when(submission.appointment.startTime)}` : ''}</span>
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground md:text-sm">{when(submission.submittedAt)}</span>
          <span><StatusCell tone={reviewTone[submission.reviewStatus] || 'zinc'}>{reviewLabel[submission.reviewStatus] || labelize(submission.reviewStatus)}</StatusCell></span>
          <span className="text-xs font-medium text-muted-foreground md:text-right"><span className="group-open:hidden">Review</span><span className="hidden group-open:inline">Close</span></span>
        </summary>
        <div className="grid gap-5 border-t bg-muted/10 px-3 py-4 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <dl className="grid gap-3">
              {questions.map((question) => <div key={question.id} className="min-w-0"><dt className="text-xs text-muted-foreground">{question.label}</dt><dd className="mt-0.5 whitespace-pre-line text-sm">{String(answers[question.id] ?? '') || '—'}</dd></div>)}
              <div><dt className="text-xs text-muted-foreground">Signed by</dt><dd className="mt-0.5 text-sm">{submission.signerName} · {labelize(submission.signerRole)}{submission.guardianAuthority ? ` · ${submission.guardianAuthority}` : ''}</dd></div>
            </dl>
            {submission.reviews.length ? (
              <ul className="mt-4 grid gap-1 border-t pt-3 text-xs text-muted-foreground">
                {submission.reviews.map((review) => <li key={review.id}>{reviewLabel[review.status] || labelize(review.status)} · {when(review.occurredAt)}{review.actor?.name ? ` · ${review.actor.name}` : ''} · {review.reason}</li>)}
              </ul>
            ) : null}
            {submission.appointment ? <div className="mt-4"><PillLink href={`/dashboard/platform/appointments/${submission.appointment.id}`} size="sm" variant="raised">Open appointment</PillLink></div> : null}
          </div>
          <ActionForm action={reviewSubmission} submitLabel="Record decision" resetOnSuccess>
            <input type="hidden" name="submissionId" value={submission.id} />
            <label className={fieldLabelClass}>Decision<select name="status" defaultValue="accepted_for_service" className={inputClass}><option value="accepted_for_service">Accept for service</option><option value="needs_clarification">Needs clarification</option><option value="deferred">Defer</option><option value="reviewed">Reviewed, no decision</option></select></label>
            <label className={fieldLabelClass}>Note<textarea name="reason" required maxLength={1000} className={`${textareaClass} min-h-16`} /></label>
          </ActionForm>
        </div>
      </details>
    </li>
  );
}

function TemplateRow({ template, timeZone }: { template: ConsultationTemplate; timeZone?: string }) {
  const current = template.versions.find((version) => !version.supersededBy);
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }) : '—';
  const nextVersion = current ? String((Number.parseInt(current.version, 10) || template.versions.length) + 1) : '1';
  return (
    <li className="px-4 py-3">
      <details>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium">{template.name}</span><TitleStatus tone={!template.isActive ? 'zinc' : current ? 'emerald' : 'amber'}>{!template.isActive ? 'Withdrawn' : current ? `Live · v${current.version}` : 'No version published'}</TitleStatus></span>
          <span className="block text-xs text-muted-foreground">{labelize(template.type)}{template.requiredForCategories.length ? ` · required for ${template.requiredForCategories.map((category) => category.name).join(', ')}` : ''}{current ? ` · since ${date(current.effectiveFrom)} · ${(current.questions || []).length} questions` : ''}</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <ActionForm action={publishVersion} submitLabel={current ? `Publish v${nextVersion}` : 'Publish v1'} pendingLabel="Publishing…">
            <input type="hidden" name="templateId" value={template.id} />
            {current ? <input type="hidden" name="supersedesId" value={current.id} /> : null}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
              <label className={fieldLabelClass}>Title<input name="title" required maxLength={200} defaultValue={current?.titleSnapshot || template.name} className={inputClass} /></label>
              <label className={fieldLabelClass}>Version<input name="version" required maxLength={20} defaultValue={nextVersion} className={inputClass} /></label>
            </div>
            <label className={fieldLabelClass}>Purpose<textarea name="purpose" required maxLength={2000} defaultValue={current?.purposeSnapshot || template.description || ''} className={`${textareaClass} min-h-16`} /></label>
            <QuestionsEditor initial={(current?.questions || []).map((question) => ({ id: question.id, label: question.label, required: Boolean(question.required) }))} />
          </ActionForm>
          <ActionForm action={setTemplateActive} submitLabel={template.isActive ? 'Withdraw form' : 'Make available'} variant={template.isActive ? 'danger' : 'raised'} confirm={template.isActive ? 'Confirm withdraw' : undefined}>
            <input type="hidden" name="id" value={template.id} /><input type="hidden" name="isActive" value={template.isActive ? 'false' : 'true'} />
          </ActionForm>
        </div>
      </details>
    </li>
  );
}

export default ConsultationsPage;
