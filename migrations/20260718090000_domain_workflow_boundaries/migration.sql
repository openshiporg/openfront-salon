-- Domain workflow evidence and waitlist state-machine support.
-- Existing rows receive deterministic legacy keys before uniqueness is enforced.

ALTER TABLE "ClientPackageUsage"
  ADD COLUMN "idempotencyKey" TEXT;

UPDATE "ClientPackageUsage"
SET "idempotencyKey" = 'legacy:package-usage:' || id
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "ClientPackageUsage"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "idempotencyKey" SET DEFAULT '';

ALTER TABLE "GiftCardTransaction"
  ADD COLUMN "idempotencyKey" TEXT;

UPDATE "GiftCardTransaction"
SET "idempotencyKey" = 'legacy:gift-card-event:' || id
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "GiftCardTransaction"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "idempotencyKey" SET DEFAULT '';

ALTER TABLE "WaitlistEntry"
  ADD COLUMN "convertedAppointment" TEXT,
  ADD COLUMN "guestName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "guestPhone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "transitionReason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "transitionedAt" TIMESTAMP(3);

UPDATE "WaitlistEntry"
SET
  "requestKey" = 'legacy:waitlist:' || id,
  "status" = CASE WHEN "isActive" THEN 'active' ELSE 'removed' END
WHERE "requestKey" IS NULL;

ALTER TABLE "WaitlistEntry"
  ALTER COLUMN "requestKey" SET NOT NULL,
  ALTER COLUMN "requestKey" SET DEFAULT '';

CREATE UNIQUE INDEX "ClientPackageUsage_idempotencyKey_key"
  ON "ClientPackageUsage"("idempotencyKey");
CREATE UNIQUE INDEX "GiftCardTransaction_idempotencyKey_key"
  ON "GiftCardTransaction"("idempotencyKey");
CREATE UNIQUE INDEX "WaitlistEntry_requestKey_key"
  ON "WaitlistEntry"("requestKey");
CREATE INDEX "WaitlistEntry_convertedAppointment_idx"
  ON "WaitlistEntry"("convertedAppointment");

ALTER TABLE "ClientPackageUsage"
  ADD CONSTRAINT "ClientPackageUsage_idempotencyKey_valid"
  CHECK (char_length("idempotencyKey") BETWEEN 1 AND 256);
ALTER TABLE "GiftCardTransaction"
  ADD CONSTRAINT "GiftCardTransaction_idempotencyKey_valid"
  CHECK (char_length("idempotencyKey") BETWEEN 1 AND 256);
ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_requestKey_valid"
  CHECK (char_length("requestKey") BETWEEN 1 AND 200),
  ADD CONSTRAINT "WaitlistEntry_status_valid"
  CHECK ("status" IN ('active', 'notified', 'converted', 'removed'));

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_convertedAppointment_fkey"
  FOREIGN KEY ("convertedAppointment") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
