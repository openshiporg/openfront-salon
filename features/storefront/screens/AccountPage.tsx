import Link from "next/link";
import { CalendarPlus, LogOut } from "lucide-react";
import { cancelOwnedAppointment, portalSignOut, reviewOwnedAppointment, submitOwnedConsultation } from "../account/actions";
import { RescheduleForm } from "../components/RescheduleForm";

import { formatSalonDateTime as dateTime } from "@/features/lib/formatSalonDateTime";
import { appointmentProviderLabel, segmentProviderLabel } from "../account/providerLabel";
import { getCancellationPolicyGuidance } from "../account/cancellationPolicyGuidance";
import { getReschedulePolicyGuidance } from "../account/reschedulePolicyGuidance";
import type { ConsultationRetryAttempt } from "../account/consultationSubmitOutcome";

const STATUS_LABEL: Record<string, string> = { pending: "Requested", confirmed: "Confirmed", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled", no_show: "Missed" };
const STATUS_TONE: Record<string, string | undefined> = { pending: "warn", confirmed: "open", in_progress: "accent" };
const SEGMENT_LABEL: Record<string, string> = { service: "Service", processing: "Processing", finishing: "Finishing", cleanup: "Cleanup" };
const clock = (value: string, timeZone?: string | null) => new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timeZone || undefined });
const dateOnly = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);

