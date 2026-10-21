import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";

/** One purpose-built, owner-scoped projection; never returns staff notes or compensation. */
export const clientPortal = graphql.field({
  type: graphql.JSON,
  async resolve(_source, _args, context: Context) {
    const userId = context.session?.itemId;
    if (!userId || context.session?.listKey !== 'User') return { authenticated: false, client: null, appointments: [], availableForms: [] };

    // Session-aware list APIs enforce owner filters. Sudo is used only for the
    // public form-version catalog after client authority is established.
    const appointments = await context.query.Appointment.findMany({
      where: { client: { user: { id: { equals: userId } } } }, orderBy: { startTime: "desc" }, take: 100,
      query: `id startTime endTime duration status bookedAt confirmedAt cancelledAt cancellationReason clientNotes clientPolicy
        stylist { id user { name } } location { name timezone }
        lineItems { id serviceTitle serviceImagePath duration price quantity }
        scheduleRevisions(orderBy: { revision: desc }, take: 10) { id revision priorStart priorEnd nextStart nextEnd scheduleHash createdAt }
        segments(where: { status: { notIn: [superseded] } }, orderBy: { plannedStart: asc }) { id stableKey sequence parallelGroup type plannedStart plannedEnd durationMinutes practitionerRequired resourceUnits status lineItem { id } definition { id } practitioner { id user { name } } resource { id name } }
        consultationSubmissions(orderBy: { submittedAt: desc }) { id evidenceHash submittedAt effectiveFrom effectiveUntil signerName signerRole templateVersion { id version titleSnapshot questionsHash documentHash } reviews(orderBy: { occurredAt: desc }) { status reason occurredAt } }
        transaction { id completedAt paymentStatus status tip metadata lineItems { id itemType quantity unitPrice discount metadata } reversals(orderBy: { postedAt: desc }) { id type status subtotalDelta taxDelta tipDelta paymentDelta postedAt lines { sourceLine { id } quantity subtotalDelta taxDelta inventoryDisposition } } }
        payment { id subtotal tax tip discount totalAmount refundedAmount paymentMethod status processedAt refundedAt }
      `,
    });
    const clients = await context.query.Client.findMany({ where: { user: { id: { equals: userId } } }, take: 1, query: "id totalVisits lifetimeValue user { name email }" });
    if (!clients[0]) return { authenticated: false, client: null, appointments: [], availableForms: [] };
    // Ownership was proven by the normal Appointment query above. Read only
    // display names for those exact linked practitioners; User privacy stays locked.
    const practitionerIds = [...new Set(appointments.flatMap((appointment: any) => [appointment.stylist?.id, ...(appointment.segments || []).map((segment: any) => segment.practitioner?.id)]).filter(Boolean))] as string[];
    const practitioners = practitionerIds.length ? await context.sudo().query.Stylist.findMany({ where: { id: { in: practitionerIds } }, take: 200, query: "id user { name }" }) : [];
    const names = new Map(practitioners.map(item => [item.id, item.user?.name || null]));
    const activeTemplates = await context.sudo().query.FormTemplate.findMany({ where: { isActive: { equals: true } }, take: 50, query: "id name type description" });
    const domain = context.sudo().query as any;
    const now = new Date().toISOString();
    const versions = await domain.ConsultationTemplateVersion.findMany({
      where: { effectiveFrom: { lte: now }, OR: [{ effectiveUntil: { equals: null } }, { effectiveUntil: { gt: now } }] }, take: 100,
      query: "id version titleSnapshot purposeSnapshot questions questionsHash documentHash effectiveFrom effectiveUntil template { id } supersededBy { id }",
    });
    const availableForms = versions.filter((version: any) => !version.supersededBy?.id && activeTemplates.some(template => template.id === version.template?.id));
    return {
      authenticated: true,
      client: clients[0] || null,
      appointments: appointments.map((appointment: any) => ({
        ...appointment,
        stylist: appointment.stylist ? { user: { name: names.get(appointment.stylist.id) || null } } : null,
        segments: (appointment.segments || []).map((segment: any) => ({ ...segment, practitioner: segment.practitioner ? { id: segment.practitioner.id, user: { name: names.get(segment.practitioner.id) || null } } : null })),
        // Only policy snapshot and transition evidence are client-safe.
        metadata: {
          clientPolicySnapshot: appointment.clientPolicy || null,
          transitionHistory: Array.isArray(appointment.metadata?.transitionHistory)
            ? appointment.metadata.transitionHistory.map((event: any) => ({ from: event.from, to: event.to, reason: event.reason, at: event.at }))
            : [],
        },
        transaction: appointment.transaction ? {
          ...appointment.transaction,
          metadata: {
            serviceSubtotal: appointment.transaction.metadata?.serviceSubtotal || 0,
            retailSubtotal: appointment.transaction.metadata?.retailSubtotal || 0,
            discount: appointment.transaction.metadata?.discount || 0,
            tax: appointment.transaction.metadata?.tax || 0,
            total: appointment.transaction.metadata?.total || 0,
            packageCredit: appointment.transaction.metadata?.packageCredit || 0,
            depositCredit: appointment.transaction.metadata?.depositCredit || 0,
          },
        } : null,
      })),
      availableForms,
    };
  },
});
