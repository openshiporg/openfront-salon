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
  return <div className="sf-page-pad"><div className="sf-container-narrow"><form action={portalSignIn} className="sf-card mx-auto grid max-w-md gap-5 p-6">
    <div><p className="sf-kicker">Client account</p><h1 className="sf-display text-[var(--sf-text-2xl)]">Sign in</h1><p className="sf-lead mt-2">Sign in to view your appointments.</p></div>
    {consultationUnresolved ? <><input type="hidden" name="consultation" value="unresolved"/>{consultationAttempt ? <><input type="hidden" name="consultationTemplate" value={consultationAttempt.templateVersionId}/><input type="hidden" name="consultationKey" value={consultationAttempt.idempotencyKey}/></> : null}</> : null}
    {error && SIGN_IN_ERRORS[error] ? <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{SIGN_IN_ERRORS[error]}</p> : null}
    <label className="grid gap-1 text-sm">Email<input className="sf-input" name="email" type="email" autoComplete="email" required/></label>
    <label className="grid gap-1 text-sm">Password<input className="sf-input" name="password" type="password" autoComplete="current-password" required/></label>
    <button className="sf-btn sf-btn-primary" type="submit">Sign in</button><Link href="/account/signup" className="sf-link inline-flex min-h-11 items-center justify-center">Create account</Link>
  </form></div></div>;
}
