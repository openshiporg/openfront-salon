/** Display appointment instants and policy deadlines in the appointment's salon timezone. */
export function formatSalonDateTime(value: string, timezone?: string | null): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
}
