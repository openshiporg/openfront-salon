type Contact = { name?: string | null; email?: string | null; phone?: string | null };

/** Operator-only appointment projection. Never use guest email as account identity. */
export function appointmentContact(appointment: { client?: { user?: Contact | null; guestName?: string | null; guestEmail?: string | null; guestPhone?: string | null } | null; metadata?: unknown }) {
  const metadata = appointment.metadata && typeof appointment.metadata === 'object' ? appointment.metadata as Record<string, unknown> : {};
  const guest = metadata.guest && typeof metadata.guest === 'object' ? metadata.guest as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const user = appointment.client?.user;
  return {
    name: text(user?.name) || text(appointment.client?.guestName) || text(guest.name) || 'Walk-in',
    email: text(user?.email) || text(appointment.client?.guestEmail) || text(guest.email),
    phone: text(user?.phone) || text(appointment.client?.guestPhone) || text(guest.phone),
  };
}
