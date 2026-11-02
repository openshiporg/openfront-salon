-- Optional short line under the storefront name (e.g. SALON).
ALTER TABLE "StoreSettings" ADD COLUMN "tagline" TEXT NOT NULL DEFAULT '';
