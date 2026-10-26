# Salon (Morrow & Mane): full redesign, platform and storefront (2026-10-25/26)

Brief: `Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`. The owner ordered it with no approval round, so every impeccable decision point (init interview, direction round) was taken unattended. That is recorded in `PRODUCT.md` and the surface briefs.

Live: https://openfront-salon-production.up.railway.app (salon.openship.org once DNS is in).

## What it is now
- **Platform: "the front desk's book".**
  - Every operator screen opens on the work to do now: a title line with one truthful status and the primary action, then flat underline tabs with counts, then a dense table with a status column (dot plus word).
  - Pill tracks, 2xl cards and metric tiles that repeated the tab counts are gone. Radii are explicit 6px and 4px, because the shared dashboard theme sets `--radius` to 10px.
  - Signature: the Appointments day board, with one lane per stylist working today, their hours shaded, blocks placed by time and a now-line.
- **Storefront: "the colour room".**
  - A wall of professional colour-tube cartons on carton-white, with aluminium as the second neutral.
  - Each carton has a category band, a shade chip with a literal code (H1, S1), a photo window (or the shade at size when there is no photo), the name, wide duration and price numerals, and a Book strip.
  - Type is Archivo across its width axis. Corners are square; selection is a notch plus a tick; on phones a sticky booking tray holds the visit.
- **Shared dashboard shell:** byte-identical to E-commerce (parity drift 0).

## Process (impeccable first)
1. Before screenshots: live, desktop 1440 and phone 390 → `before/` (71 files).
2. impeccable `critique`: two isolated subagents, A (design review) and B (`impeccable detect` plus a radius sweep), synthesized in `CRITIQUE.md` and persisted to `.impeccable/critique/`. Platform scored 18/40, storefront 24/36.
3. impeccable `init`: `PRODUCT.md` inferred from the repo and the brief, with the inferences labelled.
4. Storefront direction: impeccable `concept-seed` (seed `seed:f30e665e26b25338`) assigned candidate 7 of 7 grounded worlds (the colour room). The six dealt challengers were weighed; each was declined, and its discipline was kept as a raise. Written to `.impeccable/surfaces/features-storefront.md`.
5. Platform direction: the roll was skipped on purpose, because the owner's brief pins the structure (quoted in `.impeccable/surfaces/features-platform.md`).
6. Build: I rewrote the shared platform kit. Three parallel agents then rebuilt platform group A, platform group B and the storefront.
7. Gates: tsc, unit tests, parity, the detector, and live checks for overflow and status. The live phone overflow (sr-only labels escaping unpositioned scroll wrappers) was fixed in `b1866a8`.
8. impeccable finish review: round 1 asked for a recapture; round 2 found 8 material fixes; the fix batch went out in `3c6a24c` and `14acfed`; the verdict pass scored all 8 resolved, with disposition **ship**.
9. impeccable documenter: `DESIGN.md` plus `.impeccable/design.json`, derived from the shipped CSS and components.

## Skills used, per screen, and what each changed

