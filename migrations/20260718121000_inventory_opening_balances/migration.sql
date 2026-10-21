-- Establish location-scoped opening evidence only when the installation has exactly
-- one active location. Multi-location stock must be received explicitly per site.
WITH only_location AS (
  SELECT MIN("id") AS "id" FROM "Location" WHERE "isActive" = true
  HAVING COUNT(*) = 1
)
INSERT INTO "InventoryMovement" (
  "id", "type", "delta", "balanceBefore", "balanceAfter", "reason",
  "idempotencyKey", "location", "product", "metadata", "createdAt", "updatedAt"
)
SELECT
  'opening-' || md5(product."id" || ':' || only_location."id"),
  'receive'::"InventoryMovementTypeType",
  product."quantity",
  0,
  product."quantity",
  'Opening balance captured during location inventory migration',
  'migration:opening:' || product."id" || ':' || only_location."id",
  only_location."id",
  product."id",
  '{"source":"platform_behavioral_depth_migration"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" AS product
CROSS JOIN only_location
WHERE product."quantity" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "InventoryMovement" movement
    WHERE movement."product" = product."id" AND movement."location" = only_location."id"
  );
