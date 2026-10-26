---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: ["app/dashboard/(admin)/platform"]
---

# Platform pages (features/platform, /dashboard/platform/*)

Mode: Operate. Users: front desk, owner, stylists. Inside the fixed shared dashboard shell (shadcn neutral tokens, sidebar, breadcrumbs), which stays byte-identical to E-commerce.
Rules (owner, 2026-10-25): no pill or heavily rounded tabs, chips or cards; radii at most 6px (`rounded-md`); flat underline tabs; dense tables with real status columns; each page opens on the operator's first-10-seconds task.

## Direction contract

THESIS: The front desk's book. Every screen opens on the work to do now, set in the salon book's rhythm (time down the side, a lane per stylist), and refuses the SaaS tile-and-card template (metric tiles over pill tabs over a card list).

OWN-WORLD: The shell's neutral palette; status colour only where it carries meaning (dot + word in a status column); one sans at a 1.125 scale; dense 40px table rows; flat 6px buttons with a filled ink primary; underline tabs with counts; panels with a hairline header band.

STORY: The operator sees what needs doing (who is next, who to confirm, what to ring up, what is low), acts from the row, and drills into a record only when needed.

FIRST VIEWPORT: Title line with one truthful status and the primary action at right; underline filter tabs with counts; then the work list as a table. On Appointments/Today a day board (lane per stylist, blocks placed by time, a now-line) sits above the table.

FORM: Extension of the established shell world, no concept roll (surface inside an established world, Operate); seed: none (unavailable). Signature move: the day board's stylist lanes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
