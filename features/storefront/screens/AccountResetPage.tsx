import Link from "next/link";
import { portalRedeemReset, portalRequestReset } from "../account/actions";

const STATUS: Record<string, { tone: "alert" | "status"; text: string }> = {
  sent: { tone: "status", text: "If an account uses that email, a reset link is on its way. It works for one hour." },
  missing: { tone: "alert", text: "Enter the email you sign in with." },
  failed: { tone: "alert", text: "We couldn't do that just now. Try again in a moment, or call the salon." },
  short: { tone: "alert", text: "Use at least 8 characters." },
  expired: { tone: "alert", text: "That reset link has expired or was already used. Ask for a new one below." },
};

/** Client password reset: ask for a link, then set a new password from it. */
export function AccountResetPage({ token, email, status }: { token?: string; email?: string; status?: string }) {
  const message = status ? STATUS[status] : null;
  const redeem = Boolean(token && email && status !== "expired");
  return <div className="sf-page-pad"><div className="sf-container-narrow">
    <form action={redeem ? portalRedeemReset : portalRequestReset} className="sf-carton mx-auto w-full max-w-md" data-band="ink">
      <div className="sf-carton-band"><span className="sf-shade" aria-hidden="true" /></div>
      <div className="grid gap-5 p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
        <h1 className="sf-display text-[length:var(--sf-text-3xl)]">{redeem ? "Choose a new password" : "Reset your password"}</h1>
        {message ? <p role={message.tone} className={message.tone === "alert" ? "sf-alert" : "sf-note"}>{message.text}</p> : null}
        {redeem ? <>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="email" value={email} />
          <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)] break-all">For {email}</p>
          <label className="sf-field">New password<input className="sf-input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <div className="sf-track sf-track-block"><button className="sf-btn sf-btn-primary" type="submit">Save password</button></div>
        </> : status === "sent" ? null : <>
          <label className="sf-field">Email<input className="sf-input" name="email" type="email" autoComplete="email" required /></label>
          <div className="sf-track sf-track-block"><button className="sf-btn sf-btn-primary" type="submit">Email me a reset link</button></div>
        </>}
        <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]"><Link href="/account/signin" className="sf-link">Back to sign in</Link></p>
      </div>
    </form>
  </div></div>;
}
