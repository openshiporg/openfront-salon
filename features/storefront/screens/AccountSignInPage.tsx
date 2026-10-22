import Link from "next/link";
import { portalSignIn } from "../account/actions";
import type { ConsultationRetryAttempt } from "../account/consultationSubmitOutcome";

const SIGN_IN_ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "Incorrect email or password.",
  profile: "This account isn't set up for online booking. Contact the salon.",
};

export function AccountSignInPage({ error, consultationUnresolved = false, consultationAttempt = null }: {
  error?: string | null;
  consultationUnresolved?: boolean;
  consultationAttempt?: ConsultationRetryAttempt | null;
}) {
  return <div className="sf-page-pad"><div className="sf-container-narrow"><form action={portalSignIn} className="sf-ticket mx-auto grid max-w-md gap-5 p-[var(--sf-space-md)] md:p-[var(--sf-space-lg)]">
    <div><p className="sf-kicker mb-3">Client account</p><h1 className="sf-display text-[var(--sf-text-3xl)]">Sign <em>in</em></h1></div>
    {consultationUnresolved ? <><input type="hidden" name="consultation" value="unresolved"/>{consultationAttempt ? <><input type="hidden" name="consultationTemplate" value={consultationAttempt.templateVersionId}/><input type="hidden" name="consultationKey" value={consultationAttempt.idempotencyKey}/></> : null}</> : null}
    {error && SIGN_IN_ERRORS[error] ? <p role="alert" className="sf-alert">{SIGN_IN_ERRORS[error]}</p> : null}
    <label className="sf-field">Email<input className="sf-input" name="email" type="email" autoComplete="email" required/></label>
    <label className="sf-field">Password<input className="sf-input" name="password" type="password" autoComplete="current-password" required/></label>
    <div className="sf-track sf-track-block"><button className="sf-btn sf-btn-primary" type="submit">Sign in</button></div><p className="text-center text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">New client? <Link href="/account/signup" className="sf-link">Create account</Link></p>
  </form></div></div>;
}
