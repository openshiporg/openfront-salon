---
name: Openfront Salon
description: A colour room of labelled tube cartons for clients, and the front desk's book for the salon.
colors:
  carton-paper: "oklch(98.4% 0.005 28)"
  carton-paper-2: "oklch(95.8% 0.007 28)"
  aluminium: "oklch(91% 0.005 245)"
  aluminium-2: "oklch(86.5% 0.007 245)"
  ink: "oklch(20% 0.012 250)"
  ink-2: "oklch(35% 0.012 250)"
  ink-3: "oklch(45% 0.012 250)"
  rule: "oklch(85% 0.006 245)"
  rule-strong: "oklch(68% 0.01 245)"
  on-band: "oklch(99% 0.004 28)"
  band-1: "oklch(52% 0.165 28)"
  band-2: "oklch(51% 0.13 178)"
  band-3: "oklch(50% 0.15 258)"
  band-4: "oklch(53% 0.14 83)"
  band-5: "oklch(50% 0.15 328)"
  band-6: "oklch(51% 0.12 133)"
  focus: "oklch(48% 0.17 28)"
  open: "oklch(52% 0.14 150)"
  warn: "oklch(60% 0.14 70)"
  danger: "oklch(48% 0.17 27)"
  desk-status-confirmed: "#10b981"
  desk-status-pending: "#f59e0b"
  desk-status-in-chair: "#3b82f6"
  desk-status-completed: "#a1a1aa"
  desk-status-cancelled: "#f43f5e"
  desk-status-no-show: "#f97316"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 13vw, 9.5rem)"
    fontWeight: 800
    lineHeight: 0.84
    letterSpacing: "0"
    fontVariation: "\"wdth\" 66"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 8vw, 5.5rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "0"
    fontVariation: "\"wdth\" 66"
  section-title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5.4vw, 4rem)"
    fontWeight: 800
    lineHeight: 0.9
    fontVariation: "\"wdth\" 66"
  carton-name:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 0.9rem + 0.9vw, 1.5rem)"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "\"wdth\" 68"
  figures:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 15cqi, 2.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\", \"lnum\""
    fontVariation: "\"wdth\" 125"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    letterSpacing: "0.04em"
    fontVariation: "\"wdth\" 78"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "\"wdth\" 100"
  desk-title:
    fontFamily: "shell sans (dashboard font stack)"
    fontSize: "1.375rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  desk-body:
    fontFamily: "shell sans (dashboard font stack)"
    fontSize: "0.875rem"
    fontWeight: 400
  desk-label:
    fontFamily: "shell sans (dashboard font stack)"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  carton: "2px"
  desk: "6px"
  desk-block: "4px"
spacing:
  3xs: "0.25rem"
  2xs: "0.5rem"
  xs: "0.75rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2.25rem"
  xl: "3.25rem"
  2xl: "clamp(3.5rem, 8vw, 6rem)"
  3xl: "clamp(4.5rem, 10vw, 8rem)"
  wall-gap: "0.5rem"
  wall-gap-md: "0.625rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.carton-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.carton}"
    padding: "0 1.125rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-outline:
    backgroundColor: "{colors.carton-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.carton}"
    padding: "0 1.125rem"
    height: "2.75rem"
  button-outline-hover:
    backgroundColor: "{colors.aluminium}"
  carton:
    backgroundColor: "{colors.carton-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.carton}"
  carton-band:
    backgroundColor: "{colors.band-1}"
    textColor: "{colors.on-band}"
    height: "3.75rem"
    padding: "0.625rem 0.75rem"
  carton-action-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.carton-paper}"
    height: "2.75rem"
  input:
    backgroundColor: "{colors.carton-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.carton}"
    padding: "0.625rem 0.75rem"
    height: "2.875rem"
  tray:
    backgroundColor: "{colors.aluminium}"
    textColor: "{colors.ink}"
    padding: "0.625rem 1rem"
  slot-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.carton-paper}"
    height: "2.75rem"
  desk-button-primary:
    typography: "{typography.desk-body}"
    rounded: "{rounded.desk}"
    padding: "0 0.75rem"
    height: "2rem"
  desk-button-sm:
    typography: "{typography.desk-label}"
    rounded: "{rounded.desk}"
    padding: "0 0.625rem"
    height: "1.75rem"
  desk-input:
    typography: "{typography.desk-body}"
    rounded: "{rounded.desk}"
    padding: "0 0.625rem"
    height: "2.25rem"
  desk-table-header:
    typography: "{typography.desk-label}"
    padding: "0 0.75rem"
    height: "2.25rem"
  desk-board-block:
    rounded: "{rounded.desk-block}"
    padding: "0 0.375rem"
    height: "40px"
