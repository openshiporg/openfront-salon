-- Storefront-safe local image paths for onboarding and catalog/gallery rendering.
ALTER TABLE "SalonImage"
ADD COLUMN IF NOT EXISTS "imagePath" TEXT NOT NULL DEFAULT '';