| Screen | Skills | What changed |
|---|---|---|
| Platform kit (`salon-ui.tsx`, `pill.ts`) | impeccable craft-floor and operate, minimalist-ui, emil-design-eng | Pill tracks became flat 6px buttons with a filled ink primary. Segment tabs became underline tabs. The metric strip became a one-line ledger. Added `DataTable`, `Td` and `StatusCell`. Press scale 0.98 at 150ms ease-out. Explicit pixel radii. |
| Appointments (list) | impeccable operate (task-first), industrial-brutalist-ui (hairline grid discipline only) | Day board with stylist lanes. Dense table: Time / Client / Services / Stylist / Status / Flags / Total / actions. Metric strip removed. Header shows "Next: 11:00 Jordan Lee". |
| New appointment, reschedule | hallmark (state discipline), impeccable operate | Order is service and stylist, then date and time, then client. The desk slot picker groups slots by morning, afternoon and evening and has retry. The existing/new-client toggle is a square radio group. |
| Appointment detail | impeccable craft-floor | Chips folded into the header meta; care and patch-test notice at the top. |
| Checkout queue and detail | impeccable operate | The client in the chair comes first, with the ticket inline. "Later today" is a table. Empty state links to a walk-in. |
| Sales list and detail | impeccable operate, hallmark | Find a sale by client or item. Table with refund state. Refund type is a square radio. |
| Clients list and detail | impeccable operate and clarify | Search over name, email and phone. Columns for visits, last visit and next appointment. Allergy and sensitivity alert at the top. Formulas first. Edit as a disclosure instead of a duplicated form. |
| Schedules | impeccable operate, emil-design-eng | "Working today" first, then the week grid. Fifteen "Block weekly" buttons became one Block menu per row. Time off is a table. |
| Catalog and service detail | impeccable operate | Services table (duration, price, buffer, stylists, online). Booking rules first. Edit and Storefront no longer look like tabs. |
| Waitlist, consultations, reviews, gift cards, loyalty, benefits, commissions, resources | impeccable operate and craft-floor, hallmark | Each opens on its task: add walk-in, pending forms, awaiting approval, lookup next to sell, lookup next to adjust, sell or enrol, owed per stylist, availability. Each is a table. "No one waiting" appears once, not three times. Deactivate no longer outweighs Record. |
| Inventory, reports, engagement, integrations, administration | impeccable operate and clarify | Low stock plus Record stock first. Takings by stylist and by service. The real exception first, with undelivered events grouped by type (raw ids behind a disclosure). Staff and locations listed once. |
| Staff (`/platform/staff`) | impeccable harden | Was a dead end that fell through to the generic item route. It now redirects to Staff & locations (no anchor, so the title stays in view). |
| Store settings | minimalist-ui | Square panels with a header band; logo tiles at 4px. |
| Storefront home | impeccable new-work and mode-persuade, frontend-design (two-pass token plan), design-taste-frontend (design read and dials 6/4/6) | Salon name at display size over the carton wall, with a 2x2 interior photo. Services are cartons whose band colour follows the category. The template hero copy, the stat row and the duplicate hours table are gone. |
| Services, stylists, gallery, reviews, memberships, gift cards, contact | impeccable craft-floor (eyebrow ban), frontend-design | Shelves of cartons. Bands carry only the shade code. Roles and categories sit under the name. Memberships, gift cards and account use ink bands. |
| Book | hallmark (mobile non-negotiables, states), emil-design-eng (one docking moment, 280ms) | Four labelled steps that stay labelled on phone. Notched and ticked selection. Sticky tray with Continue. Quiet footer. |
| Account | impeccable onboard | The sign-in form shows directly. Appointments are cartons. |

Skills the brief named that were read and only partly applied: high-end-visual-design and gpt-taste conflict with the owner's no-pill rule (pill buttons, eyebrow tags), so only their motion and spacing discipline was used. creative-director, color-expert (the OKLCH band ramp and contrast checks), apple-design and brand-extract informed choices but drove no separate screen.

## Checks (final state, `14acfed`)
- `tsc --noEmit` through heavy-exec: exit 0, 0 errors.
- Unit tests: `family-security` 14/0, `salon-workflows` 6/0, `shared-dashboard` 8/0 (pass/fail).
- `parity-check.py openfront-salon`: drift 0, missing 0, sidebar ok.
- `impeccable detect --json features/platform features/storefront`: `[]`.
- Live: every captured route returns 200 with overflowX 0 at 1440 and 390.

## Commits (master, auto-deployed)
- `e8b717e` Full redesign: salon platform as the front desk's book, storefront as the colour room
- `b1866a8` Platform: position every horizontal scroll wrapper so screen-reader labels can't widen phone pages
- `3c6a24c` Salon finish-review fixes: category-true carton bands, stylist lanes on the day board, status visible on phone
- `14acfed` Storefront: a carton without a photo shows its shade at size with its code, not an empty window

## Screenshots
- `before/`: 71 captures, Playwright Chromium, live.
- `after/`: 88 captures, Playwright WebKit (Chromium stopped loading pages on this machine on 2026-10-25). They cover every platform route and every storefront route, at desktop and phone. Storefront phone pages also have a `-viewport` shot showing the sticky bar in place. `after-report.json` has status and overflow per route.

## Open items
- Sale detail was never captured, because the demo has no sales; it was checked in code only. So were the phone menu's current-page underline and the day board on a day with no bookings.
- The documenter noted that the day board's "Now" flag (10px white on rose) is too small and too low-contrast to adopt as a standard. It is left as it is, and is not part of DESIGN.md.
- Unused leftovers from the plum world are still defined in CSS: `.sf-arch`, `.sf-ticket`, `--sf-accent*` aliases and `--sf-shadow-lift`. They render nothing wrong.
