-- Data only: online deposit Payments get the Stripe PaymentIntent and refund ids
-- that until now were kept only on their PaymentSession.data.
UPDATE "Payment" AS p
SET "stripePaymentIntentId" = s."data"->>'paymentIntent'
FROM "PaymentSession" AS s
WHERE p."session" = s."id"
  AND s."data"->>'purpose' = 'appointment_deposit'
  AND p."stripePaymentIntentId" = ''
  AND COALESCE(s."data"->>'paymentIntent', '') LIKE 'pi\_%';

UPDATE "Payment" AS p
SET "stripeRefundId" = r.ids
FROM (
  SELECT s."id", string_agg(op.value->>'refundId', ',' ORDER BY op.value->>'updatedAt') AS ids
  FROM "PaymentSession" AS s,
       jsonb_each(CASE WHEN jsonb_typeof(s."data"->'refundOperations') = 'object' THEN s."data"->'refundOperations' ELSE '{}'::jsonb END) AS op
  WHERE s."data"->>'purpose' = 'appointment_deposit'
    AND op.value->>'status' = 'completed'
    AND COALESCE(op.value->>'refundId', '') LIKE 're\_%'
  GROUP BY s."id"
) AS r
WHERE p."session" = r."id"
  AND p."stripeRefundId" = '';
