-- AlterTable
ALTER TABLE "SalonTransactionLineItem" ADD COLUMN     "imagePath" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sku" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';

-- Backfill checkout-time snapshots previously kept only in metadata.
UPDATE "SalonTransactionLineItem"
SET "title" = COALESCE("metadata"->>'title', ''),
    "sku" = COALESCE("metadata"->>'sku', ''),
    "imagePath" = COALESCE("metadata"->>'imagePath', '')
WHERE "metadata" IS NOT NULL;
