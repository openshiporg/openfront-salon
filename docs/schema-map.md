# Openfront Salon — schema map

Source of truth: `features/keystone/models/**` (58 lists), `features/keystone/mutations/**`, `features/keystone/extendGraphqlSchema/**`, onboarding seed `features/platform/onboarding/lib/seed.json`.

Conventions in this schema:

- **Workflow-only writes.** Most business lists have `create/update/delete: () => false`. They change only through a custom mutation that re-checks the actor's role, runs in a serializable transaction with advisory locks, and is idempotent by key. A page can therefore only do what a mutation allows.
- **Append-only evidence.** Revisions, transitions, reviews, ledger entries, reversals and adjustments are never edited. Corrections are new rows.
- **Lifecycle events.** `createLifecycleHooks(aggregate, fields)` writes a `DomainEvent` (status `pending`) for every tracked change. No dispatcher consumes them yet.
- **Money** is integer cents. **Times** are instants; salon wall-clock comes from `Location.timezone`.
- **Who creates:** M = merchant/staff (dashboard), C = customer (storefront), S = system (workflow side effect or seed).

## Lists

### Identity and access

| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| User | Login identity for staff and clients | name, email, phone, password, onboardingStatus, reset token | role, clientProfile (Client), messageLogs, packages, memberships, points, referrals, giftCards | C (`registerSalonCustomer`), M (staff and client forms via `saveSalonRecord`), S (operator booking) | none |
| Role | Permission bundle | 22 `can*` flags (salon, appointments, clients, careRecords, catalog, schedules, ownSchedule, resources, inventory, payments, refunds, commissions, reports, integrations, onboarding…) | assignedTo Users | M (`canManageRoles`) | none |

### Catalog

| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| ServiceCategory | Menu grouping | name, slug, displayOrder, isVisible, parent | services | M (`saveSalonRecord` category) | visible / hidden |
| Service | Bookable service | name, price, baseDuration, depositRequired, depositAmount, requiresConsultation, requiresPatchTest, status, pricingTier | category, image, specialists (Stylist), requiredResources, variants, segmentDefinitions, reviews | M (`saveSalonRecord` service) | draft → active → inactive |
| ServiceVariant | Price/duration option (e.g. by staff level) | name, price, duration, staffLevel, displayOrder | service | M (list access, canManageCatalog) | none |
| ServiceSegment | Versioned step plan (service / processing / finishing) for parallel booking | stableKey, version, sequence, parallelGroup, type, durationMinutes, practitionerRequired, resourceUnits, effectiveFrom/Until | service, qualifiedPractitioners, eligibleResources, supersedes/supersededBy | M (create only; versions supersede) | effective → superseded |
| SalonImage | Service, staff, gallery, care photos | image, altText, visibility | service, stylist, formula, note | M (catalog or care) | public / private |
| Product | Retail item | name, sku, price, cost, quantity, reorderPoint, category, isActive | inventoryMovements, image | M (`saveSalonRecord` product) | active / inactive; reorder when quantity ≤ reorderPoint |
| InventoryMovement | Stock ledger | type, delta, balanceBefore/After, reason, idempotencyKey | product, location, appointment | S (`adjustSalonInventory`, checkout retail, reversal returns) | append-only |
| ProductSale | Legacy retail record | products JSON, total | appointment, soldBy | none (superseded by SalonTransaction) | — |

### People and capacity

| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Location | Salon site | address, phone, hours JSON, timezone, isActive | resources, stylists, clients, appointments, schedules | M (`saveSalonRecord` location), S (onboarding) | active / inactive (blocked with future bookings) |
| StoreSettings | Storefront identity (singleton scope) | name, description, themeHue, logoIcon, logoColor | primaryLocation | M (`upsertSalonStoreSettings`) | none |
| Stylist | Provider profile | role, tier, bio, baseCommissionRate, employmentType, hireDate, status, certifications | user, specializations (Service), locations, schedules, appointments, segments, gratuityEntries, reviews | M (`saveSalonRecord` staff) | active ↔ on_leave ↔ inactive (blocked with future bookings) |
| StylistSchedule | Availability | type (recurring / one_time / time_off), dayOfWeek or localDate, start/end, break, isAvailable, revision | stylist, location | M (`upsertStylistSchedule`, `setStylistScheduleAvailability`) | available ↔ blocked; time off withdrawn by `isAvailable=true` |
| SalonResource | Chair, room, colour bar, equipment | type, capacity, isActive, revision | location, services, segmentDefinitions, appointments | M (`saveSalonRecord` resource, `setSalonResourceAvailability`) | active / inactive |

