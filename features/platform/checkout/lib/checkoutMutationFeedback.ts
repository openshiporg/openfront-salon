export type CheckoutMutationFeedback =
  | { status: 'success' }
  | { status: 'failure' };

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
  return response.success && result?.success === true && Boolean(result.transactionId && result.paymentId)
    ? { status: 'success' }
    : { status: 'failure' };
}
