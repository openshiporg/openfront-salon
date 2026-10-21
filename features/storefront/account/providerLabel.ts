type VisibleProvider = { user?: { name?: string | null } | null } | null | undefined;

function visibleName(provider: VisibleProvider): string | undefined {
  return provider?.user?.name?.trim() || undefined;
}

/** A returned relationship still means assigned when its nested User is protected. */
export function appointmentProviderLabel(stylist: VisibleProvider): string {
  return visibleName(stylist) || (stylist ? 'Assigned stylist' : 'Salon team');
}

export function segmentProviderLabel(segment: {
  practitioner?: VisibleProvider;
  practitionerRequired?: boolean | null;
}): string {
  const name = visibleName(segment.practitioner);
  if (name) return name;
  if (segment.practitioner) return 'Assigned practitioner';
  if (segment.practitionerRequired === false) return 'No stylist needed';
  if (segment.practitionerRequired === true) return 'Stylist to be assigned';
  return 'Stylist to be assigned';
}
