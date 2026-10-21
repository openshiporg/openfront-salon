import { createHash } from "node:crypto";
import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { consultationAnswerError } from "../consultationAnswers";
import { serializableWorkflow } from "./serializableWorkflow";

type Result = { success: boolean; recordId: string | null; evidenceHash: string | null; error: string | null };
const denied = { success: false, recordId: null, evidenceHash: null };
function domain(context: Context) { return context.sudo().query as any; }
function validKey(value: string) { return value.trim().length >= 12 && value.length <= 200; }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }

export async function publishConsultationTemplateVersionTransaction(context: Context, args: {
  templateId: string; version: string; title: string; purpose: string; questions: unknown; effectiveFrom: string; effectiveUntil?: string | null; supersedesId?: string | null; idempotencyKey: string;
}): Promise<Result> {
  if (!permissions.canManageCareRecords({ session: context.session as any })) return { ...denied, error: "Restricted care-record authority is required" };
  if (!validKey(args.idempotencyKey)) return { ...denied, error: "Template idempotency key is invalid" };
  const effectiveFrom = new Date(args.effectiveFrom); const effectiveUntil = args.effectiveUntil ? new Date(args.effectiveUntil) : null;
  if (!args.version.trim() || !args.title.trim() || !args.purpose.trim() || !Array.isArray(args.questions) || args.questions.length === 0 || args.questions.length > 200
    || Number.isNaN(effectiveFrom.getTime()) || (effectiveUntil && (Number.isNaN(effectiveUntil.getTime()) || effectiveUntil <= effectiveFrom))) return { ...denied, error: "Template version input is invalid" };
  const ids = new Set<string>();
  for (const question of args.questions as any[]) {
    const id = String(question?.id || ""); if (!id || ids.has(id) || !String(question?.label || "")) return { ...denied, error: "Every consultation question requires a unique ID and label" }; ids.add(id);
  }
  const questionsHash = hash(args.questions);
  const documentHash = hash({ templateId: args.templateId, version: args.version, title: args.title.trim(), purpose: args.purpose.trim(), questionsHash, effectiveFrom: effectiveFrom.toISOString(), effectiveUntil: effectiveUntil?.toISOString() || null });
  try {
    return await serializableWorkflow(context, "salon-consultation-template", [`template:${args.templateId}`, `idempotency:${args.idempotencyKey}`], async tx => {
      const query = domain(tx); const existing = (await query.ConsultationTemplateVersion.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id documentHash template { id }" }))[0];
      if (existing) {
        if (existing.template?.id !== args.templateId || existing.documentHash !== documentHash) throw new Error("Template idempotency key was reused for different evidence");
        return { success: true, recordId: existing.id, evidenceHash: existing.documentHash, error: null };
      }
      const template = await tx.sudo().query.FormTemplate.findOne({ where: { id: args.templateId }, query: "id" }); if (!template) throw new Error("Form template not found");
      if (args.supersedesId) {
        const prior = await query.ConsultationTemplateVersion.findOne({ where: { id: args.supersedesId }, query: "id template { id } supersededBy { id }" });
        if (!prior || prior.template?.id !== args.templateId || prior.supersededBy?.id) throw new Error("Template supersession is invalid");
      }
      const record = await query.ConsultationTemplateVersion.createOne({ data: { template: { connect: { id: args.templateId } }, version: args.version.trim(), titleSnapshot: args.title.trim(), purposeSnapshot: args.purpose.trim(),
        questions: args.questions, questionsHash, documentHash, idempotencyKey: args.idempotencyKey, effectiveFrom: effectiveFrom.toISOString(), effectiveUntil: effectiveUntil?.toISOString(), supersedes: args.supersedesId ? { connect: { id: args.supersedesId } } : undefined }, query: "id documentHash" });
      return { success: true, recordId: record.id, evidenceHash: record.documentHash, error: null };
    });
  } catch (error) { return { ...denied, error: error instanceof Error ? error.message : "Template publication failed" }; }
}

export async function submitConsultationTransaction(context: Context, args: {
  templateVersionId: string; appointmentId?: string | null; answers: unknown; signerName: string; signerRole: "self" | "parent" | "guardian" | "representative";
  guardianAuthority?: string | null; signatureEvidence: string; supersedesId?: string | null; idempotencyKey: string;
}): Promise<Result> {
  if (!context.session?.itemId) return { ...denied, error: "A verified client or authorized care session is required" };
  if (!validKey(args.idempotencyKey)) return { ...denied, error: "Submission idempotency key is invalid" };
  const serialized = canonical(args.answers);
  if (!args.signerName.trim() || args.signerName.length > 200 || !args.signatureEvidence.trim() || args.signatureEvidence.length > 5000 || serialized.length > 100_000
    || !new Set(["self", "parent", "guardian", "representative"]).has(args.signerRole)
    || (args.signerRole !== "self" && !args.guardianAuthority?.trim())) return { ...denied, error: "Signer, authority, signature, or answers are invalid" };
  try {
    return await serializableWorkflow(context, "salon-consultation-submission", [`client:${context.session.itemId}`, `idempotency:${args.idempotencyKey}`], async tx => {
      const query = domain(tx); const existing = (await query.ConsultationSubmission.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id evidenceHash answersHash signerName signerRole guardianAuthority signatureEvidence client { id } appointment { id } templateVersion { id }" }))[0];
      if (existing) {
        if (existing.client?.id !== context.session!.itemId && !permissions.canManageCareRecords({ session: context.session as any })) throw new Error("Submission idempotency ownership mismatch");
        if (existing.templateVersion?.id !== args.templateVersionId || (existing.appointment?.id || null) !== (args.appointmentId || null)
          || existing.answersHash !== hash(args.answers) || existing.signerName !== args.signerName.trim() || existing.signerRole !== args.signerRole
          || (existing.guardianAuthority || "") !== (args.guardianAuthority?.trim() || "") || existing.signatureEvidence !== args.signatureEvidence) throw new Error("Submission idempotency key was reused for different evidence");
        return { success: true, recordId: existing.id, evidenceHash: existing.evidenceHash, error: null };
      }
      const version = await query.ConsultationTemplateVersion.findOne({ where: { id: args.templateVersionId }, query: "id version titleSnapshot purposeSnapshot questions questionsHash documentHash effectiveFrom effectiveUntil" });
      if (!version) throw new Error("Consultation template version not found");
      const now = new Date(); if (new Date(version.effectiveFrom) > now || (version.effectiveUntil && new Date(version.effectiveUntil) <= now)) throw new Error("Consultation template version is not currently effective");
      const actorIsCare = permissions.canManageCareRecords({ session: context.session as any });
      let clientId = context.session!.itemId;
      if (args.appointmentId) {
        const appointment = await tx.sudo().query.Appointment.findOne({ where: { id: args.appointmentId }, query: "id client { user { id } }" });
        if (!appointment) throw new Error("Appointment not found");
        if (appointment.client?.user?.id !== context.session!.itemId && !actorIsCare) throw new Error("You cannot submit a consultation for this appointment");
        clientId = appointment.client?.user?.id || context.session!.itemId;
      }
      if (args.supersedesId) {
        const prior = await query.ConsultationSubmission.findOne({ where: { id: args.supersedesId }, query: "id client { id } templateVersion { id } supersededBy { id }" });
        if (!prior || prior.client?.id !== clientId || prior.templateVersion?.id !== version.id || prior.supersededBy?.id) throw new Error("Consultation supersession is invalid");
      }
      const answerError = consultationAnswerError(version.questions, args.answers);
      if (answerError) throw new Error(answerError);
      const answerMap = args.answers as Record<string, string>;
      const answersHash = hash(answerMap); const submittedAt = now.toISOString();
      const evidenceHash = hash({ documentHash: version.documentHash, questionsHash: version.questionsHash, answersHash, signerName: args.signerName.trim(), signerRole: args.signerRole, guardianAuthority: args.guardianAuthority?.trim() || null, signatureEvidenceHash: hash(args.signatureEvidence), clientId, appointmentId: args.appointmentId || null, submittedAt });
      const record = await query.ConsultationSubmission.createOne({ data: { client: { connect: { id: clientId } }, appointment: args.appointmentId ? { connect: { id: args.appointmentId } } : undefined,
        templateVersion: { connect: { id: version.id } }, answers: answerMap, questionsHash: version.questionsHash, answersHash, evidenceHash,
        signerName: args.signerName.trim(), signerRole: args.signerRole, guardianAuthority: args.guardianAuthority?.trim() || "", signatureEvidence: args.signatureEvidence,
        actor: { connect: { id: context.session!.itemId } }, actorAuthority: actorIsCare ? "care_record_operator" : args.signerRole === "self" ? "authenticated_client_owner" : "authenticated_guardian_or_representative",
        submittedAt, effectiveFrom: submittedAt, supersedes: args.supersedesId ? { connect: { id: args.supersedesId } } : undefined,
        idempotencyKey: args.idempotencyKey, reviewStatus: "submitted" }, query: "id evidenceHash" });
      return { success: true, recordId: record.id, evidenceHash: record.evidenceHash, error: null };
    });
  } catch (error) { return { ...denied, error: error instanceof Error ? error.message : "Consultation submission failed" }; }
}

export async function reviewConsultationTransaction(context: Context, args: { submissionId: string; status: string; reason: string; idempotencyKey: string }): Promise<Result> {
  if (!permissions.canManageCareRecords({ session: context.session as any })) return { ...denied, error: "Restricted care-record authority is required" };
  if (!validKey(args.idempotencyKey) || !new Set(["reviewed", "needs_clarification", "accepted_for_service", "deferred"]).has(args.status) || !args.reason.trim()) return { ...denied, error: "Review input is invalid" };
  try {
    return await serializableWorkflow(context, "salon-consultation-review", [`submission:${args.submissionId}`, `idempotency:${args.idempotencyKey}`], async tx => {
      const query = domain(tx); const existing = (await query.ConsultationReview.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id status reason evidence submission { id }" }))[0];
      if (existing) {
        if (existing.submission?.id !== args.submissionId || existing.status !== args.status || existing.reason !== args.reason.trim()) throw new Error("Review idempotency key was reused for another decision");
        // Repair the denormalized projection on exact replay without appending another review.
        await query.ConsultationSubmission.updateOne({ where: { id: args.submissionId }, data: { reviewStatus: existing.status }, query: "id" });
        return { success: true, recordId: existing.id, evidenceHash: hash(existing.evidence), error: null };
      }
      const submission = await query.ConsultationSubmission.findOne({ where: { id: args.submissionId }, query: "id evidenceHash" }); if (!submission) throw new Error("Consultation submission not found");
      const occurredAt = new Date().toISOString(); const evidence = { submissionEvidenceHash: submission.evidenceHash, status: args.status, reason: args.reason.trim(), actorId: context.session!.itemId, occurredAt };
      const review = await query.ConsultationReview.createOne({ data: { submission: { connect: { id: submission.id } }, status: args.status, reason: args.reason.trim(), actor: { connect: { id: context.session!.itemId } }, actorAuthority: "care_record_reviewer", occurredAt, idempotencyKey: args.idempotencyKey, evidence }, query: "id" });
      // Keep the desk-facing projection atomic with the immutable review event.
      await query.ConsultationSubmission.updateOne({ where: { id: submission.id }, data: { reviewStatus: args.status }, query: "id" });
      return { success: true, recordId: review.id, evidenceHash: hash(evidence), error: null };
    });
  } catch (error) { return { ...denied, error: error instanceof Error ? error.message : "Consultation review failed" }; }
}

const resultType = graphql.object<Result>()({ name: "ConsultationWorkflowResult", fields: { success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), recordId: graphql.field({ type: graphql.ID }), evidenceHash: graphql.field({ type: graphql.String }), error: graphql.field({ type: graphql.String }) } });
export const publishConsultationTemplateVersion = graphql.field({ type: resultType, args: { templateId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), version: graphql.arg({ type: graphql.nonNull(graphql.String) }), title: graphql.arg({ type: graphql.nonNull(graphql.String) }), purpose: graphql.arg({ type: graphql.nonNull(graphql.String) }), questions: graphql.arg({ type: graphql.nonNull(graphql.JSON) }), effectiveFrom: graphql.arg({ type: graphql.nonNull(graphql.String) }), effectiveUntil: graphql.arg({ type: graphql.String }), supersedesId: graphql.arg({ type: graphql.ID }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) }, resolve(_source, args, context: Context) { return publishConsultationTemplateVersionTransaction(context, args); } });
export const submitConsultation = graphql.field({ type: resultType, args: { templateVersionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), appointmentId: graphql.arg({ type: graphql.ID }), answers: graphql.arg({ type: graphql.nonNull(graphql.JSON) }), signerName: graphql.arg({ type: graphql.nonNull(graphql.String) }), signerRole: graphql.arg({ type: graphql.nonNull(graphql.String) }), guardianAuthority: graphql.arg({ type: graphql.String }), signatureEvidence: graphql.arg({ type: graphql.nonNull(graphql.String) }), supersedesId: graphql.arg({ type: graphql.ID }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) }, resolve(_source, args, context: Context) { return submitConsultationTransaction(context, args as any); } });
export const reviewConsultation = graphql.field({ type: resultType, args: { submissionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), status: graphql.arg({ type: graphql.nonNull(graphql.String) }), reason: graphql.arg({ type: graphql.nonNull(graphql.String) }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) }, resolve(_source, args, context: Context) { return reviewConsultationTransaction(context, args); } });
