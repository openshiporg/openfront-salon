# Salon (Morrow & Mane): storefront redesign (2026-10-25)

Brief: `Euler/state/briefs/design-skills-redesign-2026-10-25.md` (Openfront Batch 2, storefront only).

**Live:** https://openfront-salon-production.up.railway.app (salon.openship.org once DNS is added)

## The world
**The colour bar after hours.**
- **Ground:** a deep plum-black, with a fine fixed grain so it reads as a material.
- **Ink:** warm bone.
- **Accent:** copper that follows the merchant's logo hue (`--sf-theme-hue`).
- **Type:** Bodoni Moda display (high-contrast fashion editorial) over Hanken Grotesk.
- **Motif:** the colour-bar swatches stay the one recurring motif. Mirror arches stay for stylist portraits.

## What changed
- `styles/storefront-tokens.css`: new dark token world; tighter radii; dark shadows.
- `styles/storefront.css`: editorial split hero (the salon floor bleeds to the viewport edge, with a colour-service arch over the seam); categories as a colour-bar list of rows instead of cards; footer as a deeper band with a colour-bar strip; display type rules for Bodoni; page ground under overscroll.
- `screens/HomePage.tsx`: hero media markup; category arrow; review quotes on rules instead of cards.
- `screens/MainLayout.tsx`: Fraunces to Bodoni Moda.
- All titles: removed the one-italic-accent-word treatment; the words are unchanged.

Every route, state and workflow is unchanged: no route, data loader, server action, form field or test was removed or renamed. The shared dashboard shell and platform pages were not touched.

## Skills used, and how
- **impeccable**: read SKILL.md and set the surface modes: Persuade for the home page, Operate for booking, cart, checkout and account. Its "redesign replaces, it doesn't polish the old look" rule set the scope: a new world (ground, type, shape, signature motif), with every route, state and workflow kept. Its design hook scanned each stylesheet as it was written and reported no deterministic issues. I did **not** run `/impeccable init`, `critique` or `polish` as separate commands.
- **frontend-design**: the two-pass plan (palette of named tokens, type roles, layout sketch, principles), then a review of that plan against its list of generated-design defaults. That review removed the single italic accent word in headlines (salon), dropped 01/02 numbering on a list that isn't a sequence (vape) and kept the "near-black plus one acid accent" look out of every palette: accents are the merchant's own hue, lifted for dark and softened.
- **design-taste-frontend (tasteskill v2)**: the "idea comes from the subject" inventory. Each world comes from a physical object in the business. I didn't run its `draw.mjs` or `inspect.mjs` scripts; the live Playwright check below did that job.
- **high-end-visual-design / emil-design-eng**: custom ease-out curves only; transform and opacity motion; grain and blur kept to fixed layers; reduced motion respected (the existing guards were kept).
- **mobile-native**: 44px+ targets, `100svh`/`dvh` instead of `100vh` for heroes, no horizontal scroll at 390px (measured: overflowX=0 on every captured page).
- **Tessier as the bar**: near-black but never flat grey, off-white ink, one restrained accent, few radii, product and photography carrying the colour.

## Checks
- `tsc --noEmit`: exit 0, 0 errors (through heavy-exec).
- `node --test tests/salon-workflows.test.cjs`: 6 pass, 0 fail.
- `parity-check.py openfront-salon`: drift 0, missing 0, sidebar ok.
- Live: every captured route 200, overflowX 0 at both widths.

## Commits (pushed to `master`, auto-deployed)
- `d258661` Storefront redesign: the colour bar after hours
- `5bef2bd` Keep the hero copy inside the container on desktop; seat the colour arch on the photo on phones

## Screenshots (Playwright 1.62, 1440x900 desktop and 390x844 phone, full page)
Before, in `design/before-20261025/`:
- `before-book-desktop.jpg`
- `before-book-phone.jpg`
- `before-home-desktop.jpg`
- `before-home-phone.jpg`
- `before-services-desktop.jpg`
- `before-services-phone.jpg`

After (live), in `design/after-20261025/`:
- `after-account-desktop.jpg`
- `after-account-phone.jpg`
- `after-book-desktop.jpg`
- `after-book-phone.jpg`
- `after-home-desktop.jpg`
- `after-home-phone.jpg`
- `after-services-desktop.jpg`
- `after-services-phone.jpg`
- `after-team-desktop.jpg`
- `after-team-phone.jpg`

## Notes
A parallel session (`demo-data-reset-2026-10-25.md`) reset this demo's database and is re-onboarding it with the full seed while this redesign shipped. The before shots were taken during or after that reset, so they may show an empty or not-configured store rather than the old design with data. The old design is in git (the parent of the first commit below). Salon was re-seeded before the after shots, so they show the real demo content.
