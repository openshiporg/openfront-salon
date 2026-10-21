'use client';

import { useState } from 'react';
import { LOGO_ICONS } from '../lib/icon-registry';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { normalizeStoreLogoColor } from '@/features/lib/store-logo';
import { Label } from '@/components/ui/label';

// Adapted from Restaurant's LogoPicker: exact Untitled registry and shared allowlist.
export function LogoPicker({ initialIcon, initialColor }: { initialIcon?: string; initialColor?: string }) {
  const [svg, setSvg] = useState(initialIcon || LOGO_ICONS[0].lightSvg);
  const [hue, setHue] = useState(normalizeStoreLogoColor(initialColor));
  const [custom, setCustom] = useState(Boolean(initialIcon && !LOGO_ICONS.some(icon => icon.lightSvg === initialIcon)));
  const selected = LOGO_ICONS.find(icon => icon.lightSvg === svg);
  const safe = sanitizeStoreLogoSvg(svg);
  return <section className="grid gap-4 border bg-background p-5">
    <h2 className="font-semibold">Logo</h2>
    <Label htmlFor="logo-library">Logo library</Label>
    <select id="logo-library" className="min-h-11 w-full rounded-md border bg-background px-3" value={custom ? 'custom' : selected?.id || 'custom'} onChange={event => {
      setCustom(event.target.value === 'custom');
      const icon = LOGO_ICONS.find(item => item.id === event.target.value);
      if (icon) setSvg(icon.lightSvg);
    }}>
      {LOGO_ICONS.map(icon => <option key={icon.id} value={icon.id}>{icon.name}</option>)}
      <option value="custom">Custom SVG</option>
    </select>
    {custom ? <>
      <Label htmlFor="custom-logo">Custom SVG</Label>
      <textarea id="custom-logo" value={svg} onChange={event => setSvg(event.target.value)} maxLength={100000} spellCheck={false} aria-invalid={Boolean(svg && !safe)} className="min-h-32 w-full rounded-md border p-3 font-mono text-xs" />
      {svg && !safe ? <p role="alert" className="text-sm text-destructive">Invalid or unsafe SVG.</p> : null}
    </> : null}
    <input type="hidden" name="logoIcon" value={svg} />
    <span aria-label="Logo" className="block size-16 [&>svg]:size-full" style={{ filter: `hue-rotate(${hue}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />
    <Label htmlFor="logo-color">Logo colour · {hue}°</Label>
    <input id="logo-color" name="logoColor" type="range" min="0" max="359" step="1" value={hue} onChange={event => setHue(event.target.value)} className="min-h-11 w-full" />
  </section>;
}
