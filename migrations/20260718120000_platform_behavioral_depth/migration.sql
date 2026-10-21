-- Add authoritative location scope to operational records.
ALTER TABLE "Client" ADD COLUMN "homeLocation" TEXT;
ALTER TABLE "StylistSchedule" ADD COLUMN "location" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "location" TEXT;
ALTER TABLE "SalonTransaction" ADD COLUMN "location" TEXT;
ALTER TABLE "SalonResource" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "_Location_stylists" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_Location_stylists_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_Location_stylists_B_index" ON "_Location_stylists"("B");

-- Existing single-location installations are scoped deterministically. Multi-location
-- installations retain nulls so an operator must make an explicit assignment.
WITH only_location AS (
  SELECT MIN("id") AS "id" FROM "Location" WHERE "isActive" = true
  HAVING COUNT(*) = 1
)
UPDATE "Client" SET "homeLocation" = only_location."id" FROM only_location WHERE "Client"."homeLocation" IS NULL;
WITH only_location AS (
  SELECT MIN("id") AS "id" FROM "Location" WHERE "isActive" = true
  HAVING COUNT(*) = 1
)
UPDATE "StylistSchedule" SET "location" = only_location."id" FROM only_location WHERE "StylistSchedule"."location" IS NULL;
WITH only_location AS (
  SELECT MIN("id") AS "id" FROM "Location" WHERE "isActive" = true
  HAVING COUNT(*) = 1
)
UPDATE "Appointment" SET "location" = only_location."id" FROM only_location WHERE "Appointment"."location" IS NULL;
UPDATE "SalonTransaction" AS tx
SET "location" = appt."location"
FROM "Appointment" AS appt
WHERE appt."transaction" = tx."id" AND tx."location" IS NULL;
WITH only_location AS (
  SELECT MIN("id") AS "id" FROM "Location" WHERE "isActive" = true
  HAVING COUNT(*) = 1
)
INSERT INTO "_Location_stylists" ("A", "B")
SELECT only_location."id", stylist."id" FROM only_location CROSS JOIN "Stylist" stylist
ON CONFLICT DO NOTHING;

CREATE INDEX "Client_homeLocation_idx" ON "Client"("homeLocation");
CREATE INDEX "StylistSchedule_location_idx" ON "StylistSchedule"("location");
CREATE INDEX "Appointment_location_idx" ON "Appointment"("location");
CREATE INDEX "SalonTransaction_location_idx" ON "SalonTransaction"("location");
ALTER TABLE "SalonResource" ADD CONSTRAINT "SalonResource_revision_check" CHECK ("revision" >= 1);
ALTER TABLE "Client" ADD CONSTRAINT "Client_homeLocation_fkey" FOREIGN KEY ("homeLocation") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StylistSchedule" ADD CONSTRAINT "StylistSchedule_location_fkey" FOREIGN KEY ("location") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_location_fkey" FOREIGN KEY ("location") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalonTransaction" ADD CONSTRAINT "SalonTransaction_location_fkey" FOREIGN KEY ("location") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_Location_stylists" ADD CONSTRAINT "_Location_stylists_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Location_stylists" ADD CONSTRAINT "_Location_stylists_B_fkey" FOREIGN KEY ("B") REFERENCES "Stylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "DomainEventOperationType" AS ENUM ('create', 'update', 'delete');
CREATE TYPE "DomainEventStatusType" AS ENUM ('pending', 'processing', 'delivered', 'dead_letter');
CREATE TYPE "InventoryMovementTypeType" AS ENUM ('receive', 'adjustment', 'sale', 'return');

CREATE TABLE "DomainEvent" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL DEFAULT '',
  "eventType" TEXT NOT NULL DEFAULT '',
  "eventVersion" INTEGER NOT NULL DEFAULT 1,
  "aggregateType" TEXT NOT NULL DEFAULT '',
  "aggregateId" TEXT NOT NULL DEFAULT '',
  "operation" "DomainEventOperationType" NOT NULL,
  "actorId" TEXT NOT NULL DEFAULT '',
  "locationId" TEXT NOT NULL DEFAULT '',
  "payload" JSONB,
  "payloadHash" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" "DomainEventStatusType" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DomainEvent_version_check" CHECK ("eventVersion" >= 1),
  CONSTRAINT "DomainEvent_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "DomainEvent_eventKey_key" ON "DomainEvent"("eventKey");

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "type" "InventoryMovementTypeType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "idempotencyKey" TEXT NOT NULL DEFAULT '',
  "location" TEXT,
  "product" TEXT,
  "appointment" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryMovement_delta_check" CHECK ("delta" <> 0),
  CONSTRAINT "InventoryMovement_balance_check" CHECK ("balanceBefore" >= 0 AND "balanceAfter" >= 0 AND "balanceAfter" = "balanceBefore" + "delta")
);
CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");
CREATE INDEX "InventoryMovement_location_idx" ON "InventoryMovement"("location");
CREATE INDEX "InventoryMovement_product_idx" ON "InventoryMovement"("product");
CREATE INDEX "InventoryMovement_appointment_idx" ON "InventoryMovement"("appointment");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_location_fkey" FOREIGN KEY ("location") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