---

# Design System: Openfront Salon

## Overview

**Creative North Star: "The Colour Room and the Book"**

The client storefront is the salon's colour room: a wall of professional colour-tube cartons on carton-board white, each service a carton with a solid shade band across its top, its name in condensed caps, its duration and price in wide heavy numerals, and a Book control along its foot. Clients pull a carton and are booking within one tap. Stylists, reviews and the gallery are other shelves of the same room, named by their plain names. Everything is square, hairline-edged and literally labelled; the only saturated colour is the band, and the band owns real area.

The operator platform is the front desk's book. It lives inside the shared dashboard shell and borrows the shell's neutral palette and sans; its own character comes from structure, not colour: a title line with one truthful status and the primary action at right, underline filter tabs with counts, dense tables with a status column, and on Appointments a day board with a lane per stylist and a now-line. Status colour appears only where it carries meaning, as a dot beside a word.

The storefront refuses the dark-luxury editorial salon (plum ground, Didone display, arched portraits) and the cream spa page. The platform refuses the SaaS tile-and-card template (metric tiles over pill tabs over a card list). The merchant's name, logo and hue come from store settings; every storefront colour except the neutrals rotates from that hue, so the room works for any salon.

**Key Characteristics:**
- One family, Archivo, driven along its width axis: condensed for names, wide for numerals, normal for body.
- Category shade bands are the only saturated colour; a category keeps one shade on every page.
- Square corners (2px) on the storefront; 6px controls and 4px board blocks on the platform; nothing pill-shaped.
- State is a mark, not a hue: notched and ticked selection, struck-through unavailability, dot plus word for status.
- Aluminium-grey trays (footer, book bar, booking tray, slot well) are the second neutral.
- The shared dashboard shell is never restyled.

## Colors

A near-colourless room of carton board, aluminium and ink, with six category shades rotated from the merchant hue doing all of the colour work. Values below are resolved at the default hue (28); in code every hue-bearing token is `oklch(L C calc(var(--sf-theme-hue) + offset))`.

### Primary
- **Category Shade Bands** (band-1 to band-6): six shades at lightness 50-53% so white text on them passes 4.5:1. Band 1 sits on the merchant hue; bands 2-6 rotate +150, +230, +55, +300 and +105 degrees. A category's shade comes from its rank in the owner's display order across the whole catalogue (`features/storefront/lib/bands.ts`), so it is the same on home, /services, /book and the gallery. Non-service cartons (memberships, gift cards, account, not-found) take an ink band. Band 1 also marks the current nav link, review bars, text selection and link hover.

### Neutral
- **Carton Paper** (carton-paper): the page ground and every carton face; white with a trace of the merchant hue.
- **Carton Paper Shade** (carton-paper-2): disabled field fill.
- **Aluminium** (aluminium, aluminium-2): the second neutral. Footer, phone book bar, booking tray, slot well, aluminium shelves, image wells and button hover. aluminium-2 is its edge.
- **Ink** (ink, ink-2, ink-3): primary text, primary buttons, selected states, structural rules; ink-2 for secondary copy and primary hover; ink-3 for muted text and placeholders.
- **Rules** (rule, rule-strong): hairline dividers and carton edges.
- **On-Band White** (on-band): text and marks printed on a band.

### Status
- **Open** (open), **Warn** (warn), **Danger** (danger), **Focus** (focus): storefront open state, the "booking opens soon" notice, field errors and alerts, and the 2px focus outline.
- **Desk status tones** (desk-status-*): the platform's appointment states, from the Tailwind palette with dark-mode pairs: pending amber, confirmed emerald, in chair blue, completed zinc, cancelled rose, no-show orange. Used as an 8px dot beside a word and as the tinted fill (50 step) with 300-step edge of a day-board block.

