---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: ["app/(storefront)"]
---

# Storefront (features/storefront, app/(storefront))

Mode: Persuade on home, services, team, gallery, reviews; Operate on book, account, booking confirmation, gift cards, memberships.
Audience: a client on a phone in daylight choosing a hair, colour or skin service and booking it. Action: start a booking with a chosen service (working form, not a link elsewhere).
Constraints: keep every route, state, workflow, data loader, server action and form field; merchant name, logo, hue and imagery come from settings; no invented claims (no awards, press, founders, neighbourhood story beyond store settings).
Decision: owner ordered the redesign with no approval round (2026-10-25); the assigned direction was taken unattended, code-led (no image generation on this machine).

## Direction contract

THESIS: The salon's colour room, where professional colour lives as a wall of labelled tube cartons; the storefront is that wall, and each service is a carton you pull to book. It refuses the dark-luxury editorial salon (plum ground, Didone display, arched portraits) and the cream spa page.

OWN-WORLD: Carton-board white ground (oklch ~98% with a trace of the merchant hue), aluminium-grey second neutral for trays and the footer, near-black ink. Every carton carries a solid colour band across its top in a category shade derived from the merchant hue (rotated per category); band colour is the only saturated colour and owns real area. One family, Archivo, with its width axis: condensed caps for carton names and navigation, wide heavy numerals for duration and price, normal width for body. Square corners (2px), hairline carton edges, a small square shade chip, no pills anywhere.

STORY: The visitor sees the salon's name and whether it is open, sees every service as a carton with its duration and price, pulls one, and is booking within one tap. Stylists, reviews and gallery are other shelves of the same room.

FIRST VIEWPORT: A header band (salon name set in condensed caps at display size, open/closed state, address line, "Book" action). Below it the carton wall begins at once: a grid where the interior photograph occupies a 2x2 block and service cartons fill the rest, each with band, name, big duration numerals, price and a "Book" control linking to /book with that service. On phones: name band, then the cartons as a two-column wall, photo as a full-width carton.

FORM: Candidate 7 of 7 (the colour room carton wall), seed: seed:f30e665e26b25338. Raises from declined challengers: festival lineup poster: hierarchy by size and width of one face alone, no eyebrows or kicker labels. Cutting bench: state is a mark, not a hue: the selected carton is notched (a cut corner) and ticked, unavailable times are struck through. Industrial quote grammar: literal labelling, every shelf named by its plain name. City-pop airbrush: total palette commitment, the band colours own a fifth of each carton, not a dot. Signature interaction: on /book a chosen carton lifts and docks into a sticky "tray" summary bar (price, duration, Continue) at the bottom of the phone screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
