-- Reconcile tracking columns that were present in the Keystone model graph but
-- absent from a clean migration replay. IF NOT EXISTS preserves maintained
-- runtime databases where these additive columns were repaired earlier.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AppointmentLineItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SalonResource" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SalonTransaction" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SalonTransactionLineItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ServiceCategory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Stylist" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StylistSchedule" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Close clean-replay drift left by historical migrations.
DROP INDEX IF EXISTS "Client_user_idx";
UPDATE "ClientNote" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "ClientNote" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "ClientNote" ALTER COLUMN "createdAt" SET NOT NULL, ALTER COLUMN "updatedAt" SET NOT NULL, ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE "ColorFormula" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "ColorFormula" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "Commission" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "Commission" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "GiftCard" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "GiftCard" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "GiftCardTransaction" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "GiftCardTransaction" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "Payment" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "Referral" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "Referral" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "Review" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "SalonTransaction" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "SalonTransaction" ALTER COLUMN "createdAt" SET NOT NULL;
UPDATE "WaitlistEntry" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "createdAt" SET NOT NULL;

DO $$
DECLARE join_table TEXT;
BEGIN
  FOREACH join_table IN ARRAY ARRAY[
    '_Appointment_services', '_ClientNote_photos', '_FormTemplate_requiredForCategories',
    '_IntakeForm_requiredForServices', '_Membership_includedServices', '_SalonResource_services',
    '_ServicePackage_services', '_Service_specialists', '_Stylist_waitlistEntries'
  ] LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', join_table || '_AB_unique');
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conrelid = format('%I', join_table)::regclass AND contype = 'p'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY ("A", "B")', join_table, join_table || '_AB_pkey');
    END IF;
  END LOOP;
END $$;

-- Convert every persisted monetary amount from floating-point major units to
-- integer minor units. Existing rows were written as dollars, so conversion is
-- explicit and deterministic; nullable values remain null.
ALTER TABLE "Service" ALTER COLUMN "basePrice" TYPE INTEGER USING CASE WHEN "basePrice" IS NULL THEN NULL ELSE ROUND("basePrice" * 100)::INTEGER END;
ALTER TABLE "Client" ALTER COLUMN "lifetimeValue" TYPE INTEGER USING CASE WHEN "lifetimeValue" IS NULL THEN NULL ELSE ROUND("lifetimeValue" * 100)::INTEGER END;
ALTER TABLE "Payment" ALTER COLUMN "subtotal" TYPE INTEGER USING ROUND("subtotal" * 100)::INTEGER;
ALTER TABLE "Payment" ALTER COLUMN "tax" TYPE INTEGER USING CASE WHEN "tax" IS NULL THEN NULL ELSE ROUND("tax" * 100)::INTEGER END;
ALTER TABLE "Payment" ALTER COLUMN "tip" TYPE INTEGER USING CASE WHEN "tip" IS NULL THEN NULL ELSE ROUND("tip" * 100)::INTEGER END;
ALTER TABLE "Payment" ALTER COLUMN "discount" TYPE INTEGER USING CASE WHEN "discount" IS NULL THEN NULL ELSE ROUND("discount" * 100)::INTEGER END;
ALTER TABLE "Payment" ALTER COLUMN "totalAmount" TYPE INTEGER USING ROUND("totalAmount" * 100)::INTEGER;
ALTER TABLE "Payment" ALTER COLUMN "refundedAmount" TYPE INTEGER USING CASE WHEN "refundedAmount" IS NULL THEN NULL ELSE ROUND("refundedAmount" * 100)::INTEGER END;
ALTER TABLE "GiftCard" ALTER COLUMN "initialValue" TYPE INTEGER USING ROUND("initialValue" * 100)::INTEGER;
ALTER TABLE "GiftCard" ALTER COLUMN "currentBalance" TYPE INTEGER USING ROUND("currentBalance" * 100)::INTEGER;
ALTER TABLE "GiftCardTransaction" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;
ALTER TABLE "Membership" ALTER COLUMN "monthlyPrice" TYPE INTEGER USING ROUND("monthlyPrice" * 100)::INTEGER;
ALTER TABLE "ServicePackage" ALTER COLUMN "totalPrice" TYPE INTEGER USING ROUND("totalPrice" * 100)::INTEGER;
ALTER TABLE "ServicePackage" ALTER COLUMN "savingsAmount" TYPE INTEGER USING CASE WHEN "savingsAmount" IS NULL THEN NULL ELSE ROUND("savingsAmount" * 100)::INTEGER END;
ALTER TABLE "Product" ALTER COLUMN "price" TYPE INTEGER USING ROUND("price" * 100)::INTEGER;
ALTER TABLE "Product" ALTER COLUMN "cost" TYPE INTEGER USING CASE WHEN "cost" IS NULL THEN NULL ELSE ROUND("cost" * 100)::INTEGER END;
ALTER TABLE "ProductSale" ALTER COLUMN "total" TYPE INTEGER USING ROUND("total" * 100)::INTEGER;
ALTER TABLE "Commission" ALTER COLUMN "saleAmount" TYPE INTEGER USING ROUND("saleAmount" * 100)::INTEGER;
ALTER TABLE "Commission" ALTER COLUMN "commissionAmount" TYPE INTEGER USING ROUND("commissionAmount" * 100)::INTEGER;
ALTER TABLE "Referral" ALTER COLUMN "rewardAmount" TYPE INTEGER USING CASE WHEN "rewardType" = 'credit' THEN ROUND("rewardAmount" * 100)::INTEGER ELSE ROUND("rewardAmount")::INTEGER END;

