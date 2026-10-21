export type CheckoutAppointmentReadResult<TAppointment> =
  | { status: 'found'; appointment: TAppointment }
  | { status: 'not-found' }
  | { status: 'unavailable' };

export type CheckoutProductsReadResult<TProduct> =
  | { status: 'available'; products: TProduct[] }
  | { status: 'unavailable' };

export type CheckoutWorkflowReadResult<TAppointment, TProduct> =
  | { status: 'available'; data: { appointment: TAppointment; products: TProduct[] } }
  | { status: 'not-found' }
  | { status: 'unavailable' };

export function hasCompleteCheckoutAppointmentRead(value: unknown): value is {
  id: string;
  services: unknown[];
  lineItems: unknown[];
} {
  if (typeof value !== 'object' || value === null) return false;
  const appointment = value as Record<string, unknown>;
  return typeof appointment.id === 'string' && appointment.id.length > 0 &&
    Array.isArray(appointment.services) && Array.isArray(appointment.lineItems);
}

export function resolveCheckoutAppointmentResponse<TAppointment>(response: {
  success: boolean;
  data?: { appointment?: TAppointment | null };
  failureKind?: 'graphql' | 'transport' | 'unknown';
  error?: string;
}): CheckoutAppointmentReadResult<TAppointment> {
  if (!response.success) {
    return response.failureKind === 'transport' ? { status: 'unavailable' } : { status: 'not-found' };
  }

  const appointment = response.data?.appointment;
  if (appointment === null || appointment === undefined) return { status: 'not-found' };
  if (typeof appointment !== 'object') return { status: 'not-found' };

  return { status: 'found', appointment };
}

export function resolveCheckoutProductsResponse<TProduct>(response: {
  success: boolean;
  data?: { products?: TProduct[] | null };
}): CheckoutProductsReadResult<TProduct> {
  if (!response.success || !Array.isArray(response.data?.products)) return { status: 'unavailable' };
  return { status: 'available', products: response.data.products };
}
