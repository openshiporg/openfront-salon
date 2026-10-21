/*
  Warnings:

  - You are about to drop the column `appointmentDate` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `totalDuration` on the `Appointment` table. All the data in the column will be lost.
  - The `status` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `hairType` column on the `Client` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tier` column on the `Stylist` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `certifications` column on the `Stylist` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `dayOfWeek` column on the `StylistSchedule` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `_Appointment_services` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Service_specialists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[transaction]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[review]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `ServiceCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Appointment_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Service_specialists` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `startTime` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ServiceStatusType" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "StylistRoleType" AS ENUM ('stylist', 'colorist', 'nail_tech', 'esthetician', 'massage_therapist', 'manager', 'receptionist');

-- CreateEnum
CREATE TYPE "StylistTierType" AS ENUM ('junior', 'senior', 'master', 'celebrity');

-- CreateEnum
CREATE TYPE "StylistEmploymentTypeType" AS ENUM ('full_time', 'part_time', 'contractor');

-- CreateEnum
CREATE TYPE "StylistStatusType" AS ENUM ('active', 'on_leave', 'inactive');

-- CreateEnum
CREATE TYPE "ClientSkinTypeType" AS ENUM ('oily', 'dry', 'combination', 'sensitive');

-- CreateEnum
CREATE TYPE "ClientHairTypeType" AS ENUM ('straight', 'wavy', 'curly', 'coily');

-- CreateEnum
CREATE TYPE "StylistScheduleTypeType" AS ENUM ('recurring', 'one_time', 'time_off');

-- CreateEnum
CREATE TYPE "StylistScheduleDayOfWeekLegacyType" AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- CreateEnum
CREATE TYPE "AppointmentStatusType" AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "SalonResourceTypeType" AS ENUM ('station', 'room', 'shampoo_bowl', 'equipment', 'color_bar', 'other');

-- CreateEnum
CREATE TYPE "SalonTransactionTypeType" AS ENUM ('appointment', 'walk_in', 'retail');

-- CreateEnum
CREATE TYPE "SalonTransactionPaymentMethodType" AS ENUM ('cash', 'card', 'split', 'gift_card', 'package');

-- CreateEnum
CREATE TYPE "SalonTransactionPaymentStatusType" AS ENUM ('pending', 'paid', 'partially_paid', 'refunded');

-- CreateEnum
CREATE TYPE "SalonTransactionStatusType" AS ENUM ('open', 'completed', 'voided');

-- CreateEnum
CREATE TYPE "SalonTransactionLineItemItemTypeType" AS ENUM ('service', 'product');

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "appointmentDate",
DROP COLUMN "totalDuration",
ADD COLUMN     "depositAmount" INTEGER,
ADD COLUMN     "depositPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "duration" INTEGER DEFAULT 60,
ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "resource" TEXT,
ADD COLUMN     "review" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "transaction" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "AppointmentStatusType" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skinType" "ClientSkinTypeType",
DROP COLUMN "hairType",
ADD COLUMN     "hairType" "ClientHairTypeType";

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "depositAmount" INTEGER,
ADD COLUMN     "depositRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "price" INTEGER NOT NULL,
ADD COLUMN     "status" "ServiceStatusType" DEFAULT 'active',
ALTER COLUMN "basePrice" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN     "displayOrder" INTEGER DEFAULT 0,
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parent" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Stylist" ADD COLUMN     "baseCommissionRate" DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN     "employmentType" "StylistEmploymentTypeType",
ADD COLUMN     "photoUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "role" "StylistRoleType",
ADD COLUMN     "socialMedia" JSONB,
ADD COLUMN     "status" "StylistStatusType" DEFAULT 'active',
DROP COLUMN "tier",
ADD COLUMN     "tier" "StylistTierType" DEFAULT 'junior',
DROP COLUMN "certifications",
ADD COLUMN     "certifications" JSONB;

-- AlterTable
ALTER TABLE "StylistSchedule" ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "dayOfWeekLegacy" "StylistScheduleDayOfWeekLegacyType",
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" "StylistScheduleTypeType" NOT NULL DEFAULT 'recurring',
DROP COLUMN "dayOfWeek",
ADD COLUMN     "dayOfWeek" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingStatus" TEXT DEFAULT 'not_started',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "_Appointment_services" DROP CONSTRAINT "_Appointment_services_AB_pkey";

-- AlterTable
ALTER TABLE "_Service_specialists" DROP CONSTRAINT "_Service_specialists_AB_pkey";

-- CreateTable
CREATE TABLE "ServiceVariant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "service" TEXT,
    "price" INTEGER NOT NULL,
    "duration" INTEGER,
    "staffLevel" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER DEFAULT 0,

    CONSTRAINT "ServiceVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "client" TEXT,
    "author" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "appointment" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentLineItem" (
    "id" TEXT NOT NULL,
    "service" TEXT,
    "staff" TEXT,
    "duration" INTEGER DEFAULT 60,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "appointment" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AppointmentLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPoints" (
    "id" TEXT NOT NULL,
    "client" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "transactions" JSONB DEFAULT '[]',

    CONSTRAINT "ClientPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrer" TEXT,
    "referred" TEXT,
    "rewardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardType" TEXT NOT NULL DEFAULT 'points',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT,
    "template" TEXT,
    "sentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "status" TEXT DEFAULT 'sent',
    "errorMessage" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "initialValue" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "recipientEmail" TEXT NOT NULL DEFAULT '',
    "recipientName" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "purchasedBy" TEXT,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "giftCard" TEXT,
    "appointment" TEXT,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMembership" (
    "id" TEXT NOT NULL,
    "client" TEXT,
    "membership" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3),
    "status" TEXT DEFAULT 'active',
    "pausedUntil" TIMESTAMP(3),

    CONSTRAINT "ClientMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "fields" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IntakeForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "savingsAmount" DOUBLE PRECISION DEFAULT 0,
    "validDays" INTEGER DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "discountPercent" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "client" TEXT,
    "service" TEXT,
    "preferredDays" JSONB,
    "preferredTimeRange" TEXT NOT NULL DEFAULT '',
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifiedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "secondaryColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "showServices" BOOLEAN NOT NULL DEFAULT true,
    "showStylists" BOOLEAN NOT NULL DEFAULT true,
    "customCSS" TEXT NOT NULL DEFAULT '',
    "embedCode" TEXT NOT NULL DEFAULT '',
    "buttonText" TEXT NOT NULL DEFAULT 'Book Now',
    "welcomeMessage" TEXT NOT NULL DEFAULT '',
    "width" TEXT NOT NULL DEFAULT '100%',
    "height" TEXT NOT NULL DEFAULT '600px',

    CONSTRAINT "WidgetConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "data" JSONB,
    "signature" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "client" TEXT,
    "form" TEXT,
    "template" TEXT,
    "appointment" TEXT,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT DEFAULT 'intake',
    "description" TEXT NOT NULL DEFAULT '',
    "fields" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "pointsPerDollar" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "redemptionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "tiers" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "zipCode" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "hours" JSONB DEFAULT '{"monday":{"open":"09:00","close":"18:00","closed":false},"tuesday":{"open":"09:00","close":"18:00","closed":false},"wednesday":{"open":"09:00","close":"18:00","closed":false},"thursday":{"open":"09:00","close":"18:00","closed":false},"friday":{"open":"09:00","close":"18:00","closed":false},"saturday":{"open":"09:00","close":"17:00","closed":false},"sunday":{"open":null,"close":null,"closed":true}}',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" "SalonResourceTypeType" NOT NULL DEFAULT 'station',
    "capacity" INTEGER DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "location" TEXT,

    CONSTRAINT "SalonResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION,
    "quantity" INTEGER DEFAULT 0,
    "reorderPoint" INTEGER DEFAULT 5,
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSale" (
    "id" TEXT NOT NULL,
    "appointment" TEXT,
    "products" JSONB DEFAULT '[]',
    "total" DOUBLE PRECISION NOT NULL,
    "soldBy" TEXT,
    "soldAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "saleAmount" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "stylist" TEXT,
    "service" TEXT,
    "payment" TEXT,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "client" TEXT,
    "service" TEXT,
    "stylist" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonTransaction" (
    "id" TEXT NOT NULL,
    "type" "SalonTransactionTypeType" NOT NULL DEFAULT 'appointment',
    "client" TEXT,
    "staff" TEXT,
    "tip" INTEGER DEFAULT 0,
    "paymentMethod" "SalonTransactionPaymentMethodType",
    "paymentStatus" "SalonTransactionPaymentStatusType" NOT NULL DEFAULT 'pending',
    "status" "SalonTransactionStatusType" NOT NULL DEFAULT 'open',
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalonTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonTransactionLineItem" (
    "id" TEXT NOT NULL,
    "transaction" TEXT,
    "itemType" "SalonTransactionLineItemItemTypeType" NOT NULL,
    "service" TEXT,
    "product" TEXT,
    "staff" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "discount" INTEGER DEFAULT 0,
    "commissionRate" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "SalonTransactionLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackage" (
    "id" TEXT NOT NULL,
    "client" TEXT,
    "package" TEXT,
    "purchasedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT DEFAULT 'active',
    "totalValue" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "usedValue" INTEGER DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "ClientPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackageUsage" (
    "id" TEXT NOT NULL,
    "clientPackage" TEXT,
    "appointment" TEXT,
    "service" TEXT,
    "quantityUsed" INTEGER DEFAULT 1,
    "valueUsed" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPackageUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ServicePackage_services" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Stylist_waitlistEntries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ClientNote_photos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_IntakeForm_requiredForServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Membership_includedServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_FormTemplate_requiredForCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SalonResource_services" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ServiceVariant_service_idx" ON "ServiceVariant"("service");

-- CreateIndex
CREATE INDEX "ClientNote_client_idx" ON "ClientNote"("client");

-- CreateIndex
CREATE INDEX "ClientNote_author_idx" ON "ClientNote"("author");

-- CreateIndex
CREATE INDEX "ClientNote_appointment_idx" ON "ClientNote"("appointment");

-- CreateIndex
CREATE INDEX "AppointmentLineItem_service_idx" ON "AppointmentLineItem"("service");

-- CreateIndex
CREATE INDEX "AppointmentLineItem_staff_idx" ON "AppointmentLineItem"("staff");

-- CreateIndex
CREATE INDEX "AppointmentLineItem_appointment_idx" ON "AppointmentLineItem"("appointment");

-- CreateIndex
CREATE INDEX "ClientPoints_client_idx" ON "ClientPoints"("client");

-- CreateIndex
CREATE INDEX "Referral_referrer_idx" ON "Referral"("referrer");

-- CreateIndex
CREATE INDEX "Referral_referred_idx" ON "Referral"("referred");

-- CreateIndex
CREATE INDEX "MessageLog_recipient_idx" ON "MessageLog"("recipient");

-- CreateIndex
CREATE INDEX "MessageLog_template_idx" ON "MessageLog"("template");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE INDEX "GiftCard_purchasedBy_idx" ON "GiftCard"("purchasedBy");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_giftCard_idx" ON "GiftCardTransaction"("giftCard");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_appointment_idx" ON "GiftCardTransaction"("appointment");

-- CreateIndex
CREATE INDEX "ClientMembership_client_idx" ON "ClientMembership"("client");

-- CreateIndex
CREATE INDEX "ClientMembership_membership_idx" ON "ClientMembership"("membership");

-- CreateIndex
CREATE INDEX "WaitlistEntry_client_idx" ON "WaitlistEntry"("client");

-- CreateIndex
CREATE INDEX "WaitlistEntry_service_idx" ON "WaitlistEntry"("service");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetConfiguration_name_key" ON "WidgetConfiguration"("name");

-- CreateIndex
CREATE INDEX "FormSubmission_client_idx" ON "FormSubmission"("client");

-- CreateIndex
CREATE INDEX "FormSubmission_form_idx" ON "FormSubmission"("form");

-- CreateIndex
CREATE INDEX "FormSubmission_template_idx" ON "FormSubmission"("template");

-- CreateIndex
CREATE INDEX "FormSubmission_appointment_idx" ON "FormSubmission"("appointment");

-- CreateIndex
CREATE INDEX "SalonResource_location_idx" ON "SalonResource"("location");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_image_idx" ON "Product"("image");

-- CreateIndex
CREATE INDEX "ProductSale_appointment_idx" ON "ProductSale"("appointment");

-- CreateIndex
CREATE INDEX "ProductSale_soldBy_idx" ON "ProductSale"("soldBy");

-- CreateIndex
CREATE INDEX "Commission_stylist_idx" ON "Commission"("stylist");

-- CreateIndex
CREATE INDEX "Commission_service_idx" ON "Commission"("service");

-- CreateIndex
CREATE INDEX "Commission_payment_idx" ON "Commission"("payment");

-- CreateIndex
CREATE INDEX "Review_client_idx" ON "Review"("client");

-- CreateIndex
CREATE INDEX "Review_service_idx" ON "Review"("service");

-- CreateIndex
CREATE INDEX "Review_stylist_idx" ON "Review"("stylist");

-- CreateIndex
CREATE INDEX "SalonTransaction_client_idx" ON "SalonTransaction"("client");

-- CreateIndex
CREATE INDEX "SalonTransaction_staff_idx" ON "SalonTransaction"("staff");

-- CreateIndex
CREATE INDEX "SalonTransactionLineItem_transaction_idx" ON "SalonTransactionLineItem"("transaction");

-- CreateIndex
CREATE INDEX "SalonTransactionLineItem_service_idx" ON "SalonTransactionLineItem"("service");

-- CreateIndex
CREATE INDEX "SalonTransactionLineItem_product_idx" ON "SalonTransactionLineItem"("product");

-- CreateIndex
CREATE INDEX "SalonTransactionLineItem_staff_idx" ON "SalonTransactionLineItem"("staff");

-- CreateIndex
CREATE INDEX "ClientPackage_client_idx" ON "ClientPackage"("client");

-- CreateIndex
CREATE INDEX "ClientPackage_package_idx" ON "ClientPackage"("package");

-- CreateIndex
CREATE INDEX "ClientPackageUsage_clientPackage_idx" ON "ClientPackageUsage"("clientPackage");

-- CreateIndex
CREATE INDEX "ClientPackageUsage_appointment_idx" ON "ClientPackageUsage"("appointment");

-- CreateIndex
CREATE INDEX "ClientPackageUsage_service_idx" ON "ClientPackageUsage"("service");

-- CreateIndex
CREATE UNIQUE INDEX "_ServicePackage_services_AB_unique" ON "_ServicePackage_services"("A", "B");

-- CreateIndex
CREATE INDEX "_ServicePackage_services_B_index" ON "_ServicePackage_services"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Stylist_waitlistEntries_AB_unique" ON "_Stylist_waitlistEntries"("A", "B");

-- CreateIndex
CREATE INDEX "_Stylist_waitlistEntries_B_index" ON "_Stylist_waitlistEntries"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ClientNote_photos_AB_unique" ON "_ClientNote_photos"("A", "B");

-- CreateIndex
CREATE INDEX "_ClientNote_photos_B_index" ON "_ClientNote_photos"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_IntakeForm_requiredForServices_AB_unique" ON "_IntakeForm_requiredForServices"("A", "B");

-- CreateIndex
CREATE INDEX "_IntakeForm_requiredForServices_B_index" ON "_IntakeForm_requiredForServices"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Membership_includedServices_AB_unique" ON "_Membership_includedServices"("A", "B");

-- CreateIndex
CREATE INDEX "_Membership_includedServices_B_index" ON "_Membership_includedServices"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_FormTemplate_requiredForCategories_AB_unique" ON "_FormTemplate_requiredForCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_FormTemplate_requiredForCategories_B_index" ON "_FormTemplate_requiredForCategories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SalonResource_services_AB_unique" ON "_SalonResource_services"("A", "B");

-- CreateIndex
CREATE INDEX "_SalonResource_services_B_index" ON "_SalonResource_services"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_transaction_key" ON "Appointment"("transaction");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_review_key" ON "Appointment"("review");

-- CreateIndex
CREATE INDEX "Appointment_resource_idx" ON "Appointment"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE INDEX "ServiceCategory_parent_idx" ON "ServiceCategory"("parent");

-- CreateIndex
CREATE UNIQUE INDEX "_Appointment_services_AB_unique" ON "_Appointment_services"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Service_specialists_AB_unique" ON "_Service_specialists"("A", "B");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_parent_fkey" FOREIGN KEY ("parent") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVariant" ADD CONSTRAINT "ServiceVariant_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_author_fkey" FOREIGN KEY ("author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resource_fkey" FOREIGN KEY ("resource") REFERENCES "SalonResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "SalonTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_review_fkey" FOREIGN KEY ("review") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentLineItem" ADD CONSTRAINT "AppointmentLineItem_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentLineItem" ADD CONSTRAINT "AppointmentLineItem_staff_fkey" FOREIGN KEY ("staff") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentLineItem" ADD CONSTRAINT "AppointmentLineItem_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPoints" ADD CONSTRAINT "ClientPoints_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrer_fkey" FOREIGN KEY ("referrer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referred_fkey" FOREIGN KEY ("referred") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_recipient_fkey" FOREIGN KEY ("recipient") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_template_fkey" FOREIGN KEY ("template") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_purchasedBy_fkey" FOREIGN KEY ("purchasedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_giftCard_fkey" FOREIGN KEY ("giftCard") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_membership_fkey" FOREIGN KEY ("membership") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_form_fkey" FOREIGN KEY ("form") REFERENCES "IntakeForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_template_fkey" FOREIGN KEY ("template") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonResource" ADD CONSTRAINT "SalonResource_location_fkey" FOREIGN KEY ("location") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_image_fkey" FOREIGN KEY ("image") REFERENCES "SalonImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_soldBy_fkey" FOREIGN KEY ("soldBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_stylist_fkey" FOREIGN KEY ("stylist") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_stylist_fkey" FOREIGN KEY ("stylist") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonTransaction" ADD CONSTRAINT "SalonTransaction_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonTransaction" ADD CONSTRAINT "SalonTransaction_staff_fkey" FOREIGN KEY ("staff") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonTransactionLineItem" ADD CONSTRAINT "SalonTransactionLineItem_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "SalonTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonTransactionLineItem" ADD CONSTRAINT "SalonTransactionLineItem_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonTransactionLineItem" ADD CONSTRAINT "SalonTransactionLineItem_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonTransactionLineItem" ADD CONSTRAINT "SalonTransactionLineItem_staff_fkey" FOREIGN KEY ("staff") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_package_fkey" FOREIGN KEY ("package") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageUsage" ADD CONSTRAINT "ClientPackageUsage_clientPackage_fkey" FOREIGN KEY ("clientPackage") REFERENCES "ClientPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageUsage" ADD CONSTRAINT "ClientPackageUsage_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageUsage" ADD CONSTRAINT "ClientPackageUsage_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServicePackage_services" ADD CONSTRAINT "_ServicePackage_services_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServicePackage_services" ADD CONSTRAINT "_ServicePackage_services_B_fkey" FOREIGN KEY ("B") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Stylist_waitlistEntries" ADD CONSTRAINT "_Stylist_waitlistEntries_A_fkey" FOREIGN KEY ("A") REFERENCES "Stylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Stylist_waitlistEntries" ADD CONSTRAINT "_Stylist_waitlistEntries_B_fkey" FOREIGN KEY ("B") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientNote_photos" ADD CONSTRAINT "_ClientNote_photos_A_fkey" FOREIGN KEY ("A") REFERENCES "ClientNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientNote_photos" ADD CONSTRAINT "_ClientNote_photos_B_fkey" FOREIGN KEY ("B") REFERENCES "SalonImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntakeForm_requiredForServices" ADD CONSTRAINT "_IntakeForm_requiredForServices_A_fkey" FOREIGN KEY ("A") REFERENCES "IntakeForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntakeForm_requiredForServices" ADD CONSTRAINT "_IntakeForm_requiredForServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Membership_includedServices" ADD CONSTRAINT "_Membership_includedServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Membership_includedServices" ADD CONSTRAINT "_Membership_includedServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormTemplate_requiredForCategories" ADD CONSTRAINT "_FormTemplate_requiredForCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormTemplate_requiredForCategories" ADD CONSTRAINT "_FormTemplate_requiredForCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SalonResource_services" ADD CONSTRAINT "_SalonResource_services_A_fkey" FOREIGN KEY ("A") REFERENCES "SalonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SalonResource_services" ADD CONSTRAINT "_SalonResource_services_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