### Clients and care

| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Client | Client record (account or guest) | guestName/Email/Phone, allergies, skinSensitivities, hairType/Texture, notes, first/lastVisit, totalVisits, lifetimeValue, consents | user, homeLocation, preferredStylist, appointments, formulas, reviews | C (booking, sign-up), M (staff booking, client form), S (checkout totals) | guest (no user) / account |
| ClientNote | Care note (append-only) | content, isPrivate | client, author, appointment, photos | M (care) | append-only |
| ColorFormula | Exact formula per service | formulaName, products, measurements, processingTime, result | client, stylist, appointment, photo | M (care) | append-only |
| FormTemplate | Consultation/intake form identity | name, type, fields, isActive | versions, requiredForCategories, submissions | M (care) | active / inactive |
| ConsultationTemplateVersion | Published, hashed form version | version, titleSnapshot, purposeSnapshot, questions, questionsHash, effectiveFrom/Until | template, supersedes/supersededBy, submissions | M (`publishConsultationTemplateVersion`) | effective → superseded |
| ConsultationSubmission | Signed answers | answers, hashes, signerName/Role, signatureEvidence, reviewStatus | client (User), appointment, templateVersion, reviews | C or M (`submitConsultation`) | submitted → reviewed / needs_clarification / accepted_for_service / deferred |
| ConsultationReview | Review decision (append-only) | status, reason, actorAuthority | submission | M (`reviewConsultation`) | append-only |
| IntakeForm, FormSubmission | Legacy intake forms | fields, data, signature | services, client | S (seed) | superseded by consultation versions |
| Review | Client review of a visit | rating 1–5, comment, isApproved | client, service, stylist, appointment (1:1) | C (`submitAppointmentReview`), M | pending → approved (public) |

### Booking

| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Appointment | A visit | startTime, endTime, duration, status, depositAmount/Paid, notes, clientNotes, internalNotes, metadata (guest, policy snapshot, transitionHistory) | location, client, stylist, resource, services, lineItems, segments, scheduleRevisions, consultationSubmissions, payment, paymentSessions, transaction, review | C/M (`bookAppointment`) | pending → confirmed → in_progress → completed; pending/confirmed → cancelled / no_show (`transitionAppointment`, `completeAppointmentCheckout`) |
| AppointmentLineItem | Booked service snapshot | serviceTitle, price, duration, quantity | appointment, service, staff, segments | S (booking) | none |
| AppointmentScheduleRevision | Every time change (append-only) | revision, prior/next start-end, reason, actor | appointment, segments | S (`bookAppointment`, `scheduleAppointmentSegments`) | append-only |
| AppointmentSegment | Planned step with practitioner/resource | plannedStart/End, type, resourceUnits, status | appointment, lineItem, definition, revision, practitioner, resource, transitions | S (booking, reschedule) | planned → started → completed; planned/started → skipped; superseded by revision (`transitionAppointmentSegment`) |
| SegmentTransition | Segment status evidence | from/toStatus, reason, actor | segment | S | append-only |
| WaitlistEntry | Walk-in or wanted slot | guestName/Phone, preferredDays, timeRange, dateRange, status | client (User), service, preferredStylists, convertedAppointment | M (`joinWaitlist`), C (`joinWaitlistAsClient`) | active → notified → converted / removed; active → converted (`transitionWaitlistEntry`) |

### Money

| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| SalonTransaction | The sale ticket | type, paymentMethod, paymentStatus, status, tip, metadata (service/retail subtotal, discount, tax, credits) | location, client, appointment, staff, lineItems, reversals | S (`completeAppointmentCheckout`) | completed → partially refunded / refunded / voided (`reverseSalonTransaction`) |
| SalonTransactionLineItem | Ticket line | itemType (service/product), title, unitPrice, quantity, discount, commissionRate | transaction, service, product, staff, reversalLines | S | none |
| Payment | Captured payment | subtotal, tax, tip, discount, totalAmount, refundedAmount, paymentMethod, status, receipt | appointment, session, reversals, gratuityEntries, processedBy | S (checkout) | completed → partially_refunded / refunded |
| PaymentProvider | Tender adapter | code, adapter (manual / stripe), isInstalled, isDefault | sessions, webhookEvents | S (seed); code-controlled | installed / not |
| PaymentSession | Provider session (checkout, deposit, gift card) | amount, status, providerReference, data.purpose | appointment, provider, payment | S (`completeAppointmentCheckout`, `processAppointmentDeposit`, `purchaseGiftCard`) | pending → authorized → captured / failed / refunded |
| PaymentWebhookEvent | Provider webhook replay log | eventId, type, status, payloadHash | provider | S | processed / failed |
| TransactionReversal | Refund, void, partial refund, compensation | type, status, subtotal/tax/tip/payment/commissionDelta, reason, conservationEvidence | transaction, payment, lines, commissionAdjustments, gratuityEntries, depositAdjustments | M (`reverseSalonTransaction`, `adjustSaleCompensation`) | posted |
| TransactionReversalLine | Reversed quantity per line | quantity, deltas, inventoryDisposition | reversal, sourceLine, inventoryMovement | S | append-only |
| Commission | Stylist commission per service line | saleAmount, commissionRate, commissionAmount, isPaid, paidAt, notes | stylist, service, payment, adjustments | S (checkout) | unpaid → paid (`payoutCommissions`) |
| CommissionAdjustment | Commission correction | amountDelta, payablePeriod, reason | commission, reversal | S (reversal, compensation) | append-only |
| GratuityLedgerEntry | Tip allocation per practitioner | type (allocation / recovery), amountDelta, payoutStatus | payment, reversal, practitioner | S (checkout, reversal, compensation) | payable → paid (`payoutGratuities`); recovery_due |
| DepositAdjustment | Deposit refund or forfeit evidence | amountDelta, reason | reversal, paymentSession | S | append-only |

### Benefits and loyalty

| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Membership | Monthly plan | monthlyPrice, discountPercent, isActive | includedServices | M (list access, canManageCatalog) | active / inactive |
| ClientMembership | Client enrolled in a plan | startDate, nextBillingDate, status, pausedUntil | client (User), membership | M (`sellClientBenefit`) | active ↔ paused → cancelled (`setClientBenefitStatus`) |
| ServicePackage | Prepaid bundle | totalPrice, savingsAmount, validDays, isActive | services | M (list access) | active / inactive |
| ClientPackage | Package owned by a client | totalValue, paidAmount, usedValue, expiresAt, status | client (User), package, usageHistory, adjustments | M (`sellClientBenefit`) | active → fully-used / expired / cancelled (`setClientBenefitStatus`) |
| ClientPackageUsage | Redemption at checkout | valueUsed, quantityUsed | clientPackage, appointment, service | S (`redeemClientPackage`, checkout) | append-only |
| ClientPackageAdjustment | Restored value on reversal | valueDelta | clientPackage, reversal | S | append-only |
| GiftCard | Stored value | code, initialValue, currentBalance, recipient, expiresAt, isActive | purchasedBy (User), transactions | M (`purchaseGiftCard` + `confirmGiftCardPurchase`, manual tender) | pending → active → redeemed out / expired |
| GiftCardTransaction | Balance ledger | amount, type (purchase / redemption / refund), idempotencyKey | giftCard, appointment | S (`applyGiftCardBalance`, purchase) | append-only |
| LoyaltyProgram | Points rules | pointsPerDollar, redemptionRate, tiers, isActive | none | M (list access, canManageCatalog) | active / inactive |
| ClientPoints | Points balance per user | points, tier, transactions JSON (ledger) | client (User) | S (checkout accrual), M (`adjustClientPoints`) | tier recomputed from LoyaltyProgram.tiers |
| Referral | Client referral | rewardAmount, rewardType, status, completedAt | referrer, referred (User) | M (list access) | pending → completed (`completeReferral`, posts the points reward) |

### Communications and system

| List | Purpose | Key fields | Created by | Notes |
|---|---|---|---|---|
| MessageTemplate | Message copy | name, type, content, variables, isActive | M / S (seed) | No sender reads it |
| MessageLog | Message delivery record | channel, status, errorMessage, sentAt | M | No dispatcher writes it |
| DomainEvent | Lifecycle outbox | eventType, aggregate, status, attempts | S (hooks) | Pending forever; no dispatcher |
| WidgetConfiguration | Embedded booking widget settings | colours, embedCode, copy | M (list access) | No widget runtime serves it |

## Merchant workflows

