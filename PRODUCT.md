# Product

<!-- impeccable:product-schema 1 -->

Inferred on 2026-10-25 from the repository and the owner's redesign brief (`Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`). The owner ordered the work without an interview round; every fact below is taken from code, seed data or the brief.

## Platform

web

## Users
- **Front desk and salon owner** (dashboard, `/dashboard/platform/*`): run the day's book, confirm and check clients in, take payment at checkout, refund sales, work the waitlist, review consultations and reviews, set stylist hours and time off, manage services, gift cards, loyalty, memberships, commissions and settings. Desktop at the desk, sometimes a phone on the floor.
- **Stylists and estheticians**: see their own appointments and schedule.
- **Clients** (storefront): browse services and stylists, book an appointment, manage or cancel it from their account, buy gift cards and memberships. Mostly on a phone.

## Product Purpose
A self-hostable booking and salon-operations application: online booking for clients, and the operating dashboard for the salon (book, checkout, client history, retail inventory, memberships, packages, commissions).

## Operating Context
- The day is organised around the appointment book: pending → confirmed → in chair → completed, with cancellations and no-shows.
- Checkout settles a completed appointment (service lines, retail, tips, gift card or membership benefits).
- Services carry duration, price and a turnover buffer; stylists carry weekly hours and time off; resources (chairs, rooms) can be booked.
- Times are shown in the salon's timezone.

## Capabilities and Constraints
- Next.js + Keystone 6. The shared dashboard shell (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes) must stay byte-identical to Openfront E-commerce.
- Platform screens live in `features/platform/**`; storefront in `features/storefront/**` and `app/(storefront)/**`.
- No new environment variables; onboarding and seed files are not edited by design work.

## Brand Commitments
- The storefront brand is the merchant's: name, logo, theme hue and imagery come from store settings (demo: Morrow & Mane, San Francisco). Design must work for any merchant name and hue.
- Platform UI: no pill-shaped or heavily rounded tabs, chips or cards; radii ≤ 6px; flat or underline tabs (owner, 2026-10-25).

## Evidence on Hand
- Seed imagery in `public/images/salon/` (interior, stylist portraits, service photos); seed services, stylists, hours and reviews in `features/platform/onboarding/lib/seed.json`.
- No real testimonials, press or awards beyond seeded reviews; none may be invented.

## Product Principles
1. The book is the product: every operator screen answers "what needs doing now" before anything else.
2. Truthful labels: counts, "most booked", "open now" must come from real data.
3. Clients book in as few steps as possible on a phone.
4. Keep every route, state and workflow when changing presentation.
