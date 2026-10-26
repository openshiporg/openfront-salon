---
target: salon platform + storefront
total_score: 42
max_score: 76
na_heuristics: storefront 9
p0_count: 1
p1_count: 5
target_identity: "file:/Users/junaid/Code/openfronts/openfront-salon/features/platform"
timestamp: 2026-10-26T02-11-34Z
slug: features-platform
---
Method: dual-agent (A: design review subagent · B: detector subagent)

# Salon critique, before the 2026-10-25 full redesign

Evidence: live demo screenshots in `design/2026-10-25-full/before/` (desktop 1440, phone 390), source in `features/platform/**` and `features/storefront/**`.

## Scores (Nielsen, 0–4)
Platform: 18/40. Status 2 · real world 2 · control 2 · consistency 1 · error prevention 2 · recognition 2 · efficiency 1 · minimalist 2 · error recovery 1 · help 3.
Storefront: 24/36 (error recovery n/a, no error states captured). Status 3 · real world 3 · control 2 · consistency 2 · error prevention 3 · recognition 3 · efficiency 2 · minimalist 2 · help 2.

## Design specificity
- Platform: interchangeable. Every route is icon tile + H1 + green dot, a 2xl metric strip, a pill segment track, then a dashed empty card or stacked 2xl panels. The kit itself (`pill.ts` trackClass/pillClass `rounded-full`, `salon-ui.tsx` 2xl panels) is the owner's "rounded tabs" complaint. Nothing salon-specific: no chair-by-chair day view, no allergy/patch-test warning at the point of action.
- Storefront: atmospheric (dark plum, Didone) but template-shaped: product copy in the hero, "4 services / 3 stylists" stat trope, gradient category orbs, no imagery on service rows, every page ends in the same giant "Book a visit" block (including /book and /account).

## Detector (impeccable detect)
- platform: 1 advisory, `bounce-easing` at `workspaces/screens/SalonRecordManager.tsx:139` (`animate-bounce` chevron as a saving indicator).
- storefront: clean.
- Radius sweep: 103 `rounded-full|2xl|xl|lg` hits across 35 platform files (18 full, 37 2xl, 33 xl, 15 lg); the circles (status dots, avatars, slider thumb) are legitimate.
- Browser overlay skipped: no mutable browser automation exposed.

## Priority issues: platform
- P0 staff detail (`/platform/staff/[id]`) reported as "Something went wrong" (dead end).
- P1 pill and 2xl language in the kit (owner complaint). Primary buttons render the same as secondary.
- P1 Appointments does not serve the front desk's first 10 seconds: count tiles duplicate 8 tabs, no time/stylist view, no date stepping.
- P1 lists are 65px card rows, not dense tables; Clients has no search, last visit or next appointment.
- P2 client detail buries allergies/sensitivities/formulas; edit form duplicates the profile.
- P2 Integrations/Engagement dump 32 raw pending events with ids; the real exception ("payment provider not installed") is buried.

## Priority issues: storefront
- P1 reads like a template, not a salon (hero copy, stat trope, no proof, no service imagery).
- P1 auth state contradicts across /book and /account (investigate; presentation only if it is a display bug).
- P2 booking on phone: unlabelled step numbers, summary below the whole list, marketing footer on /book.
- P2 /account needs a click before any form appears.
- P3 repetition: "Book a visit" block on every page, hours table twice on home.

## Persona red flags
- Front desk (power user): no search on Clients, no date navigation, walk-in → checkout spans three full pages.
- New owner: two different "waitlists", "Events not delivered 32" means nothing.
- Stylist on phone: 5-tile metric grid above the list, tabs clip, floating AI button covers controls.
- First-time colour client on phone: no patch-test/deposit info before booking, unlabelled steps.

## Per-route main task (first 10 seconds)
appointments: today's chair-by-chair schedule and who's next (not served) · appointments/new: book a client into a slot (partial) · checkout: ring up the client in the chair (not served) · sales: find a sale to refund (partial) · clients: find a client by name/phone (not served) · clients/[id]: allergies, formulas, last visit, book again (partial) · engagement: who to contact (not served) · waitlist: add walk-in, wait order (served) · consultations: review pending forms (served) · loyalty: look up/adjust points (partial) · reviews: approve pending (served) · catalog: edit price/duration (partial) · catalog/[id]: booking rules and price (partial) · benefits: sell/enrol (served) · gift-cards: sell or check balance (partial) · inventory: what is low, record stock (partial) · schedules: who works today/this week, time off (mostly) · resources: room/station availability (served) · administration: staff and locations (partial) · staff/[id]: view/edit stylist (broken) · commissions: what is owed per stylist (partial) · reports: takings by stylist and service (not served) · integrations: fix what is failing (not served) · store-settings: name, logo, hours, location (partial).

Questions skipped: the owner ordered the redesign directly with no approval stops (brief `batches-2-6-full-redesign-2026-10-25.md`); all P0–P2 issues are taken as in scope.
