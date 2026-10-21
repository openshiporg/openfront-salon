export type AppointmentTransitionFeedback =
  | { status: 'success' }
  | { status: 'failure' };

export type AppointmentTransitionFormState = AppointmentTransitionFeedback | { status: 'idle' };

export function resolveAppointmentTransitionFeedback(response: {
  success: boolean;
  data?: { transitionAppointment?: { success?: boolean | null; error?: string | null } | null } | null;
  error?: string;
}): AppointmentTransitionFeedback {
  return response.success && response.data?.transitionAppointment?.success === true
    ? { status: 'success' }
    : { status: 'failure' };
}
