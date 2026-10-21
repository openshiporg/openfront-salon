-- CreateEnum
CREATE TYPE "SalonImageVisibilityType" AS ENUM ('private', 'public');

-- AlterTable
ALTER TABLE "SalonImage" ADD COLUMN     "visibility" "SalonImageVisibilityType" NOT NULL DEFAULT 'private';

-- Only known repo-owned demo marketing paths are classified public. Unknown
-- uploads remain private. A care attachment always overrides marketing reuse.
UPDATE "SalonImage" AS image SET "visibility" = 'public'
WHERE image."imagePath" LIKE '/images/%'
  AND image."metadata"->>'source' = 'onboarding'
  AND image."metadata"->>'placement' IN ('gallery', 'service', 'stylist', 'product')
  AND NOT EXISTS (SELECT 1 FROM "_ClientNote_photos" link WHERE link."B" = image.id)
  AND NOT EXISTS (SELECT 1 FROM "ColorFormula" formula WHERE formula."photo" = image.id);
