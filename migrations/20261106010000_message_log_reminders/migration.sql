-- Every email the salon sends is written to MessageLog, including guests (no User), and
-- day-ahead reminders are claimed once per appointment.
ALTER TABLE "MessageLog" ADD COLUMN "recipientAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MessageLog" ADD COLUMN "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MessageLog" ADD COLUMN "kind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Memberships bought online renew through a Stripe subscription.
ALTER TABLE "ClientMembership" ADD COLUMN "providerSubscriptionId" TEXT NOT NULL DEFAULT '';
CREATE INDEX "ClientMembership_providerSubscriptionId_idx" ON "ClientMembership"("providerSubscriptionId");