ALTER TABLE "Service" ADD CONSTRAINT "Service_basePrice_minor_nonnegative" CHECK ("basePrice" IS NULL OR "basePrice" >= 0);
ALTER TABLE "Client" ADD CONSTRAINT "Client_lifetimeValue_minor_nonnegative" CHECK ("lifetimeValue" IS NULL OR "lifetimeValue" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_minor_amounts_nonnegative" CHECK (
  "subtotal" >= 0 AND COALESCE("tax", 0) >= 0 AND COALESCE("tip", 0) >= 0
  AND COALESCE("discount", 0) >= 0 AND "totalAmount" >= 0 AND COALESCE("refundedAmount", 0) >= 0
);
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_minor_values_nonnegative" CHECK ("initialValue" >= 0 AND "currentBalance" >= 0);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_monthlyPrice_minor_nonnegative" CHECK ("monthlyPrice" >= 0);
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_minor_values_nonnegative" CHECK ("totalPrice" >= 0 AND COALESCE("savingsAmount", 0) >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_minor_values_nonnegative" CHECK ("price" >= 0 AND ("cost" IS NULL OR "cost" >= 0));
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_total_minor_nonnegative" CHECK ("total" >= 0);
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_minor_values_nonnegative" CHECK ("saleAmount" >= 0 AND "commissionAmount" >= 0);

CREATE TYPE "PaymentWebhookEventStatusType" AS ENUM ('processed', 'ignored');
CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT,
  "replayKey" TEXT NOT NULL DEFAULT '',
  "eventId" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT '',
  "providerReference" TEXT NOT NULL DEFAULT '',
  "payloadHash" TEXT NOT NULL DEFAULT '',
  "status" "PaymentWebhookEventStatusType" NOT NULL DEFAULT 'processed',
  "data" JSONB DEFAULT '{}',
  "processedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_replayKey_key" ON "PaymentWebhookEvent"("replayKey");
CREATE INDEX "PaymentWebhookEvent_provider_idx" ON "PaymentWebhookEvent"("provider");
CREATE INDEX "PaymentWebhookEvent_providerReference_idx" ON "PaymentWebhookEvent"("providerReference");
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_provider_fkey" FOREIGN KEY ("provider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
