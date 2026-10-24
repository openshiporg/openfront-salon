-- Link online guest bookings made before guest Client records existed.
-- Account-less Clients are matched by guest email only; signed-in accounts are never claimed.
WITH guests AS (
  SELECT DISTINCT ON (lower(trim(a."metadata"->'guest'->>'email')))
    lower(trim(a."metadata"->'guest'->>'email')) AS email,
    trim(coalesce(a."metadata"->'guest'->>'name', '')) AS name,
    trim(coalesce(a."metadata"->'guest'->>'phone', '')) AS phone
  FROM "Appointment" a
  WHERE a."client" IS NULL AND coalesce(trim(a."metadata"->'guest'->>'email'), '') <> ''
  ORDER BY lower(trim(a."metadata"->'guest'->>'email')), a."startTime" DESC NULLS LAST
)
INSERT INTO "Client" ("id", "guestName", "guestEmail", "guestPhone", "firstVisit", "totalVisits", "lifetimeValue")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || g.email), 1, 24), g.name, g.email, g.phone, now(), 0, 0
FROM guests g
WHERE NOT EXISTS (SELECT 1 FROM "Client" c WHERE c."user" IS NULL AND lower(c."guestEmail") = g.email);

UPDATE "Appointment" a
SET "client" = c."id"
FROM "Client" c
WHERE a."client" IS NULL
  AND c."user" IS NULL
  AND c."guestEmail" <> ''
  AND lower(c."guestEmail") = lower(trim(a."metadata"->'guest'->>'email'));

-- A client's home location defaults to where they last completed a visit.
UPDATE "Client" c
SET "homeLocation" = latest."location"
FROM (
  SELECT DISTINCT ON (a."client") a."client", a."location"
  FROM "Appointment" a
  WHERE a."status" = 'completed' AND a."client" IS NOT NULL AND a."location" IS NOT NULL
  ORDER BY a."client", a."startTime" DESC NULLS LAST
) latest
WHERE c."id" = latest."client" AND c."homeLocation" IS NULL;