export function AccountPage({ portal, message, consultationUnresolved = false, consultationAttempt = null }: {
  portal: any;
  message?: string | null;
  consultationUnresolved?: boolean;
  consultationAttempt?: ConsultationRetryAttempt | null;
}) {
  const consultationRetryHref = consultationUnresolved
    ? consultationAttempt
      ? `/account?consultation=unresolved&consultationTemplate=${encodeURIComponent(consultationAttempt.templateVersionId)}&consultationKey=${encodeURIComponent(consultationAttempt.idempotencyKey)}`
      : "/account?consultation=unresolved"
    : "/account";
  const consultationSignInHref = consultationUnresolved
    ? consultationAttempt
      ? `/account/signin?consultation=unresolved&consultationTemplate=${encodeURIComponent(consultationAttempt.templateVersionId)}&consultationKey=${encodeURIComponent(consultationAttempt.idempotencyKey)}`
      : "/account/signin?consultation=unresolved"
    : "/account/signin";
  if (portal?.status === "unavailable" || (portal?.status !== "available" && portal?.status !== "unauthenticated")) {
    return <div className="sf-page-pad"><div className="sf-container-narrow"><div role="alert" className="sf-ticket p-[var(--sf-space-md)] text-center md:p-[var(--sf-space-lg)]"><h1 className="sf-display mb-3 text-[length:var(--sf-text-2xl)]">Account unavailable</h1><p className="mb-6 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Something went wrong loading your account. Try again.</p><div className="sf-track"><Link href={consultationRetryHref} className="sf-btn sf-btn-primary">Try again</Link></div></div></div></div>;
  }
  if (portal.status === "unauthenticated") {
    return <div className="sf-page-pad"><div className="sf-container-narrow"><div className="sf-ticket p-[var(--sf-space-md)] text-center md:p-[var(--sf-space-lg)]"><p className="sf-kicker mb-3">Client account</p><h1 className="sf-display mb-6 text-[length:var(--sf-text-3xl)]">My appointments</h1><div className="sf-track"><Link href={consultationSignInHref} className="sf-btn sf-btn-primary">Sign in</Link><Link href="/account/signup" className="sf-btn sf-btn-quiet">Create account</Link></div></div></div></div>;
  }
  const account = portal.portal;
  const appointments = account.appointments;
  const consultationForms = consultationUnresolved
    ? consultationAttempt ? account.availableForms.filter((template: { id: string }) => template.id === consultationAttempt.templateVersionId) : []
    : account.availableForms;
  const renderTime = Date.now();
  const benefits = account.benefits as { memberships: any[]; packages: any[]; giftCards: any[]; points: { points: number; tier?: string } | null } | null | undefined;
  return (
    <div className="sf-page-pad !pt-[var(--sf-space-lg)]"><div className="sf-container grid gap-[var(--sf-space-xl)]">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><p className="sf-kicker mb-3">Client account</p><h1 className="sf-display text-[length:var(--sf-text-display-s)]">{account.client?.user?.name || "Your account"}</h1><p className="mt-2 break-all text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{account.client?.user?.email}</p></div>
        <div className="sf-track self-start sm:self-auto">
          <Link href="/book" className="sf-btn sf-btn-primary"><CalendarPlus />Book</Link>
          <form action={portalSignOut}><button className="sf-btn sf-btn-quiet" type="submit"><LogOut />Sign out</button></form>
        </div>
      </header>
      {message ? <p role="status" className="sf-note">{message}</p> : null}

      <section aria-labelledby="account-appointments"><h2 id="account-appointments" className="sf-display mb-5 text-[length:var(--sf-text-2xl)]">Appointments</h2>
        <div className="grid gap-4">{appointments.length ? appointments.map((appointment: any) => {
          const policy = appointment.metadata?.clientPolicySnapshot;
          const future = new Date(appointment.startTime).getTime() > renderTime;
          const mutable = future && ["pending", "confirmed"].includes(appointment.status);
          const cancellationGuidance = getCancellationPolicyGuidance(policy, renderTime);
          const rescheduleGuidance = getReschedulePolicyGuidance(policy, renderTime);
          const shopTimezone = appointment.location?.timezone || "UTC";
          return <article key={appointment.id} className="sf-card overflow-hidden"><div className="grid gap-5 p-[var(--sf-space-md)] lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><h3 className="sf-display text-[length:var(--sf-text-xl)]">{appointment.lineItems.map((line: any) => line.serviceTitle).join(" · ")}</h3><span className="sf-status !text-[length:var(--sf-text-xs)]"><span className="sf-dot" data-tone={STATUS_TONE[appointment.status]} aria-hidden="true" />{STATUS_LABEL[appointment.status] || appointment.status.replaceAll("_", " ")}</span></div>
            <p className="mt-2 text-[length:var(--sf-text-sm)] font-medium">{dateTime(appointment.startTime, appointment.location?.timezone)}</p>
            <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{appointmentProviderLabel(appointment.stylist)}{appointment.location?.name ? ` · ${appointment.location.name}` : ""}</p>
            {appointment.segments?.length > 1 ? <ol className="mt-3 grid gap-1 border-l-2 border-[var(--sf-rule)] pl-3 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{appointment.segments.map((segment: any) => <li key={segment.id}>{clock(segment.plannedStart, appointment.location?.timezone)} · {SEGMENT_LABEL[segment.type] || segment.type} · {segment.durationMinutes} min{segmentProviderLabel(segment) !== appointmentProviderLabel(appointment.stylist) ? ` · ${segmentProviderLabel(segment)}` : ""}</li>)}</ol> : null}
            {policy && mutable && ((cancellationGuidance.deadline && !cancellationGuidance.expired) || (rescheduleGuidance.deadline && !rescheduleGuidance.expired)) ? <p className="mt-3 text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">{cancellationGuidance.deadline && !cancellationGuidance.expired ? `Cancel online until ${dateTime(cancellationGuidance.deadline, appointment.location?.timezone)}.` : null}{rescheduleGuidance.deadline && !rescheduleGuidance.expired ? ` Reschedule online until ${dateTime(rescheduleGuidance.deadline, appointment.location?.timezone)}.` : null}</p> : null}
          </div>{mutable ? <div className="grid content-start gap-4">
            {appointment.lineItems?.length && rescheduleGuidance.expired && !cancellationGuidance.expired ? (
              <p role="status" className="sf-note !text-[length:var(--sf-text-xs)]">It's too late to reschedule online. Contact the salon to change this appointment.</p>
            ) : null}
            {cancellationGuidance.expired ? <p role="status" className="sf-note !text-[length:var(--sf-text-xs)]">{rescheduleGuidance.expired ? "It's too late to change this appointment online. Contact the salon." : cancellationGuidance.notice}</p> : <details className="group"><summary className="sf-link cursor-pointer list-none text-[length:var(--sf-text-sm)] [&::-webkit-details-marker]:hidden">Cancel appointment</summary><form action={cancelOwnedAppointment} className="mt-3 grid gap-2"><input type="hidden" name="appointmentId" value={appointment.id}/><label className="sf-field">Reason <span className="sf-field-hint">Optional</span><input className="sf-input" name="reason" maxLength={1000}/></label><div className="sf-track sf-track-block"><button className="sf-btn" type="submit">Request cancellation</button></div><p className="text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">{cancellationGuidance.notice}</p></form></details>}
          </div> : null}</div>
          {mutable && appointment.lineItems?.length && !rescheduleGuidance.expired && appointment.stylist?.id ? (
            <details className="border-t border-[var(--sf-rule)]">
              <summary className="sf-link cursor-pointer list-none px-[var(--sf-space-md)] py-4 text-[length:var(--sf-text-sm)] font-semibold [&::-webkit-details-marker]:hidden">Reschedule</summary>
              <div className="px-[var(--sf-space-md)] pb-[var(--sf-space-md)]">
                <RescheduleForm
                  appointmentId={appointment.id}
                  idempotencyKey={`portal-reschedule:${appointment.id}:${appointment.scheduleRevisions?.[0]?.revision || 0}`}
                  timeZone={shopTimezone}
                  stylistId={appointment.stylist.id}
                  locationId={appointment.location?.id}
                  serviceId={appointment.lineItems[0]?.service?.id}
                  duration={appointment.lineItems.reduce((sum: number, line: any) => sum + Number(line.duration || 0), 0) || appointment.duration || 60}
                />
              </div>
            </details>
          ) : null}
          {appointment.status === "completed" ? (appointment.review ? (
            <p className="border-t border-[var(--sf-rule)] px-[var(--sf-space-md)] py-4 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">Your review: {"★".repeat(appointment.review.rating)}{appointment.review.isApproved ? "" : " · awaiting approval"}</p>
          ) : (
            <details className="border-t border-[var(--sf-rule)]">
              <summary className="sf-link cursor-pointer list-none px-[var(--sf-space-md)] py-4 text-[length:var(--sf-text-sm)] font-semibold [&::-webkit-details-marker]:hidden">Leave a review</summary>
              <form action={reviewOwnedAppointment} className="grid max-w-md gap-3 px-[var(--sf-space-md)] pb-[var(--sf-space-md)]">
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <fieldset className="sf-field"><legend>Rating</legend><div className="sf-track mt-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="sf-btn cursor-pointer !px-3 has-[:checked]:!bg-[var(--sf-ink)] has-[:checked]:!text-[var(--sf-accent-ink)] has-[:focus-visible]:ring-2"><input type="radio" name="rating" value={value} required className="sr-only" />{value}★</label>)}</div></fieldset>
                <label className="sf-field">Comment <span className="sf-field-hint">Optional</span><textarea className="sf-input min-h-20" name="comment" maxLength={2000} /></label>
                <div className="sf-track sf-track-block"><button className="sf-btn sf-btn-primary" type="submit">Submit review</button></div>
              </form>
            </details>
          )) : null}
          {appointment.transaction ? <div className="border-t border-dashed border-[var(--sf-rule-strong)] bg-[var(--sf-paper-2)] p-[var(--sf-space-md)]"><h4 className="sf-eyebrow">Receipt</h4><dl className="mt-3 grid max-w-md gap-1.5 text-[length:var(--sf-text-sm)]">{appointment.transaction.lineItems.map((line: any) => <div key={line.id} className="flex justify-between gap-4"><dt>{line.metadata?.title || line.itemType} × {line.quantity}</dt><dd className="tabular-nums">{money(line.unitPrice * line.quantity - line.discount)}</dd></div>)}<div className="flex justify-between gap-4 text-[var(--sf-ink-3)]"><dt>Tax</dt><dd className="tabular-nums">{money(appointment.payment?.tax)}</dd></div><div className="flex justify-between gap-4 text-[var(--sf-ink-3)]"><dt>Tip</dt><dd className="tabular-nums">{money(appointment.payment?.tip)}</dd></div>{appointment.transaction.metadata?.packageCredit > 0 ? <div className="flex justify-between gap-4 text-[var(--sf-ink-3)]"><dt>Package credit</dt><dd className="tabular-nums">-{money(appointment.transaction.metadata.packageCredit)}</dd></div> : null}{appointment.transaction.metadata?.depositCredit > 0 ? <div className="flex justify-between gap-4 text-[var(--sf-ink-3)]"><dt>Deposit applied</dt><dd className="tabular-nums">-{money(appointment.transaction.metadata.depositCredit)}</dd></div> : null}<div className="mt-1 flex justify-between gap-4 border-t border-[var(--sf-rule)] pt-2 font-semibold"><dt>Paid</dt><dd className="tabular-nums">{money(appointment.payment?.totalAmount)}</dd></div>{appointment.payment?.refundedAmount ? <div className="flex justify-between gap-4"><dt>Refunded</dt><dd className="tabular-nums">-{money(appointment.payment.refundedAmount)}</dd></div> : null}</dl></div> : null}
          </article>;
        }) : <div className="sf-card-quiet flex flex-col items-center px-6 py-[var(--sf-space-xl)] text-center"><p className="sf-display mb-5 text-[length:var(--sf-text-xl)]">No appointments yet</p><div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div></div>}</div>
      </section>

      {benefits && (benefits.memberships.length || benefits.packages.length || benefits.giftCards.length || benefits.points) ? (
        <section aria-labelledby="account-benefits"><h2 id="account-benefits" className="sf-display mb-5 text-[length:var(--sf-text-2xl)]">Memberships &amp; rewards</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.points ? <article className="sf-card p-[var(--sf-space-md)]"><p className="sf-eyebrow">Rewards · {String(benefits.points.tier || "bronze").replace(/^./, (c: string) => c.toUpperCase())}</p><p className="sf-display mt-2 text-[length:var(--sf-text-2xl)] tabular-nums">{new Intl.NumberFormat("en-US").format(benefits.points.points || 0)} points</p></article> : null}
            {benefits.memberships.map((item: any) => (
              <article key={item.id} className="sf-card p-[var(--sf-space-md)]"><p className="sf-eyebrow">Membership · {item.status === "paused" ? "paused" : item.status}</p><p className="sf-display mt-2 text-[length:var(--sf-text-xl)]">{item.membership?.name}</p><p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{item.membership?.discountPercent ? `${item.membership.discountPercent}% off · ` : ""}{item.status === "active" && item.nextBillingDate ? `renews ${dateOnly(item.nextBillingDate)}` : item.status === "paused" && item.pausedUntil ? `paused until ${dateOnly(item.pausedUntil)}` : `since ${dateOnly(item.startDate)}`}</p></article>
            ))}
            {benefits.packages.map((item: any) => (
              <article key={item.id} className="sf-card p-[var(--sf-space-md)]"><p className="sf-eyebrow">Package · {String(item.status).replace("-", " ")}</p><p className="sf-display mt-2 text-[length:var(--sf-text-xl)]">{item.package?.name}</p><p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{money(Math.max(0, item.totalValue - (item.usedValue || 0)))} of {money(item.totalValue)} left{item.expiresAt ? ` · expires ${dateOnly(item.expiresAt)}` : ""}</p></article>
            ))}
            {benefits.giftCards.map((item: any) => (
              <article key={item.id} className="sf-card p-[var(--sf-space-md)]"><p className="sf-eyebrow">Gift card{item.recipientName ? ` · for ${item.recipientName}` : ""}</p><p className="mt-2 font-mono text-[length:var(--sf-text-md)]">{item.code}</p><p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{money(item.currentBalance)} of {money(item.initialValue)} left{item.expiresAt ? ` · expires ${dateOnly(item.expiresAt)}` : ""}</p></article>
            ))}
          </div>
        </section>
      ) : null}

      {consultationForms.length > 0 || consultationUnresolved ? <section aria-labelledby="account-consultations"><h2 id="account-consultations" className="sf-display mb-5 text-[length:var(--sf-text-2xl)]">Consultation forms</h2>
        {consultationUnresolved && consultationForms.length === 0 ? <p role="status" className="sf-note">The original consultation form version is not available to retry here. Contact the salon before starting another submission.</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">{consultationForms.map((template: any) => {
          const questions = Array.isArray(template.questions) ? template.questions : [];
          const idempotencyKey = consultationAttempt && consultationAttempt.templateVersionId === template.id
            ? consultationAttempt.idempotencyKey
            : `portal-consultation:${template.id}:${Date.now()}`;
          return <form action={submitOwnedConsultation} key={template.id} className="sf-card grid gap-4 p-[var(--sf-space-md)]">
            <div><p className="sf-kicker mb-2">Version {template.version}</p><h3 className="sf-display text-[length:var(--sf-text-xl)]">{template.titleSnapshot}</h3><p className="mt-2 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{template.purposeSnapshot}</p></div>
            <input type="hidden" name="templateVersionId" value={template.id}/><input type="hidden" name="questionIds" value={questions.map((question: any) => question.id).join(",")}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/>
            <label className="sf-field">Appointment <span className="sf-field-hint">Optional</span><select name="appointmentId" className="sf-input"><option value="">General consultation</option>{appointments.filter((item: any) => ["pending", "confirmed"].includes(item.status)).map((item: any) => <option key={item.id} value={item.id}>{dateTime(item.startTime, item.location?.timezone)}</option>)}</select></label>
            {questions.map((question: any) => <label key={question.id} className="sf-field">{question.label}{question.required ? " *" : ""}<textarea className="sf-input min-h-20" name={`answer:${question.id}`} required={Boolean(question.required)} maxLength={5000}/></label>)}
            <label className="sf-field">Signer name<input className="sf-input" name="signerName" required maxLength={200}/></label><label className="sf-field">Signer authority<select className="sf-input" name="signerRole"><option value="self">Self</option><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="representative">Authorized representative</option></select></label><label className="sf-field">Guardian/representative authority <span className="sf-field-hint">If applicable</span><input className="sf-input" name="guardianAuthority" maxLength={1000}/></label><label className="sf-field">Signature<input className="sf-input" name="signatureEvidence" required maxLength={5000} placeholder="Full legal name"/></label>
            <div className="sf-track sf-track-block"><button className="sf-btn sf-btn-primary" type="submit">Sign and submit</button></div>
          </form>;
        })}</div>
      </section> : null}
    </div></div>
  );
}
