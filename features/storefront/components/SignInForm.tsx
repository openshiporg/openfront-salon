import Link from "next/link";
import { portalSignIn } from "../account/actions";
import type { ConsultationRetryAttempt } from "../account/consultationSubmitOutcome";

const SIGN_IN_ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "Incorrect email or password.",
  profile: "This account isn't set up for online booking. Contact the salon.",
};

/** The client sign-in form; shown on /account/signin and directly on /account when signed out. */
export function SignInForm({ error, email = "", consultationUnresolved = false, consultationAttempt = null, headingLevel = 1, title = "Sign in" }: {
  error?: string | null;
  email?: string;
  consultationUnresolved?: boolean;
  consultationAttempt?: ConsultationRetryAttempt | null;
  headingLevel?: 1 | 2;
  title?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <form action={portalSignIn} className="sf-carton mx-auto w-full max-w-md" data-band="ink">
      <div className="sf-carton-band"><span>Client account</span><span className="sf-shade" aria-hidden="true" /></div>
      <div className="grid gap-5 p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
        <Heading className="sf-display text-[length:var(--sf-text-3xl)]">{title}</Heading>
        {consultationUnresolved ? <><input type="hidden" name="consultation" value="unresolved"/>{consultationAttempt ? <><input type="hidden" name="consultationTemplate" value={consultationAttempt.templateVersionId}/><input type="hidden" name="consultationKey" value={consultationAttempt.idempotencyKey}/></> : null}</> : null}
        {error && SIGN_IN_ERRORS[error] ? <p role="alert" className="sf-alert">{SIGN_IN_ERRORS[error]}</p> : null}
        <label className="sf-field">Email<input className="sf-input" name="email" type="email" autoComplete="email" defaultValue={error ? email : ""} required/></label>
        <label className="sf-field">Password<input className="sf-input" name="password" type="password" autoComplete="current-password" required/></label>
        <div className="sf-track sf-track-block"><button className="sf-btn sf-btn-primary" type="submit">Sign in</button></div>
        <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">New client? <Link href="/account/signup" className="sf-link">Create account</Link></p>
      </div>
    </form>
  );
}
