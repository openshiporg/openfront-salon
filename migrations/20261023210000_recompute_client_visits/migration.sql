-- Visit counters are derived from completed appointments; seed and early QA rows left them stale.
UPDATE "Client" c
SET "totalVisits" = v.visits,
    "firstVisit" = v.first_visit,
    "lastVisit" = v.last_visit
FROM (
  SELECT a."client" AS client_id, count(*)::int AS visits, min(a."startTime") AS first_visit, max(a."startTime") AS last_visit
  FROM "Appointment" a
  WHERE a."status" = 'completed' AND a."client" IS NOT NULL
  GROUP BY a."client"
) v
WHERE c."id" = v.client_id;
