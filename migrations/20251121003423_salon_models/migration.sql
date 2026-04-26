/*
  Warnings:

  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "SalonImage" (
    "id" TEXT NOT NULL,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "altText" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,

    CONSTRAINT "SalonImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "baseDuration" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "pricingTier" JSONB,
    "requiresConsultation" BOOLEAN NOT NULL DEFAULT false,
    "requiresPatchTest" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "image" TEXT,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stylist" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "tier" TEXT DEFAULT 'junior',
    "bio" TEXT NOT NULL DEFAULT '',
    "commissionRate" DOUBLE PRECISION DEFAULT 0.5,
    "certifications" TEXT NOT NULL DEFAULT '',
    "hireDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "photo" TEXT,

    CONSTRAINT "Stylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "preferredStylist" TEXT,
    "allergies" TEXT NOT NULL DEFAULT '',
    "skinSensitivities" TEXT NOT NULL DEFAULT '',
    "hairType" TEXT,
    "hairTexture" TEXT,
    "scalpCondition" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "firstVisit" TIMESTAMP(3),
    "lastVisit" TIMESTAMP(3),
    "totalVisits" INTEGER DEFAULT 0,
    "lifetimeValue" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorFormula" (
    "id" TEXT NOT NULL,
    "formulaName" TEXT NOT NULL DEFAULT '',
    "products" TEXT NOT NULL DEFAULT '',
    "measurements" TEXT NOT NULL DEFAULT '',
    "processingTime" INTEGER,
    "result" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "client" TEXT,
    "stylist" TEXT,
    "photo" TEXT,

    CONSTRAINT "ColorFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StylistSchedule" (
    "id" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '',
    "endTime" TEXT NOT NULL DEFAULT '',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "breakStart" TEXT NOT NULL DEFAULT '',
    "breakEnd" TEXT NOT NULL DEFAULT '',
    "effectiveDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "stylist" TEXT,

    CONSTRAINT "StylistSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "totalDuration" INTEGER DEFAULT 60,
    "status" TEXT DEFAULT 'scheduled',
    "bookedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "clientNotes" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "client" TEXT,
    "stylist" TEXT,
    "colorFormula" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Service_specialists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Service_specialists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_Appointment_services" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Appointment_services_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

-- CreateIndex
CREATE INDEX "Service_image_idx" ON "Service"("image");

-- CreateIndex
CREATE INDEX "Stylist_user_idx" ON "Stylist"("user");

-- CreateIndex
CREATE INDEX "Stylist_photo_idx" ON "Stylist"("photo");

-- CreateIndex
CREATE INDEX "Client_user_idx" ON "Client"("user");

-- CreateIndex
CREATE INDEX "Client_preferredStylist_idx" ON "Client"("preferredStylist");

-- CreateIndex
CREATE INDEX "ColorFormula_client_idx" ON "ColorFormula"("client");

-- CreateIndex
CREATE INDEX "ColorFormula_stylist_idx" ON "ColorFormula"("stylist");

-- CreateIndex
CREATE INDEX "ColorFormula_photo_idx" ON "ColorFormula"("photo");

-- CreateIndex
CREATE INDEX "StylistSchedule_stylist_idx" ON "StylistSchedule"("stylist");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_colorFormula_key" ON "Appointment"("colorFormula");

-- CreateIndex
CREATE INDEX "Appointment_client_idx" ON "Appointment"("client");

-- CreateIndex
CREATE INDEX "Appointment_stylist_idx" ON "Appointment"("stylist");

-- CreateIndex
CREATE INDEX "_Service_specialists_B_index" ON "_Service_specialists"("B");

-- CreateIndex
CREATE INDEX "_Appointment_services_B_index" ON "_Appointment_services"("B");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_category_fkey" FOREIGN KEY ("category") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_image_fkey" FOREIGN KEY ("image") REFERENCES "SalonImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stylist" ADD CONSTRAINT "Stylist_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stylist" ADD CONSTRAINT "Stylist_photo_fkey" FOREIGN KEY ("photo") REFERENCES "SalonImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_preferredStylist_fkey" FOREIGN KEY ("preferredStylist") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColorFormula" ADD CONSTRAINT "ColorFormula_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColorFormula" ADD CONSTRAINT "ColorFormula_stylist_fkey" FOREIGN KEY ("stylist") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColorFormula" ADD CONSTRAINT "ColorFormula_photo_fkey" FOREIGN KEY ("photo") REFERENCES "SalonImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StylistSchedule" ADD CONSTRAINT "StylistSchedule_stylist_fkey" FOREIGN KEY ("stylist") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_stylist_fkey" FOREIGN KEY ("stylist") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_colorFormula_fkey" FOREIGN KEY ("colorFormula") REFERENCES "ColorFormula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Service_specialists" ADD CONSTRAINT "_Service_specialists_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Service_specialists" ADD CONSTRAINT "_Service_specialists_B_fkey" FOREIGN KEY ("B") REFERENCES "Stylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Appointment_services" ADD CONSTRAINT "_Appointment_services_A_fkey" FOREIGN KEY ("A") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Appointment_services" ADD CONSTRAINT "_Appointment_services_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
