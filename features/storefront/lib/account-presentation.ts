import { parseConsultationRetryAttempt } from "@/features/storefront/account/consultationSubmitOutcome";

export type AccountSearchParams = {
  error?: string;
  updated?: string;
  cancellation?: string;
  reschedule?: string;
  consultation?: string;
  consultationTemplate?: string;
  consultationKey?: string;
};

const CANCELLATION_UNRESOLVED =
  "We couldn’t confirm your cancellation. If the appointment below is still active, try again or contact the salon.";

const RESCHEDULE_UNRESOLVED =
  "We couldn’t confirm your reschedule request. Check the time below before trying again, or contact the salon.";

const RESCHEDULE_REJECTED: Record<string, string> = {
  unavailable: "That time isn’t available. Choose another time.",
  late: "It’s too late to reschedule online. Contact the salon.",
  changed: "This appointment changed. Reload and choose a time again.",
};

const CONSULTATION_UNRESOLVED_REPLAYABLE =
  "We couldn’t confirm your consultation form was submitted. Re-enter the same answers and submit again; it won’t be sent twice.";

const CONSULTATION_UNRESOLVED_UNRECOVERABLE =
  "We couldn’t confirm your consultation form was submitted. Contact the salon before submitting it again.";

const UPDATED_MESSAGES: Record<string, string> = {
  cancelled: "Your appointment was cancelled.",
  rescheduled: "Your appointment was rescheduled.",
  consultation: "Your consultation form was submitted.",
  review: "Thanks. Your review shows once the salon approves it.",
};

const ERROR_MESSAGES: Record<string, string> = {
  time: "Choose a new date and time.",
  review: "Your review couldn’t be saved. Choose a rating and try again.",
};

/** Maps account route search params to the portal banner and consultation retry state. */
export function accountPresentation(params: AccountSearchParams) {
  const consultationUnresolved = params.consultation === "unresolved";
  const consultationAttempt = parseConsultationRetryAttempt(params.consultation, params.consultationTemplate, params.consultationKey);

  const consultationMessage = consultationUnresolved
    ? consultationAttempt ? CONSULTATION_UNRESOLVED_REPLAYABLE : CONSULTATION_UNRESOLVED_UNRECOVERABLE
    : null;
  const rescheduleMessage = params.reschedule === "unresolved" ? RESCHEDULE_UNRESOLVED : params.reschedule ? RESCHEDULE_REJECTED[params.reschedule] ?? null : null;
  const cancellationMessage = params.cancellation === "unresolved" ? CANCELLATION_UNRESOLVED : null;
  const updatedMessage = params.updated ? UPDATED_MESSAGES[params.updated] ?? null : null;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? null : null;

  return {
    message: consultationMessage || rescheduleMessage || cancellationMessage || errorMessage || updatedMessage,
    consultationUnresolved,
    consultationAttempt,
  };
}
