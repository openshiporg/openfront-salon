-- Provider-neutral appointment payment sessions. Provider secrets remain in environment variables.
CREATE TYPE "PaymentProviderAdapterType" AS ENUM ('manual', 'stripe');
CREATE TYPE "PaymentSessionStatusType" AS ENUM ('pending', 'requires_action', 'authorized', 'completed', 'failed', 'cancelled', 'partially_refunded', 'refunded');

CREATE TABLE "PaymentProvider" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "code" TEXT NOT NULL DEFAULT '',
  "adapter" "PaymentProviderAdapterType" NOT NULL,
  "isInstalled" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentSession" (
  "id" TEXT NOT NULL,
  "appointment" TEXT,
  "provider" TEXT,
  "idempotencyKey" TEXT NOT NULL DEFAULT '',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "PaymentSessionStatusType" NOT NULL DEFAULT 'pending',
  "providerReference" TEXT NOT NULL DEFAULT '',
  "data" JSONB DEFAULT '{}',
  "authorizedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "session" TEXT;

CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");
CREATE UNIQUE INDEX "PaymentSession_idempotencyKey_key" ON "PaymentSession"("idempotencyKey");
CREATE INDEX "PaymentSession_providerReference_idx" ON "PaymentSession"("providerReference");
CREATE INDEX "PaymentSession_appointment_idx" ON "PaymentSession"("appointment");
CREATE INDEX "PaymentSession_provider_idx" ON "PaymentSession"("provider");
CREATE UNIQUE INDEX "Payment_session_key" ON "Payment"("session");

ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_provider_fkey" FOREIGN KEY ("provider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_session_fkey" FOREIGN KEY ("session") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