### Named Rules
**The Band Owns The Colour Rule.** On the storefront the category band is the only saturated colour, and it owns area (a 60px band, or a full shade swatch window when there is no photo), never a dot-sized accent.

**The Shade Belongs To The Category Rule.** A band shade is assigned by category rank, never by grid position. Two cartons of the same category always match; the shade chip prints a literal code (category initial plus number, "H2").

**The Shell Palette Rule.** Platform screens use the shell's neutral tokens (`foreground`, `background`, `muted`, `border`, `ring`) and add colour only through the status tones.

## Typography

**Display Font:** Archivo (variable, `wdth` axis, loaded via `next/font` as `--font-sf`, falling back to system-ui)
**Body Font:** Archivo at normal width
**Platform Font:** the dashboard shell's sans, unchanged

**Character:** Hierarchy comes from the size and width of one face alone, like a lineup poster: tall condensed caps for names, squat wide numerals for figures, a plain normal-width body.

### Hierarchy
- **Display** (800, `wdth` 66, clamp(3.25rem, 13vw, 9.5rem), line-height 0.84, uppercase): the salon's name in the home name band.
- **Headline** (800, `wdth` 66, clamp(2.5rem, 8vw, 5.5rem), 0.9, uppercase): page titles over a 3px ink rule.
- **Section title** (800, `wdth` 66, clamp(2.25rem, 5.4vw, 4rem), 0.9, uppercase): shelf and section heads over a 1px ink rule.
- **Carton name** (800, `wdth` 68, clamp(1.125rem, 0.9rem + 0.9vw, 1.5rem), 0.95, uppercase): service, stylist and offer names; the mobile menu and tray use the same width.
- **Figures** (800, `wdth` 125, tabular lining numerals, -0.02em): duration and price. Sized to the carton with container units (duration clamp(1.25rem, 15cqi, 2.5rem), price clamp(0.8125rem, 9cqi, 1.25rem)) so both stay on one line on a narrow phone carton. Units ("min", "from") drop to 0.42em at `wdth` 85, uppercase. Booking dates, step numbers, slots (`wdth` 110) and the swatch code use the same wide register.
- **Label** (700, `wdth` 74-78, 0.9375rem, 0.04-0.05em, uppercase): buttons, carton actions, nav links, tabs, booking steps (`wdth` 70 at 0.8125rem).
- **Body** (400, `wdth` 100, 1rem, 1.55): running text; leads at 1.0625rem, max 60ch.
- **Platform** (shell sans): page title 600 at 1.25rem rising to 1.375rem, tight tracking; body and table cells 0.875rem; table headers, field labels and tab counts 0.75rem at 500; status cell words 13px at 500; dense chips and board meta 11px.

### Named Rules
**The One Family Rule.** The storefront uses Archivo only. Change width and weight, never the family.

**The No Kicker Rule.** No eyebrows or kicker labels above headings. Shelves carry their plain name at section-title size; meta lines sit under a name, not over it.

## Layout

The storefront container is min(100% - 2rem, 80rem), with a 40rem narrow container for forms. Vertical rhythm comes from the space scale (pages pad 2.25rem top and clamp(3.5rem, 8vw, 6rem) bottom; shelves pad 3.25rem).

**The wall.** Cartons sit in a grid with tight 0.5rem gaps (0.625rem from 768px): two columns on phones, three from 768px, four from 1100px. On the home wall the interior photograph spans 2x2 from 768px and is a full-width carton after the first two cartons on phones. Shelf grids follow the same columns; a 1-2-3 variant steps at 640px and 1024px.

**The bars.** The nav is sticky (3.75rem high) over a 1px ink rule; the services category rail sticks under it. Phones get a fixed aluminium book bar on browsing pages (hidden from 640px) and, on /book, the tray (hidden from 1024px, where a 21rem sticky summary aside takes over). Pages reserve bottom padding for whichever bar is present.

