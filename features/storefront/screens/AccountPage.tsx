import Link from "next/link";
import { Calendar, FileCheck2, LogOut, ReceiptText } from "lucide-react";
import { cancelOwnedAppointment, portalSignOut, rescheduleOwnedAppointment, submitOwnedConsultation } from "../account/actions";

import { formatSalonDateTime as dateTime } from "@/features/lib/formatSalonDateTime";
import { appointmentProviderLabel, segmentProviderLabel } from "../account/providerLabel";
import { getCancellationPolicyGuidance } from "../account/cancellationPolicyGuidance";
import { getReschedulePolicyGuidance } from "../account/reschedulePolicyGuidance";
import type { ConsultationRetryAttempt } from "../account/consultationSubmitOutcome";

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
    return <div className="sf-page-pad"><div className="sf-container-narrow text-center"><div role="alert" className="sf-card p-6"><h1 className="sf-display text-[var(--sf-text-2xl)] mb-3">Account information unavailable</h1><p className="sf-lead mb-6">Something went wrong loading your account. Try again.</p><Link href={consultationRetryHref} className="sf-btn sf-btn-primary">Try again</Link></div></div></div>;
  }
  if (portal.status === "unauthenticated") {
    return <div className="sf-page-pad"><div className="sf-container-narrow text-center"><h1 className="sf-display text-[var(--sf-text-2xl)] mb-3">Private client portal</h1><p className="sf-lead mb-6">Sign in to view your appointments.</p><Link href={consultationSignInHref} className="sf-btn sf-btn-primary">Client sign in</Link></div></div>;
  }
  const account = portal.portal;
  const appointments = account.appointments;
  const consultationForms = consultationUnresolved
    ? consultationAttempt ? account.availableForms.filter((template: { id: string }) => template.id === consultationAttempt.templateVersionId) : []
    : account.availableForms;
  const renderTime = Date.now();
  return (
    <div className="sf-page-pad"><div className="sf-container space-y-10">
      <header className="flex flex-col gap-4 border-b border-[var(--sf-rule)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="sf-kicker">Client account</p><h1 className="sf-display text-[var(--sf-text-2xl)]">Your account</h1><p className="mt-2 text-sm text-[var(--sf-ink-2)]">{account.client?.user?.name} · {account.client?.user?.email}</p></div>
        <form action={portalSignOut}><button className="sf-btn sf-btn-secondary" type="submit"><LogOut className="h-4 w-4" />Sign out</button></form>
      </header>
      {message ? <p role="status" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-3 text-sm">{message}</p> : null}

      <section><div className="mb-5 flex items-center gap-3"><Calendar className="h-5 w-5"/><h2 className="sf-display text-[var(--sf-text-xl)]">Appointments</h2></div>
        <div className="grid gap-5">{appointments.length ? appointments.map((appointment: any) => {
          const policy = appointment.metadata?.clientPolicySnapshot;
          const future = new Date(appointment.startTime).getTime() > renderTime;
          const mutable = future && ["pending", "confirmed"].includes(appointment.status);
          const cancellationGuidance = getCancellationPolicyGuidance(policy, renderTime);
          const rescheduleGuidance = getReschedulePolicyGuidance(policy, renderTime);
          const shopTimezone = appointment.location?.timezone || "UTC";
          return <article key={appointment.id} className="sf-card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div>
            <p className="sf-kicker">{appointment.status.replaceAll("_", " ")}</p><h3 className="sf-display text-lg">{appointment.lineItems.map((line: any) => line.serviceTitle).join(" · ")}</h3>
            <p className="mt-2 text-sm">{dateTime(appointment.startTime, appointment.location?.timezone)} · {appointmentProviderLabel(appointment.stylist)}</p>
            {appointment.segments?.length ? <ol className="mt-3 space-y-1 text-sm text-[var(--sf-ink-2)]">{appointment.segments.map((segment: any) => <li key={segment.id}>{dateTime(segment.plannedStart, appointment.location?.timezone)} · {segment.type} · {segment.durationMinutes} min · {segmentProviderLabel(segment)}{segment.resource?.name ? ` · ${segment.resource.name}` : ""}</li>)}</ol> : null}
            {policy ? <p className="mt-3 text-xs text-[var(--sf-ink-3)]">{cancellationGuidance.deadline ? `Cancel online until ${dateTime(cancellationGuidance.deadline, appointment.location?.timezone)}.` : null}{rescheduleGuidance.deadline ? ` Reschedule online until ${dateTime(rescheduleGuidance.deadline, appointment.location?.timezone)}.` : null}</p> : null}
          </div>{mutable ? <div className="grid w-full gap-3 lg:w-auto lg:min-w-72">
            {cancellationGuidance.expired ? <p role="status" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-3 text-xs text-[var(--sf-ink-2)]">{cancellationGuidance.notice}</p> : <form action={cancelOwnedAppointment} className="grid gap-2"><input type="hidden" name="appointmentId" value={appointment.id}/><label className="grid gap-1 text-sm">Reason (optional)<input className="sf-input" name="reason" maxLength={1000}/></label><button className="sf-btn sf-btn-secondary" type="submit">Request cancellation</button><p className="text-xs text-[var(--sf-ink-3)]">{cancellationGuidance.notice}</p></form>}
            {appointment.lineItems?.length ? (
              rescheduleGuidance.expired ? (
                <p role="status" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-3 text-xs text-[var(--sf-ink-2)]">It's too late to reschedule online. Contact the salon to change this appointment.</p>
              ) : (
                <form action={rescheduleOwnedAppointment} className="grid gap-2"><input type="hidden" name="appointmentId" value={appointment.id}/><input type="hidden" name="idempotencyKey" value={`portal-reschedule:${appointment.id}:${appointment.scheduleRevisions?.[0]?.revision || 0}`}/><input type="hidden" name="timeZone" value={shopTimezone}/><label className="grid gap-1 text-sm">New date and time<input className="sf-input" name="startTime" type="datetime-local" step={900} required/></label><p className="text-xs text-[var(--sf-ink-3)]">Times are in the salon's time zone.</p><button className="sf-btn sf-btn-secondary" type="submit">Request reschedule</button></form>
              )
            ) : null}
          </div> : null}</div>
          {appointment.transaction ? <div className="mt-5 border-t border-[var(--sf-rule)] pt-4"><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4"/><h4 className="font-medium">Receipt</h4></div><div className="mt-3 grid gap-2 text-sm">{appointment.transaction.lineItems.map((line: any) => <div key={line.id} className="flex justify-between"><span>{line.metadata?.title || line.itemType} × {line.quantity}</span><span>{money(line.unitPrice * line.quantity - line.discount)}</span></div>)}<div className="flex justify-between"><span>Tax</span><span>{money(appointment.payment?.tax)}</span></div><div className="flex justify-between"><span>Tip</span><span>{money(appointment.payment?.tip)}</span></div>{appointment.transaction.metadata?.packageCredit > 0 ? <div className="flex justify-between"><span>Package credit</span><span>-{money(appointment.transaction.metadata.packageCredit)}</span></div> : null}{appointment.transaction.metadata?.depositCredit > 0 ? <div className="flex justify-between"><span>Deposit applied</span><span>-{money(appointment.transaction.metadata.depositCredit)}</span></div> : null}<div className="flex justify-between font-medium"><span>Paid</span><span>{money(appointment.payment?.totalAmount)}</span></div>{appointment.payment?.refundedAmount ? <div className="flex justify-between"><span>Refunded</span><span>-{money(appointment.payment.refundedAmount)}</span></div> : null}</div></div> : null}
          </article>;
        }) : <div className="border border-[var(--sf-rule)] p-6 text-center"><p>No appointments are linked to this account.</p><Link href="/book" className="sf-btn sf-btn-primary mt-4">Reserve a visit</Link></div>}</div>
      </section>

      <section><div className="mb-5 flex items-center gap-3"><FileCheck2 className="h-5 w-5"/><h2 className="sf-display text-[var(--sf-text-xl)]">Consultations</h2></div>
        {consultationUnresolved && consultationForms.length === 0 ? <p role="status" className="text-sm">The original consultation form version is not available to retry here. Contact the salon before starting another submission.</p> : null}
        <div className="grid gap-5 lg:grid-cols-2">{consultationForms.map((template: any) => {
          const questions = Array.isArray(template.questions) ? template.questions : [];
          const idempotencyKey = consultationAttempt && consultationAttempt.templateVersionId === template.id
            ? consultationAttempt.idempotencyKey
            : `portal-consultation:${template.id}:${Date.now()}`;
          return <form action={submitOwnedConsultation} key={template.id} className="sf-card grid gap-4 p-5">
            <div><p className="sf-kicker">Version {template.version}</p><h3 className="sf-display text-lg">{template.titleSnapshot}</h3><p className="mt-2 text-sm">{template.purposeSnapshot}</p></div>
            <input type="hidden" name="templateVersionId" value={template.id}/><input type="hidden" name="questionIds" value={questions.map((question: any) => question.id).join(",")}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/>
            <label className="grid gap-1 text-sm">Appointment (optional)<select name="appointmentId" className="sf-input"><option value="">General consultation</option>{appointments.filter((item: any) => ["pending", "confirmed"].includes(item.status)).map((item: any) => <option key={item.id} value={item.id}>{dateTime(item.startTime, item.location?.timezone)}</option>)}</select></label>
            {questions.map((question: any) => <label key={question.id} className="grid gap-1 text-sm">{question.label}{question.required ? " *" : ""}<textarea className="sf-input min-h-20" name={`answer:${question.id}`} required={Boolean(question.required)} maxLength={5000}/></label>)}
            <label className="grid gap-1 text-sm">Signer name<input className="sf-input" name="signerName" required maxLength={200}/></label><label className="grid gap-1 text-sm">Signer authority<select className="sf-input" name="signerRole"><option value="self">Self</option><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="representative">Authorized representative</option></select></label><label className="grid gap-1 text-sm">Guardian/representative authority, if applicable<input className="sf-input" name="guardianAuthority" maxLength={1000}/></label><label className="grid gap-1 text-sm">Signature acknowledgment<input className="sf-input" name="signatureEvidence" required maxLength={5000} placeholder="Type your full legal name to sign"/></label>
            <button className="sf-btn sf-btn-primary" type="submit">Sign and submit</button>
          </form>;
        })}</div>
      </section>
    </div></div>
  );
}
