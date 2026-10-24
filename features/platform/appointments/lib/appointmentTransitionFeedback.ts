export type AppointmentTransitionFeedback =
  | { status: 'success' }
  | { status: 'rejected'; message: string }
  | { status: 'failure' };

export type AppointmentTransitionFormState = AppointmentTransitionFeedback | { status: 'idle' };

export function resolveAppointmentTransitionFeedback(response: {
  success: boolean;
  data?: { transitionAppointment?: { success?: boolean | null; error?: string | null } | null } | null;
  error?: string;
}): AppointmentTransitionFeedback {
  if (response.success && response.data?.transitionAppointment?.success === true) return { status: 'success' };
  const message = response.success ? response.data?.transitionAppointment?.error?.trim() : '';
  // A definite workflow rejection carries the server's reason; anything else is unconfirmed.
  return message ? { status: 'rejected', message } : { status: 'failure' };
}
