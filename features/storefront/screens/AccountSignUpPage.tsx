import Link from 'next/link';
import { portalSignUp } from '../account/actions';

export async function AccountSignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="sf-page-pad"><div className="sf-container-narrow"><form action={portalSignUp} className="sf-ticket mx-auto grid max-w-md gap-5 p-[var(--sf-space-md)] md:p-[var(--sf-space-lg)]">
    <div><p className="sf-kicker mb-3">Client account</p><h1 className="sf-display text-[var(--sf-text-3xl)]">Create <em>account</em></h1></div>
    {error === "failed" ? <p role="alert" className="sf-alert">We couldn't create your account. Use a new email and a password of 12–128 characters, or sign in.</p> : null}
    <label className="sf-field">Name<input name="name" className="sf-input" autoComplete="name" required maxLength={120} /></label>
    <label className="sf-field">Email<input name="email" className="sf-input" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="sf-field">Password<input name="password" className="sf-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="password-hint" /><span id="password-hint" className="sf-field-hint">At least 12 characters.</span></label>
    <div className="sf-track sf-track-block"><button type="submit" className="sf-btn sf-btn-primary">Create account</button></div>
    <p className="text-center text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">Have an account? <Link className="sf-link" href="/account/signin">Sign in</Link></p>
  </form></div></div>;
}
