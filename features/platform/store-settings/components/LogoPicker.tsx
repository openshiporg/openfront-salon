'use client';

import { useState } from 'react';
import { LOGO_ICONS } from '../lib/icon-registry';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';
import { fieldLabelClass, pillClass, trackClass } from '../../components/pill';

// Adapted from Restaurant's LogoPicker: exact Untitled registry and shared allowlist.
export function LogoPicker({ initialIcon, initialColor, name }: { initialIcon?: string; initialColor?: string; name?: string }) {
  // An empty stored logo is what the storefront shows as the default mark, so preselect that.
  const [svg, setSvg] = useState(initialIcon || DEFAULT_STORE_LOGO_ICON);
  const [hue, setHue] = useState(normalizeStoreLogoColor(initialColor));
  const [custom, setCustom] = useState(Boolean(initialIcon && initialIcon !== DEFAULT_STORE_LOGO_ICON && !LOGO_ICONS.some(icon => icon.lightSvg === initialIcon)));
  const safe = sanitizeStoreLogoSvg(svg);
  const filter = `hue-rotate(${hue}deg)`;

  return (
    <section className="grid gap-5 rounded-2xl border bg-background p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Logo & colour</h2>
        <div className={trackClass} role="group" aria-label="Logo source">
          <button type="button" aria-pressed={!custom} onClick={() => { setCustom(false); if (svg !== DEFAULT_STORE_LOGO_ICON && !LOGO_ICONS.some(icon => icon.lightSvg === svg)) setSvg(initialIcon && LOGO_ICONS.some(icon => icon.lightSvg === initialIcon) ? initialIcon : DEFAULT_STORE_LOGO_ICON); }} className={pillClass(custom ? 'quiet' : 'raised', 'sm')}>Library</button>
          <button type="button" aria-pressed={custom} onClick={() => setCustom(true)} className={pillClass(custom ? 'raised' : 'quiet', 'sm')}>Custom SVG</button>
        </div>
      </div>

      <div className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">Preview</span>
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <span aria-label="Logo" className="block size-14 shrink-0 [&>svg]:size-full" style={{ filter }} dangerouslySetInnerHTML={{ __html: safe }} />
        <span className="min-w-0 truncate font-serif text-2xl tracking-tight">{name || 'Storefront name'}</span>
      </div>
      </div>

      {custom ? (
        <label className={fieldLabelClass}>
          Custom SVG
          <textarea id="custom-logo" value={svg} onChange={event => setSvg(event.target.value)} maxLength={100000} spellCheck={false} aria-invalid={Boolean(svg && !safe)} className="min-h-32 w-full rounded-xl border bg-background p-3 font-mono text-xs text-foreground" />
          {svg && !safe ? <span role="alert" className="text-sm text-destructive">Invalid or unsafe SVG.</span> : null}
        </label>
      ) : (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Logo library</legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2">
            {[{ id: 'default', name: 'Default', lightSvg: DEFAULT_STORE_LOGO_ICON }, ...LOGO_ICONS].map(icon => {
              const selected = icon.lightSvg === svg;
              return (
                <label key={icon.id} title={icon.name} className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-xl border bg-background p-2 transition-shadow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${selected ? 'border-foreground shadow-[0_0_0_1px_currentColor]' : 'hover:bg-muted/50'}`}>
                  <input type="radio" name="logo-library" value={icon.id} checked={selected} onChange={() => setSvg(icon.lightSvg)} className="sr-only" aria-label={icon.name} />
                  <span aria-hidden="true" className="block size-full [&>svg]:size-full" style={{ filter }} dangerouslySetInnerHTML={{ __html: sanitizeStoreLogoSvg(icon.lightSvg) }} />
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <input type="hidden" name="logoIcon" value={svg} />

      <label htmlFor="logo-color" className={fieldLabelClass}>
        <span className="flex items-center justify-between">Colour <span className="tabular-nums">{hue}°</span></span>
        <input id="logo-color" name="logoColor" type="range" min="0" max="359" step="1" value={hue} onChange={event => setHue(event.target.value)} className="h-3 w-full cursor-pointer appearance-none rounded-full [background:linear-gradient(90deg,#155eef,#7a5af8,#dd2590,#f04438,#f79009,#66c61c,#06aed4,#155eef)] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow" />
      </label>
    </section>
  );
}
