import { SignInForm } from "../components/SignInForm";
import type { ConsultationRetryAttempt } from "../account/consultationSubmitOutcome";

export function AccountSignInPage({ error, reset, email = "", consultationUnresolved = false, consultationAttempt = null }: {
  error?: string | null;
  reset?: string | null;
  email?: string;
  consultationUnresolved?: boolean;
  consultationAttempt?: ConsultationRetryAttempt | null;
}) {
  return <div className="sf-page-pad"><div className="sf-container-narrow">
    <SignInForm error={error} notice={reset === "done" ? "reset" : null} email={email} consultationUnresolved={consultationUnresolved} consultationAttempt={consultationAttempt} />
  </div></div>;
}
