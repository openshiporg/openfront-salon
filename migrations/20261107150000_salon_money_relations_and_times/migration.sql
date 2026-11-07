-- Relational money and time backstops for invariants the locked writers keep but the schema
-- only checked for sign. Fails closed on existing violations; nothing is rewritten.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment" WHERE coalesce("refundedAmount", 0) > "totalAmount") THEN RAISE EXCEPTION 'Payments refunded beyond their total require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "GiftCard" WHERE "currentBalance" > "initialValue") THEN RAISE EXCEPTION 'Gift cards above their original value require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "ClientPackage" WHERE "totalValue" < 0 OR "paidAmount" < 0 OR coalesce("usedValue", 0) < 0 OR coalesce("usedValue", 0) > "totalValue" OR "paidAmount" > "totalValue") THEN RAISE EXCEPTION 'Client packages used or paid beyond their value require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "PaymentSession" WHERE "amount" < 0) THEN RAISE EXCEPTION 'Negative payment sessions require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "ClientPoints" WHERE "points" < 0) THEN RAISE EXCEPTION 'Negative points balances require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "ClientPoints" WHERE "client" IS NOT NULL GROUP BY "client" HAVING count(*) > 1) THEN RAISE EXCEPTION 'Clients with two points records require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "Appointment" WHERE ("endTime" IS NOT NULL AND "endTime" <= "startTime") OR coalesce("duration", 1) <= 0 OR coalesce("depositAmount", 0) < 0) THEN RAISE EXCEPTION 'Appointments with backwards times or negative deposits require manual remediation'; END IF;
  IF EXISTS (SELECT 1 FROM "ClientPackageUsage" WHERE "quantityUsed" <= 0 OR "valueUsed" < 0) THEN RAISE EXCEPTION 'Package usages with non-positive quantity require manual remediation'; END IF;
END $$;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_within_total" CHECK (coalesce("refundedAmount", 0) <= "totalAmount");
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_balance_within_initial" CHECK ("currentBalance" <= "initialValue");
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_value_range" CHECK ("totalValue" >= 0 AND "paidAmount" BETWEEN 0 AND "totalValue" AND coalesce("usedValue", 0) BETWEEN 0 AND "totalValue");
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_amount_nonnegative" CHECK ("amount" >= 0);
ALTER TABLE "ClientPoints" ADD CONSTRAINT "ClientPoints_points_nonnegative" CHECK ("points" >= 0);
-- One points balance per client; postPoints reads "the" record with take: 1.
CREATE UNIQUE INDEX "ClientPoints_client_key" ON "ClientPoints"("client") WHERE "client" IS NOT NULL;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_time_and_deposit_check" CHECK (("endTime" IS NULL OR "endTime" > "startTime") AND coalesce("duration", 1) > 0 AND coalesce("depositAmount", 0) >= 0);
ALTER TABLE "ClientPackageUsage" ADD CONSTRAINT "ClientPackageUsage_amounts_check" CHECK ("quantityUsed" > 0 AND "valueUsed" >= 0);
