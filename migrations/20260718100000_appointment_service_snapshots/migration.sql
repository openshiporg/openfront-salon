-- Preserve booking-time service evidence independently of the mutable catalog.
ALTER TABLE "AppointmentLineItem"
  ADD COLUMN "serviceTitle" TEXT,
  ADD COLUMN "serviceImagePath" TEXT;

UPDATE "AppointmentLineItem" AS line
SET
  "serviceTitle" = COALESCE(
    NULLIF(line.metadata->>'serviceName', ''),
    (SELECT service.name FROM "Service" AS service WHERE service.id = line.service),
    'Service'
  ),
  "serviceImagePath" = COALESCE(
    NULLIF(line.metadata->>'serviceImagePath', ''),
    (
      SELECT image."imagePath"
      FROM "Service" AS service
      LEFT JOIN "SalonImage" AS image ON image.id = service.image
      WHERE service.id = line.service
    ),
    ''
  ),
  duration = CASE WHEN line.duration IS NULL OR line.duration < 1 THEN 60 ELSE line.duration END,
  quantity = CASE WHEN line.quantity < 1 THEN 1 ELSE line.quantity END;

ALTER TABLE "AppointmentLineItem"
  ALTER COLUMN "serviceTitle" SET NOT NULL,
  ALTER COLUMN "serviceTitle" SET DEFAULT '',
  ALTER COLUMN "serviceImagePath" SET NOT NULL,
  ALTER COLUMN "serviceImagePath" SET DEFAULT '',
  ALTER COLUMN duration SET NOT NULL;

ALTER TABLE "AppointmentLineItem"
  ADD CONSTRAINT "AppointmentLineItem_serviceTitle_snapshot_valid"
    CHECK (char_length(BTRIM("serviceTitle")) BETWEEN 1 AND 300),
  ADD CONSTRAINT "AppointmentLineItem_serviceImagePath_snapshot_valid"
    CHECK ("serviceImagePath" = '' OR ("serviceImagePath" LIKE '/images/%' AND POSITION('..' IN "serviceImagePath") = 0)),
  ADD CONSTRAINT "AppointmentLineItem_duration_snapshot_positive"
    CHECK (duration > 0),
  ADD CONSTRAINT "AppointmentLineItem_price_snapshot_nonnegative"
    CHECK (price >= 0),
  ADD CONSTRAINT "AppointmentLineItem_quantity_snapshot_positive"
    CHECK (quantity > 0);