| # | Workflow | Steps | Lists touched |
|---|---|---|---|
| W1 | Set up the salon | store identity → locations and hours → resources → staff and roles | StoreSettings, Location, SalonResource, Stylist, User, Role |
| W2 | Build the menu | categories → services (price, duration, deposit, consultation and patch-test flags, specialists, resources) → variants → step plan (segments) | ServiceCategory, Service, ServiceVariant, ServiceSegment, SalonImage |
| W3 | Set availability | weekly hours → one-off time off → resource availability | StylistSchedule, SalonResource |
| W4 | Take a booking | online or front desk → confirm → reschedule → cancel; waitlist for walk-ins | Appointment, AppointmentLineItem, AppointmentSegment, AppointmentScheduleRevision, Client, WaitlistEntry |
| W5 | Consultation and consent | publish form version → client signs → staff review before service | FormTemplate, ConsultationTemplateVersion, ConsultationSubmission, ConsultationReview |
| W6 | Run the day | check in → work segments (processing time) → no-show | Appointment, AppointmentSegment, SegmentTransition |
| W7 | Take payment | deposit → checkout (services, retail, discount, tip, package or membership credit) → receipt | Payment, PaymentSession, SalonTransaction(+Line), InventoryMovement, Commission, GratuityLedgerEntry, ClientPackageUsage |
| W8 | Fix a sale | refund / void / partial refund (with retail disposition) → commission and tip correction | TransactionReversal(+Line), CommissionAdjustment, GratuityLedgerEntry, DepositAdjustment, ClientPackageAdjustment, InventoryMovement |
| W9 | Pay staff | commission and card tips payout | Commission, GratuityLedgerEntry |
| W10 | Know the client | profile, visit history, care notes, formulas, care profile | Client, ClientNote, ColorFormula |
| W11 | Sell benefits | membership plans, packages, gift cards → enroll or sell → redeem at checkout | Membership, ClientMembership, ServicePackage, ClientPackage, GiftCard, GiftCardTransaction |
| W12 | Loyalty and referrals | points program → accrue on visits → adjust → referrals | LoyaltyProgram, ClientPoints, Referral |
| W13 | Reputation | client reviews a visit → approve for the storefront | Review |
| W14 | Retail stock | products → adjust stock → reorder | Product, InventoryMovement |
| W15 | Read the business | revenue, tips, refunds, cancellations, unpaid commission | Payment, Appointment, Commission |
| W16 | Systems | providers, webhooks, event backlog | PaymentProvider, PaymentWebhookEvent, DomainEvent |
| W17 | Communications | templates, message log | MessageTemplate, MessageLog |

## Coverage (before this pass)

| Workflow / list | Platform page (route · slice) | Coverage |
|---|---|---|
| W1 StoreSettings | `/platform/store-settings` · store-settings | OK |
| W1 Location, SalonResource, Stylist | `/platform/administration` · workspaces (SalonRecordManager); `/platform/resources` · resources | OK for create/edit. **THIN** staff: no profile page (bio, schedule, bookings, earnings, reviews) |
| W1 User, Role | Dashboard Models (`/dashboard/users`, `/dashboard/roles`) | System lists, covered by Models |
| W2 ServiceCategory, Service | `/platform/catalog` · workspaces | **THIN**: no deposit, consultation or patch-test settings, no variants, no step plan, no service detail |
| W2 ServiceVariant, ServiceSegment | none | **MISSING** |
| W2 SalonImage | Dashboard Models | Upload needs multipart; Models covers it |
| W3 StylistSchedule | `/platform/schedules` · schedules | OK (weekly hours and time off) |
| W4 Appointment and children | `/platform/appointments`, `/[id]`, `/new` · appointments | OK |
| W4 WaitlistEntry | `/platform/waitlist` · waitlist, `/platform/engagement` | OK |
| W5 FormTemplate, ConsultationTemplateVersion, ConsultationSubmission, ConsultationReview | none (only an "Intake / consent" chip on appointments) | **MISSING** |
| W6 AppointmentSegment, SegmentTransition | appointment detail shows no segments | **THIN**: no segment start / complete |
| W7 Payment, SalonTransaction, Commission, GratuityLedgerEntry | `/platform/checkout` · checkout | OK for checkout. **THIN** deposit: no way to record a deposit |
| W8 TransactionReversal and adjustments | none | **MISSING**: no refund, void or compensation page |
| W9 Commission, GratuityLedgerEntry payout | `/platform/commissions` · commissions | OK |
| W10 Client, ClientNote, ColorFormula | `/platform/clients`, `/[id]` · clients | OK |
| W11 Membership, ServicePackage, GiftCard (+ client copies) | `/platform/benefits` · workspaces (read-only list) | **THIN**: no plan create/edit, no enrolment or sale, no gift-card issue, redeem or balance history |
| W12 LoyaltyProgram, ClientPoints, Referral | none | **MISSING** (and no accrual) |
| W13 Review | none (Models only) | **MISSING** moderation |
| W14 Product, InventoryMovement | `/platform/inventory` · workspaces | OK |
| W15 reports | `/platform/reports` · workspaces | OK |
| W16 providers, webhooks, events | `/platform/integrations` · workspaces | OK (read-only by design: providers are code-controlled) |
| W17 MessageTemplate, MessageLog | `/platform/engagement` (log, read-only) | **MISSING** delivery: no dispatcher, and SMTP/SMS needs env vars |
| WidgetConfiguration | Models | No widget runtime exists to configure |
| IntakeForm, FormSubmission, ProductSale | Models | Legacy, superseded by consultation versions and SalonTransaction |
| AppointmentLineItem, AppointmentScheduleRevision, SegmentTransition, SalonTransactionLineItem, TransactionReversalLine, CommissionAdjustment, DepositAdjustment, ClientPackageUsage, ClientPackageAdjustment, GiftCardTransaction, InventoryMovement, PaymentSession | Parent pages: appointment detail, sale detail, gift-card detail, client benefits, inventory | Child and ledger lists; no own page |

