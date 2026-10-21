import Link from 'next/link';
import { portalSignUp } from '../account/actions';

export async function AccountSignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="sf-page-pad"><div className="sf-container-narrow"><form action={portalSignUp} className="sf-card mx-auto grid max-w-md gap-5 p-6">
    <h1 className="sf-display text-[var(--sf-text-2xl)]">Create account</h1>
    {error === "failed" ? <p role="alert" className="text-red-800">We couldn't create your account. Use a new email and a password of 12–128 characters, or sign in.</p> : null}
    <label className="grid gap-1 text-sm">Name<input name="name" className="sf-input" autoComplete="name" required maxLength={120} /></label>
    <label className="grid gap-1 text-sm">Email<input name="email" className="sf-input" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="grid gap-1 text-sm">Password<input name="password" className="sf-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="password-hint" /><span id="password-hint" className="text-xs text-[var(--sf-ink-2)]">At least 12 characters.</span></label>
    <button type="submit" className="sf-btn sf-btn-primary">Create account</button>
    <Link className="sf-link inline-flex min-h-11 items-center justify-center" href="/account/signin">Sign in</Link>
  </form></div></div>;
}
