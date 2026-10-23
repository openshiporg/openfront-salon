export type CheckoutMutationFeedback =
  | { status: 'success' }
  | { status: 'failure'; message?: string };

export function resolveCheckoutMutationFeedback(response: {
  success: boolean;
  data?: {
    completeAppointmentCheckout?: {
      success?: boolean | null;
      error?: string | null;
      transactionId?: string | null;
      paymentId?: string | null;
    } | null;
  } | null;
  error?: string;
}): CheckoutMutationFeedback {
  const result = response.data?.completeAppointmentCheckout;
  if (response.success && result?.success === true && Boolean(result.transactionId && result.paymentId)) return { status: 'success' };
  // A definite rejection carries its reason; anything else is an unconfirmed outcome.
  return response.success && result?.success === false && result.error ? { status: 'failure', message: result.error } : { status: 'failure' };
}
