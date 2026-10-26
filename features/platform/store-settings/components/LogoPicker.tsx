'use client';

import { useState } from 'react';
import { LOGO_ICONS } from '../lib/icon-registry';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ACCENT_SVG, DEFAULT_STORE_LOGO_ICON, isDefaultStoreLogo, normalizeStoreLogoColor, storeLogoAccent } from '@/features/lib/store-logo';
import { fieldLabelClass } from '../../components/pill';

// Adapted from Restaurant's LogoPicker: exact Untitled registry and shared allowlist.
export function LogoPicker({ initialIcon, initialColor, name }: { initialIcon?: string; initialColor?: string; name?: string }) {
  // An empty stored logo is what the storefront shows as the default mark, so preselect that.
  const [svg, setSvg] = useState(initialIcon || DEFAULT_STORE_LOGO_ICON);
  const [hue, setHue] = useState(normalizeStoreLogoColor(initialColor));
  const [custom, setCustom] = useState(Boolean(initialIcon && initialIcon !== DEFAULT_STORE_LOGO_ICON && !LOGO_ICONS.some(icon => icon.lightSvg === initialIcon)));
  const safe = sanitizeStoreLogoSvg(svg);
  const filter = `hue-rotate(${hue}deg)`;
  // Matches StoreBrand: the default mark renders in the accent derived from the colour, library marks are hue-rotated.
  const markStyle = (icon: string) => isDefaultStoreLogo(icon) ? { color: storeLogoAccent(hue) } : { filter };
  const markSvg = (icon: string) => isDefaultStoreLogo(icon) ? DEFAULT_STORE_LOGO_ACCENT_SVG : sanitizeStoreLogoSvg(icon);

  return (
    <section className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-1.5">
        <h2 className="text-[13px] font-semibold">Logo & colour</h2>
        <div role="group" aria-label="Logo source" className="inline-flex h-8 overflow-hidden rounded-[6px] border border-input bg-background">
          {[{ value: false, label: 'Library' }, { value: true, label: 'Custom SVG' }].map(option => (
            <button key={option.label} type="button" aria-pressed={custom === option.value} onClick={() => {
              if (option.value) { setCustom(true); return; }
              setCustom(false);
              if (svg !== DEFAULT_STORE_LOGO_ICON && !LOGO_ICONS.some(icon => icon.lightSvg === svg)) setSvg(initialIcon && LOGO_ICONS.some(icon => icon.lightSvg === initialIcon) ? initialIcon : DEFAULT_STORE_LOGO_ICON);
            }} className={`px-3 text-xs font-medium transition-colors first:border-r focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${custom === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>{option.label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 p-4">

      <div className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">Preview</span>
      <div className="flex items-center gap-4 rounded-[6px] border bg-muted/30 p-4">
        <span aria-label="Logo" className="block size-14 shrink-0 [&>svg]:size-full" style={markStyle(svg)} dangerouslySetInnerHTML={{ __html: safe ? markSvg(svg) : '' }} />
        <span className="min-w-0 truncate font-serif text-2xl tracking-tight">{name || 'Storefront name'}</span>
      </div>
      </div>

      {custom ? (
        <label className={fieldLabelClass}>
          Custom SVG
          <textarea id="custom-logo" value={svg} onChange={event => setSvg(event.target.value)} maxLength={100000} spellCheck={false} aria-invalid={Boolean(svg && !safe)} className="min-h-32 w-full rounded-[6px] border border-input bg-background p-3 font-mono text-xs text-foreground outline-none focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/30" />
          {svg && !safe ? <span role="alert" className="text-sm text-destructive">Invalid or unsafe SVG.</span> : null}
        </label>
      ) : (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Logo library</legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2">
            {[{ id: 'default', name: 'Default', lightSvg: DEFAULT_STORE_LOGO_ICON }, ...LOGO_ICONS].map(icon => {
              const selected = icon.lightSvg === svg;
              return (
                <label key={icon.id} title={icon.name} className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-[4px] border bg-background p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${selected ? 'border-foreground bg-muted/60 outline outline-1 outline-foreground' : 'hover:border-foreground/30 hover:bg-muted/50'}`}>
                  <input type="radio" name="logo-library" value={icon.id} checked={selected} onChange={() => setSvg(icon.lightSvg)} className="sr-only" aria-label={icon.name} />
                  <span aria-hidden="true" className="block size-full [&>svg]:size-full" style={markStyle(icon.lightSvg)} dangerouslySetInnerHTML={{ __html: markSvg(icon.lightSvg) }} />
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <input type="hidden" name="logoIcon" value={svg} />

      <label htmlFor="logo-color" className={fieldLabelClass}>
        <span className="flex items-center justify-between">Colour <span className="tabular-nums">{hue}°</span></span>
        <input id="logo-color" name="logoColor" type="range" min="0" max="359" step="1" value={hue} onChange={event => setHue(event.target.value)} className="h-3 w-full cursor-pointer appearance-none rounded-[4px] [background:linear-gradient(90deg,#155eef,#7a5af8,#dd2590,#f04438,#f79009,#66c61c,#06aed4,#155eef)] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow" />
      </label>
      </div>
    </section>
  );
}