**The platform page.** Inside the shell: breadcrumbs, then a column (max-width 80rem, or 56rem narrow) with 1.25rem gaps and 1.5rem side padding from md. Order is fixed: title line with status and actions, underline tabs, then the work as a table. Appointments/Today puts the day board above the table. Wide content scrolls horizontally inside a positioned wrapper, never the page.

## Elevation & Depth

Flat: no drop shadows anywhere. Depth is carried by rules and by the aluminium second ground. Selection uses an inset 1px ink ring, and the only movement off the wall is the pulled carton's 3px lift. Section weight is a rule weight: 3px ink under page titles, the name band and the footer top; 1px ink under section heads and the nav; hairlines on cartons.

### Named Rules
**The Rule Weight Rule.** Hierarchy between regions is a thicker ink rule (1px or 3px), never a shadow or a tinted card.

## Shapes

The storefront is square: every carton, button, field, chip and media frame has a 2px corner, and swatches, shade chips, ticks, status dots and the week grid have none. The one cut shape is the notch: a selected carton or stylist pick is clipped at its top-right corner by 1.25rem (a selected time slot by 0.625rem). The platform uses 6px on buttons, inputs, tables, panels and notices, and 4px on chips, board blocks and the now flag. The dashboard's own `--radius` is 10px (0.625rem), so platform code always states its radius explicitly (`rounded-[6px]`, `rounded-[4px]`) instead of the shell's `rounded-md`/`rounded-lg`. Circles are reserved for status dots, avatars and the slider thumb.

## Components

### Buttons
Storefront buttons are flat printed labels.
- **Shape:** square (2px), 2.75rem minimum height, 1px ink edge.
- **Primary:** ink fill, carton-paper text, label type, 0 1.125rem padding.
- **Outline (default):** carton-paper fill, ink text and edge; aluminium on hover.
- **Quiet:** transparent with a rule-strong edge.
- **Press:** scale(0.97) over 140ms ease-out; disabled at 45% opacity. Pressed or selected toggles go solid ink.

Platform buttons (`pillClass`, name kept from the earlier kit):
- **Shape:** 6px, 2rem high (1.75rem small), 0.875rem text at 500.
- **Primary:** filled shell foreground on background, 85% on hover. **Raised:** bordered background, muted hover. **Danger:** rose edge and text. **Quiet:** text only, muted hover.
- **Press:** scale(0.98), 150ms; 2px ring focus.

### Chips
- **Storefront:** a square label, 1.75rem high, 1px rule-strong edge, 0.8125rem at 600; the accent variant has an ink edge (consultation and patch-test notices on a carton).
- **Platform:** 1.25rem high, 4px, bordered on a faint muted fill, 11px at 500, optional status dot.

### The Carton (signature)
A colour-tube carton, top to bottom:
1. **Band:** 3.75rem solid category shade, carrying only the shade chip at the right end (no label). The chip is a lighter sample of the band (45% band in on-band white) with a white hairline outline; with a code it widens and prints it in ink at 800, `wdth` 80. On an ink band the tick reverses to white.
2. **Window or swatch:** a 2:1 window onto the service photo over aluminium; with no photo, a swatch of the carton's own shade (82% band) printing the code in wide numerals at 2.25-3.5rem. Stylist cartons use a 4:5 portrait window.
3. **Body:** 0.75rem padding; carton name (hover underlines it 2px in the band colour), an optional meta line under the name, tags, then figures pinned to the foot: duration left, price right, one line.
4. **Action:** a full-width 2.75rem "Book" strip under a 1px ink rule; ink fill and a 3px arrow nudge on hover.

Pulling: a carton with an action lifts 3px on hover (fine pointers only) and settles to -1px, scale 0.985 on press, 150ms ease-out; reduced motion keeps it still. An empty shelf is still a carton: a 0.75rem band across the top, then the message.

### Selection: notch and tick
Selected cartons and stylist picks gain an ink edge, an inset 1px ink ring, the top-right notch and a 1.5rem ink tick square with a check in place of the shade chip. Selected slots and dates go solid ink (slots also notch). Days a stylist is off are struck through on the week grid, and cancelled or no-show blocks on the day board are struck through, so state never depends on hue alone.

