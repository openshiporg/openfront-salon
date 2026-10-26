import { SignInForm } from "../components/SignInForm";
import type { ConsultationRetryAttempt } from "../account/consultationSubmitOutcome";

export function AccountSignInPage({ error, email = "", consultationUnresolved = false, consultationAttempt = null }: {
  error?: string | null;
  email?: string;
  consultationUnresolved?: boolean;
  consultationAttempt?: ConsultationRetryAttempt | null;
}) {
  return <div className="sf-page-pad"><div className="sf-container-narrow">
    <SignInForm error={error} email={email} consultationUnresolved={consultationUnresolved} consultationAttempt={consultationAttempt} />
  </div></div>;
}
