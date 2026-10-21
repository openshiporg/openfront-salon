-- Make schedule and time-off changes workflow-owned, idempotent, and salon-local.
-- Existing schedule rows receive deterministic keys before uniqueness is enforced.

ALTER TABLE "StylistSchedule"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "localDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

UPDATE "StylistSchedule"
SET
  "idempotencyKey" = 'legacy:schedule:' || id,
  "localDate" = CASE
    WHEN type IN ('one_time', 'time_off') AND date IS NOT NULL
      THEN TO_CHAR(date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ELSE ''
  END
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "StylistSchedule"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "idempotencyKey" SET DEFAULT '';

CREATE UNIQUE INDEX "StylistSchedule_idempotencyKey_key"
  ON "StylistSchedule"("idempotencyKey");

ALTER TABLE "StylistSchedule"
  ADD CONSTRAINT "StylistSchedule_idempotencyKey_valid"
    CHECK (char_length("idempotencyKey") BETWEEN 1 AND 200),
  ADD CONSTRAINT "StylistSchedule_revision_positive"
    CHECK (revision > 0),
  ADD CONSTRAINT "StylistSchedule_time_range_valid"
    CHECK (
      "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "startTime" < "endTime"
    ),
  ADD CONSTRAINT "StylistSchedule_break_range_valid"
    CHECK (
      ("breakStart" = '' AND "breakEnd" = '')
      OR (
        "breakStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "breakEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "startTime" <= "breakStart"
        AND "breakStart" < "breakEnd"
        AND "breakEnd" <= "endTime"
      )
    ),
  ADD CONSTRAINT "StylistSchedule_shape_valid"
    CHECK (
      (
        type = 'recurring'
        AND "dayOfWeek" BETWEEN 0 AND 6
        AND "localDate" = ''
      )
      OR (
        type IN ('one_time', 'time_off')
        AND "dayOfWeek" IS NULL
        AND "localDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND TO_CHAR(TO_DATE("localDate", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "localDate"
      )
    );