### The Tray (signature)
On /book on phones the chosen carton docks into a fixed aluminium tray at the bottom of the screen: 3px ink top rule, a 0.5rem band-coloured spine, the carton name in condensed caps, meta and figures, and Continue. It slides up from 100% over 280ms on cubic-bezier(0.23, 1, 0.32, 1) and respects the safe-area inset.

### Inputs / Fields
- **Style:** 2.875rem high, 1px rule-strong edge, 2px corners, carton-paper fill, 1rem text; labels at 600, hints at 400 in ink-3.
- **Focus:** ink edge plus a 1px ink ring; hover darkens the edge to ink-3.
- **Error / Disabled:** danger edge on `:user-invalid`; disabled fills with carton-paper-2. Alerts are a danger-edged pale red box; notes are aluminium.
- **Platform:** 2.25rem high, 6px, input border, 0.875rem; focus darkens the border and adds a 2px ring at 30%.

### Navigation
- **Storefront nav:** sticky carton-paper bar over a 1px ink rule; the salon name in condensed caps; links in label type with a 3px bottom border (rule-strong on hover, band 1 on the current page). The phone menu is a sheet of 3.25rem rows in 1.5rem condensed caps, current page underlined 3px in band 1. The services rail uses the same underline tabs, hovering in each category's shade.
- **Platform tabs:** flat underline tabs over a 1px border, 2.25rem high, 1.25rem apart; the active tab carries a 2px foreground rule and its count in tabular figures. They scroll horizontally on phones.

### Booking steps
Four equal cells 2px apart, 2.75rem high, condensed caps with a wide step numeral; done steps get an ink edge and are clickable, the current step is solid ink.

### Platform tables and panels
- **Table:** 6px bordered wrapper that scrolls horizontally; 2.25rem headers at 0.75rem on a 40% muted fill; cells 0.75rem by 0.625rem with bottom hairlines and none on the last row.
- **Status cell:** an 8px dot with a 3px tinted outline beside the word (13px, 500). Never a coloured pill.
- **Panel:** 6px bordered section with a hairline header band (min 2.5rem, 30% muted fill, 13px semibold title) and 1rem body padding.
- **Empty state:** dashed 6px box with an icon, one line and an optional action. **Error state:** amber 6px box with a dot-led title and a recovery action.

### The Day Board (signature)
A lane per stylist on a horizontal time axis inside a 6px bordered section. A 2rem hour header on a muted fill; a sticky 8-10rem name column with each stylist's working windows and appointment count; working windows shaded muted; hourly hairlines. Each appointment is a 4px block placed by start and duration in a 44px lane row, filled with its status tone (50 step, 300 edge, darker on hover), client name at 12px semibold over time and services at 11px; cancelled and no-show blocks are struck through. A 1px rose now-line crosses the lanes with a small "Now" flag. Below 46rem it scrolls inside its frame.

## Do's and Don'ts

### Do:
- **Do** give every service a carton with band, shade chip code, window or swatch, name, figures and a Book action linking to /book with that service.
- **Do** derive every band from `--sf-theme-hue` and the category's rank, so any merchant hue and catalogue order produce a consistent room.
- **Do** set names in condensed caps (`wdth` 66-68, 800) and figures in wide numerals (`wdth` 125, 800, tabular).
- **Do** show selection as a notch plus a tick, and unavailability as strike-through.
- **Do** keep storefront corners at 2px and state platform radii explicitly as 6px (4px for chips and board blocks).
- **Do** show platform status as a dot plus a word in a status column.
- **Do** open every platform page on the title line, underline tabs with counts, then the work table.

### Don't:
- **Don't** add a second saturated colour, gradient or tinted card to the storefront; colour belongs to the bands.
- **Don't** assign band shades by grid position.
- **Don't** use pill shapes, `rounded-full` controls or the shell's `rounded-md`/`rounded-lg` (8-10px here) on salon UI; circles are for dots and avatars only.
- **Don't** put eyebrows or kicker labels over headings.
- **Don't** bring back the plum ground, Didone display or arched portraits.
- **Don't** build platform pages from metric tiles over pill tabs over card lists.
- **Don't** edit the shared dashboard shell (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes, `app/dashboard/globals.css`); salon styling lives in `features/platform/**` only.
