-- Client visit stats are derived from source rows (features/keystone/clientStats.ts).
-- Recompute every client, including those with no completed visits, so stale
-- seed/booking values (firstVisit = signup time, zero counters) are replaced.
WITH visits AS (
  SELECT a."client" AS client_id, count(*)::int AS visits, min(a."startTime") AS first_visit, max(a."startTime") AS last_visit
  FROM "Appointment" a
  WHERE a."status" = 'completed' AND a."client" IS NOT NULL
  GROUP BY a."client"
), sales AS (
  SELECT t."id", t."client" AS client_id,
    COALESCE(
      CASE WHEN jsonb_typeof(t."metadata"::jsonb -> 'taxable') = 'number' THEN (t."metadata"::jsonb ->> 'taxable')::numeric END,
      (SELECT COALESCE(sum(l."unitPrice" * l."quantity" - COALESCE(l."discount", 0)), 0) FROM "SalonTransactionLineItem" l WHERE l."transaction" = t."id")
    ) - (SELECT COALESCE(sum(abs(r."subtotalDelta")), 0) FROM "TransactionReversal" r WHERE r."transaction" = t."id") AS net
  FROM "SalonTransaction" t
  WHERE t."status" = 'completed' AND t."client" IS NOT NULL
), spend AS (
  SELECT client_id, GREATEST(0, round(sum(net)))::int AS lifetime_value FROM sales GROUP BY client_id
)
UPDATE "Client" c
SET "totalVisits" = COALESCE(v.visits, 0),
    "firstVisit" = v.first_visit,
    "lastVisit" = v.last_visit,
    "lifetimeValue" = COALESCE(s.lifetime_value, 0)
FROM "Client" c2
LEFT JOIN visits v ON v.client_id = c2."id"
LEFT JOIN spend s ON s.client_id = c2."id"
WHERE c."id" = c2."id";