## Customer workflows (storefront)

| Workflow | Flow | Coverage before |
|---|---|---|
| Book a service | `/services` → `/services/[id]` → `/book` → `/booking/[id]` → `/account` | OK |
| Book a stylist | `/team` → `/team/[id]` → `/book?stylist=` | OK |
| Manage a booking | `/account`: reschedule, cancel, consultation forms, receipts, review | OK |
| Memberships and packages | none | **MISSING**: no page lists plans; the account doesn't show owned packages or memberships |
| Gift cards | `/gift-cards` (in-salon purchase) | **THIN**: no balance check; the account doesn't show purchased cards |
| Loyalty | none | **MISSING**: points not shown |
| Reviews | `/reviews`, account review form | OK |
| Waitlist | none online | **MISSING** for signed-in clients when no slot fits |

## Coverage after this pass

| Workflow / list | Before | After (route · slice) |
|---|---|---|
| W1 Stylist profile | THIN | `/platform/staff/[id]` · staff (hours, time off, upcoming, earnings, reviews, services). The staff form gains bio and photo upload |
| W2 Service | THIN | `/platform/catalog/[id]` · catalog (booking rules, price by level, upcoming, reviews, specialists). The service form gains deposit, consultation, patch test and image upload |
| W2 ServiceVariant | MISSING | Not built: nothing in booking, checkout or the storefront reads variants. Price by level (`pricingTier`) is the field the storefront shows, and it's now editable |
| W2 ServiceSegment | MISSING | Not built: definitions are read only by explicit segment allocations; booking writes one segment per line. Models covers them |
| W5 Consultations | MISSING | `/platform/consultations` · consultations (review queue with status tabs and decisions; forms: create, publish versioned questions, withdraw) |
| W6 AppointmentSegment | THIN | Appointment detail "Steps" panel: start, complete or skip each step while in the chair |
| W7 Deposit | THIN | Appointment detail "Deposit" panel records a desk-collected deposit (`processAppointmentDeposit`, manual provider) |
| W8 Reversals | MISSING | `/platform/sales`, `/platform/sales/[id]` · sales (status tabs, search, full refund, void, partial by line with retail disposition, tip and package restore, commission and tip corrections, history) |
| W11 Plans and enrolments | THIN | `/platform/benefits` · benefits (plan create and edit, sell or enrol with tender, members pause, resume and cancel, packages cancel) |
| W11 GiftCard | THIN | `/platform/gift-cards` · gift-cards (status tabs, search, sell at the desk, redeem, return value, balance history) |
| W12 Loyalty and referrals | MISSING | `/platform/loyalty` · loyalty (program and tiers, balances, add or redeem, referrals with reward); points accrue at checkout |
| W13 Review | MISSING | `/platform/reviews` · reviews (awaiting, published, all; publish, hide, delete) |
| W15 reports | OK | Adds by-payment-method and by-stylist close-out tables |
| W17 Communications | MISSING | Still missing: no dispatcher, and SMTP/SMS needs env vars the brief forbids |
| WidgetConfiguration | Models | Still Models only: no widget runtime exists |

## Storefront coverage after this pass

| Workflow | Before | After |
|---|---|---|
| Memberships and packages | MISSING | `/memberships` lists active plans and packages (`storefrontBenefits`); the account shows owned memberships and packages with value left |
| Gift cards | THIN | `/gift-cards` adds a balance check by code (`giftCardBalance`); the account lists purchased cards. Online purchase still needs Stripe |
| Loyalty | MISSING | Account shows points and tier |
| Waitlist | MISSING | Booking offers "Join the waitlist" on a day with no open times (signed in; `joinWaitlistAsClient`); staff see it on the waitlist |
