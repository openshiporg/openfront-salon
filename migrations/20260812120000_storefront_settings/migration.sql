-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'storefront',
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "themeHue" INTEGER NOT NULL,
    "primaryLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreSettings_themeHue_check" CHECK ("themeHue" BETWEEN 0 AND 359),
    CONSTRAINT "StoreSettings_name_check" CHECK (char_length(BTRIM("name")) BETWEEN 1 AND 120),
    CONSTRAINT "StoreSettings_description_check" CHECK (char_length("description") <= 240)
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_scope_key" ON "StoreSettings"("scope");

-- CreateIndex
CREATE INDEX "StoreSettings_primaryLocation_idx" ON "StoreSettings"("primaryLocation");

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_primaryLocation_fkey" FOREIGN KEY ("primaryLocation") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
