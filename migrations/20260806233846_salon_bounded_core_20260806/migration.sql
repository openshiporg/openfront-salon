/*
  Warnings:

  - The primary key for the `_Appointment_services` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_ClientNote_photos` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_FormTemplate_requiredForCategories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_IntakeForm_requiredForServices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Location_stylists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Membership_includedServices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_SalonResource_services` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_ServicePackage_services` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Service_specialists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Stylist_waitlistEntries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_Appointment_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_ClientNote_photos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_FormTemplate_requiredForCategories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_IntakeForm_requiredForServices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Location_stylists` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Membership_includedServices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_SalonResource_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_ServicePackage_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Service_specialists` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Stylist_waitlistEntries` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ServiceSegmentTypeType" AS ENUM ('service', 'processing', 'finishing', 'cleanup');

-- CreateEnum
CREATE TYPE "AppointmentSegmentTypeType" AS ENUM ('service', 'processing', 'finishing', 'cleanup');

-- CreateEnum
CREATE TYPE "AppointmentSegmentStatusType" AS ENUM ('planned', 'started', 'completed', 'skipped', 'superseded');

-- CreateEnum
CREATE TYPE "TransactionReversalTypeType" AS ENUM ('void', 'refund', 'partial_refund', 'compensation');

-- CreateEnum
CREATE TYPE "TransactionReversalStatusType" AS ENUM ('posted', 'provider_pending');

-- CreateEnum
CREATE TYPE "TransactionReversalLineInventoryDispositionType" AS ENUM ('not_applicable', 'return_to_stock', 'damaged', 'consumed');

-- CreateEnum
CREATE TYPE "GratuityLedgerEntryTypeType" AS ENUM ('allocation', 'recovery');

-- CreateEnum
CREATE TYPE "GratuityLedgerEntryPayoutStatusType" AS ENUM ('payable', 'paid', 'recovery_due');

-- CreateEnum
CREATE TYPE "ConsultationSubmissionSignerRoleType" AS ENUM ('self', 'parent', 'guardian', 'representative');

-- CreateEnum
CREATE TYPE "ConsultationSubmissionReviewStatusType" AS ENUM ('submitted', 'reviewed', 'needs_clarification', 'accepted_for_service', 'deferred');

-- CreateEnum
CREATE TYPE "ConsultationReviewStatusType" AS ENUM ('reviewed', 'needs_clarification', 'accepted_for_service', 'deferred');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageCareRecords" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "_Appointment_services" DROP CONSTRAINT "_Appointment_services_AB_pkey";

-- AlterTable
ALTER TABLE "_ClientNote_photos" DROP CONSTRAINT "_ClientNote_photos_AB_pkey";

-- AlterTable
ALTER TABLE "_FormTemplate_requiredForCategories" DROP CONSTRAINT "_FormTemplate_requiredForCategories_AB_pkey";

-- AlterTable
ALTER TABLE "_IntakeForm_requiredForServices" DROP CONSTRAINT "_IntakeForm_requiredForServices_AB_pkey";

-- AlterTable
ALTER TABLE "_Location_stylists" DROP CONSTRAINT "_Location_stylists_AB_pkey";

-- AlterTable
ALTER TABLE "_Membership_includedServices" DROP CONSTRAINT "_Membership_includedServices_AB_pkey";

-- AlterTable
ALTER TABLE "_SalonResource_services" DROP CONSTRAINT "_SalonResource_services_AB_pkey";

-- AlterTable
ALTER TABLE "_ServicePackage_services" DROP CONSTRAINT "_ServicePackage_services_AB_pkey";

-- AlterTable
ALTER TABLE "_Service_specialists" DROP CONSTRAINT "_Service_specialists_AB_pkey";

-- AlterTable
ALTER TABLE "_Stylist_waitlistEntries" DROP CONSTRAINT "_Stylist_waitlistEntries_AB_pkey";

-- CreateTable
CREATE TABLE "ServiceSegment" (
    "id" TEXT NOT NULL,
    "service" TEXT,
    "stableKey" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "parallelGroup" TEXT NOT NULL DEFAULT '',
    "type" "ServiceSegmentTypeType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "practitionerRequired" BOOLEAN NOT NULL DEFAULT true,
    "resourceUnits" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentSegment" (
    "id" TEXT NOT NULL,
    "appointment" TEXT,
    "lineItem" TEXT,
    "definition" TEXT,
    "revision" TEXT,
    "stableKey" TEXT NOT NULL DEFAULT '',
    "sequence" INTEGER NOT NULL,
    "parallelGroup" TEXT NOT NULL DEFAULT '',
    "type" "AppointmentSegmentTypeType" NOT NULL,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "practitionerRequired" BOOLEAN NOT NULL DEFAULT true,
    "practitioner" TEXT,
    "resource" TEXT,
    "resourceUnits" INTEGER NOT NULL DEFAULT 1,
    "status" "AppointmentSegmentStatusType" NOT NULL DEFAULT 'planned',
    "assignmentEvidence" JSONB DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentScheduleRevision" (
    "id" TEXT NOT NULL,
    "appointment" TEXT,
    "revision" INTEGER NOT NULL,
    "priorStart" TIMESTAMP(3),
    "priorEnd" TIMESTAMP(3),
    "nextStart" TIMESTAMP(3) NOT NULL,
    "nextEnd" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "actorAuthority" TEXT NOT NULL DEFAULT '',
    "scheduleHash" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentScheduleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentTransition" (
    "id" TEXT NOT NULL,
    "segment" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionReversal" (
    "id" TEXT NOT NULL,
    "transaction" TEXT,
    "payment" TEXT,
    "type" "TransactionReversalTypeType" NOT NULL,
    "status" "TransactionReversalStatusType" NOT NULL,
    "subtotalDelta" INTEGER NOT NULL,
    "taxDelta" INTEGER NOT NULL,
    "tipDelta" INTEGER NOT NULL,
    "paymentDelta" INTEGER NOT NULL,
    "commissionDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "providerReference" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "postedAt" TIMESTAMP(3) NOT NULL,
    "conservationEvidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionReversalLine" (
    "id" TEXT NOT NULL,
    "reversal" TEXT,
    "sourceLine" TEXT,
    "quantity" INTEGER NOT NULL,
    "subtotalDelta" INTEGER NOT NULL,
    "taxDelta" INTEGER NOT NULL,
    "commissionDelta" INTEGER NOT NULL,
    "inventoryDisposition" "TransactionReversalLineInventoryDispositionType" NOT NULL,
    "inventoryMovement" TEXT,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionReversalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAdjustment" (
    "id" TEXT NOT NULL,
    "commission" TEXT,
    "reversal" TEXT,
    "amountDelta" INTEGER NOT NULL,
    "payablePeriod" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratuityLedgerEntry" (
    "id" TEXT NOT NULL,
    "payment" TEXT,
    "reversal" TEXT,
    "practitioner" TEXT,
    "type" "GratuityLedgerEntryTypeType" NOT NULL,
    "amountDelta" INTEGER NOT NULL,
    "payoutStatus" "GratuityLedgerEntryPayoutStatusType" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GratuityLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationTemplateVersion" (
    "id" TEXT NOT NULL,
    "template" TEXT,
    "version" TEXT NOT NULL DEFAULT '',
    "titleSnapshot" TEXT NOT NULL DEFAULT '',
    "purposeSnapshot" TEXT NOT NULL DEFAULT '',
    "questions" JSONB DEFAULT '[]',
    "questionsHash" TEXT NOT NULL DEFAULT '',
    "documentHash" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSubmission" (
    "id" TEXT NOT NULL,
    "client" TEXT,
    "appointment" TEXT,
    "templateVersion" TEXT,
    "answers" JSONB DEFAULT '{}',
    "questionsHash" TEXT NOT NULL DEFAULT '',
    "answersHash" TEXT NOT NULL DEFAULT '',
    "evidenceHash" TEXT NOT NULL DEFAULT '',
    "signerName" TEXT NOT NULL DEFAULT '',
    "signerRole" "ConsultationSubmissionSignerRoleType" NOT NULL,
    "guardianAuthority" TEXT NOT NULL DEFAULT '',
    "signatureEvidence" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "actorAuthority" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "supersededBy" TEXT,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "reviewStatus" "ConsultationSubmissionReviewStatusType" NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationReview" (
    "id" TEXT NOT NULL,
    "submission" TEXT,
    "status" "ConsultationReviewStatusType" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "actorAuthority" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackageAdjustment" (
    "id" TEXT NOT NULL,
    "clientPackage" TEXT,
    "reversal" TEXT,
    "valueDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPackageAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositAdjustment" (
    "id" TEXT NOT NULL,
    "reversal" TEXT,
    "paymentSession" TEXT,
    "amountDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SalonResource_segmentDefinitions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ServiceSegment_qualifiedPractitioners" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSegment_supersededBy_key" ON "ServiceSegment"("supersededBy");

-- CreateIndex
CREATE INDEX "ServiceSegment_service_idx" ON "ServiceSegment"("service");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSegment_idempotencyKey_key" ON "AppointmentSegment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AppointmentSegment_appointment_idx" ON "AppointmentSegment"("appointment");

-- CreateIndex
CREATE INDEX "AppointmentSegment_lineItem_idx" ON "AppointmentSegment"("lineItem");

-- CreateIndex
CREATE INDEX "AppointmentSegment_definition_idx" ON "AppointmentSegment"("definition");

-- CreateIndex
CREATE INDEX "AppointmentSegment_revision_idx" ON "AppointmentSegment"("revision");

-- CreateIndex
CREATE INDEX "AppointmentSegment_practitioner_idx" ON "AppointmentSegment"("practitioner");

-- CreateIndex
CREATE INDEX "AppointmentSegment_resource_idx" ON "AppointmentSegment"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentScheduleRevision_idempotencyKey_key" ON "AppointmentScheduleRevision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AppointmentScheduleRevision_appointment_idx" ON "AppointmentScheduleRevision"("appointment");

-- CreateIndex
CREATE INDEX "AppointmentScheduleRevision_actor_idx" ON "AppointmentScheduleRevision"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentTransition_idempotencyKey_key" ON "SegmentTransition"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SegmentTransition_segment_idx" ON "SegmentTransition"("segment");

-- CreateIndex
CREATE INDEX "SegmentTransition_actor_idx" ON "SegmentTransition"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionReversal_idempotencyKey_key" ON "TransactionReversal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransactionReversal_transaction_idx" ON "TransactionReversal"("transaction");

-- CreateIndex
CREATE INDEX "TransactionReversal_payment_idx" ON "TransactionReversal"("payment");

-- CreateIndex
CREATE INDEX "TransactionReversal_actor_idx" ON "TransactionReversal"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionReversalLine_idempotencyKey_key" ON "TransactionReversalLine"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransactionReversalLine_reversal_idx" ON "TransactionReversalLine"("reversal");

-- CreateIndex
CREATE INDEX "TransactionReversalLine_sourceLine_idx" ON "TransactionReversalLine"("sourceLine");

-- CreateIndex
CREATE INDEX "TransactionReversalLine_inventoryMovement_idx" ON "TransactionReversalLine"("inventoryMovement");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionAdjustment_idempotencyKey_key" ON "CommissionAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommissionAdjustment_commission_idx" ON "CommissionAdjustment"("commission");

-- CreateIndex
CREATE INDEX "CommissionAdjustment_reversal_idx" ON "CommissionAdjustment"("reversal");

-- CreateIndex
CREATE INDEX "CommissionAdjustment_actor_idx" ON "CommissionAdjustment"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "GratuityLedgerEntry_idempotencyKey_key" ON "GratuityLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GratuityLedgerEntry_payment_idx" ON "GratuityLedgerEntry"("payment");

-- CreateIndex
CREATE INDEX "GratuityLedgerEntry_reversal_idx" ON "GratuityLedgerEntry"("reversal");

-- CreateIndex
CREATE INDEX "GratuityLedgerEntry_practitioner_idx" ON "GratuityLedgerEntry"("practitioner");

-- CreateIndex
CREATE INDEX "GratuityLedgerEntry_actor_idx" ON "GratuityLedgerEntry"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationTemplateVersion_idempotencyKey_key" ON "ConsultationTemplateVersion"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationTemplateVersion_supersededBy_key" ON "ConsultationTemplateVersion"("supersededBy");

-- CreateIndex
CREATE INDEX "ConsultationTemplateVersion_template_idx" ON "ConsultationTemplateVersion"("template");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSubmission_supersededBy_key" ON "ConsultationSubmission"("supersededBy");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSubmission_idempotencyKey_key" ON "ConsultationSubmission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ConsultationSubmission_client_idx" ON "ConsultationSubmission"("client");

-- CreateIndex
CREATE INDEX "ConsultationSubmission_appointment_idx" ON "ConsultationSubmission"("appointment");

-- CreateIndex
CREATE INDEX "ConsultationSubmission_templateVersion_idx" ON "ConsultationSubmission"("templateVersion");

-- CreateIndex
CREATE INDEX "ConsultationSubmission_actor_idx" ON "ConsultationSubmission"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationReview_idempotencyKey_key" ON "ConsultationReview"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ConsultationReview_submission_idx" ON "ConsultationReview"("submission");

-- CreateIndex
CREATE INDEX "ConsultationReview_actor_idx" ON "ConsultationReview"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPackageAdjustment_idempotencyKey_key" ON "ClientPackageAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ClientPackageAdjustment_clientPackage_idx" ON "ClientPackageAdjustment"("clientPackage");

-- CreateIndex
CREATE INDEX "ClientPackageAdjustment_reversal_idx" ON "ClientPackageAdjustment"("reversal");

-- CreateIndex
CREATE INDEX "ClientPackageAdjustment_actor_idx" ON "ClientPackageAdjustment"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAdjustment_idempotencyKey_key" ON "DepositAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DepositAdjustment_reversal_idx" ON "DepositAdjustment"("reversal");

-- CreateIndex
CREATE INDEX "DepositAdjustment_paymentSession_idx" ON "DepositAdjustment"("paymentSession");

-- CreateIndex
CREATE INDEX "DepositAdjustment_actor_idx" ON "DepositAdjustment"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "_SalonResource_segmentDefinitions_AB_unique" ON "_SalonResource_segmentDefinitions"("A", "B");

-- CreateIndex
CREATE INDEX "_SalonResource_segmentDefinitions_B_index" ON "_SalonResource_segmentDefinitions"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ServiceSegment_qualifiedPractitioners_AB_unique" ON "_ServiceSegment_qualifiedPractitioners"("A", "B");

-- CreateIndex
CREATE INDEX "_ServiceSegment_qualifiedPractitioners_B_index" ON "_ServiceSegment_qualifiedPractitioners"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Appointment_services_AB_unique" ON "_Appointment_services"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_ClientNote_photos_AB_unique" ON "_ClientNote_photos"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_FormTemplate_requiredForCategories_AB_unique" ON "_FormTemplate_requiredForCategories"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_IntakeForm_requiredForServices_AB_unique" ON "_IntakeForm_requiredForServices"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Location_stylists_AB_unique" ON "_Location_stylists"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Membership_includedServices_AB_unique" ON "_Membership_includedServices"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_SalonResource_services_AB_unique" ON "_SalonResource_services"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_ServicePackage_services_AB_unique" ON "_ServicePackage_services"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Service_specialists_AB_unique" ON "_Service_specialists"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Stylist_waitlistEntries_AB_unique" ON "_Stylist_waitlistEntries"("A", "B");

-- AddForeignKey
ALTER TABLE "ServiceSegment" ADD CONSTRAINT "ServiceSegment_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSegment" ADD CONSTRAINT "ServiceSegment_supersededBy_fkey" FOREIGN KEY ("supersededBy") REFERENCES "ServiceSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSegment" ADD CONSTRAINT "AppointmentSegment_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSegment" ADD CONSTRAINT "AppointmentSegment_lineItem_fkey" FOREIGN KEY ("lineItem") REFERENCES "AppointmentLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSegment" ADD CONSTRAINT "AppointmentSegment_definition_fkey" FOREIGN KEY ("definition") REFERENCES "ServiceSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSegment" ADD CONSTRAINT "AppointmentSegment_revision_fkey" FOREIGN KEY ("revision") REFERENCES "AppointmentScheduleRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSegment" ADD CONSTRAINT "AppointmentSegment_practitioner_fkey" FOREIGN KEY ("practitioner") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSegment" ADD CONSTRAINT "AppointmentSegment_resource_fkey" FOREIGN KEY ("resource") REFERENCES "SalonResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentScheduleRevision" ADD CONSTRAINT "AppointmentScheduleRevision_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentScheduleRevision" ADD CONSTRAINT "AppointmentScheduleRevision_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTransition" ADD CONSTRAINT "SegmentTransition_segment_fkey" FOREIGN KEY ("segment") REFERENCES "AppointmentSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTransition" ADD CONSTRAINT "SegmentTransition_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReversal" ADD CONSTRAINT "TransactionReversal_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "SalonTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReversal" ADD CONSTRAINT "TransactionReversal_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReversal" ADD CONSTRAINT "TransactionReversal_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReversalLine" ADD CONSTRAINT "TransactionReversalLine_reversal_fkey" FOREIGN KEY ("reversal") REFERENCES "TransactionReversal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReversalLine" ADD CONSTRAINT "TransactionReversalLine_sourceLine_fkey" FOREIGN KEY ("sourceLine") REFERENCES "SalonTransactionLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionReversalLine" ADD CONSTRAINT "TransactionReversalLine_inventoryMovement_fkey" FOREIGN KEY ("inventoryMovement") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAdjustment" ADD CONSTRAINT "CommissionAdjustment_commission_fkey" FOREIGN KEY ("commission") REFERENCES "Commission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAdjustment" ADD CONSTRAINT "CommissionAdjustment_reversal_fkey" FOREIGN KEY ("reversal") REFERENCES "TransactionReversal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAdjustment" ADD CONSTRAINT "CommissionAdjustment_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratuityLedgerEntry" ADD CONSTRAINT "GratuityLedgerEntry_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratuityLedgerEntry" ADD CONSTRAINT "GratuityLedgerEntry_reversal_fkey" FOREIGN KEY ("reversal") REFERENCES "TransactionReversal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratuityLedgerEntry" ADD CONSTRAINT "GratuityLedgerEntry_practitioner_fkey" FOREIGN KEY ("practitioner") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratuityLedgerEntry" ADD CONSTRAINT "GratuityLedgerEntry_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationTemplateVersion" ADD CONSTRAINT "ConsultationTemplateVersion_template_fkey" FOREIGN KEY ("template") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationTemplateVersion" ADD CONSTRAINT "ConsultationTemplateVersion_supersededBy_fkey" FOREIGN KEY ("supersededBy") REFERENCES "ConsultationTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSubmission" ADD CONSTRAINT "ConsultationSubmission_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSubmission" ADD CONSTRAINT "ConsultationSubmission_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSubmission" ADD CONSTRAINT "ConsultationSubmission_templateVersion_fkey" FOREIGN KEY ("templateVersion") REFERENCES "ConsultationTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSubmission" ADD CONSTRAINT "ConsultationSubmission_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSubmission" ADD CONSTRAINT "ConsultationSubmission_supersededBy_fkey" FOREIGN KEY ("supersededBy") REFERENCES "ConsultationSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationReview" ADD CONSTRAINT "ConsultationReview_submission_fkey" FOREIGN KEY ("submission") REFERENCES "ConsultationSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationReview" ADD CONSTRAINT "ConsultationReview_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageAdjustment" ADD CONSTRAINT "ClientPackageAdjustment_clientPackage_fkey" FOREIGN KEY ("clientPackage") REFERENCES "ClientPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageAdjustment" ADD CONSTRAINT "ClientPackageAdjustment_reversal_fkey" FOREIGN KEY ("reversal") REFERENCES "TransactionReversal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageAdjustment" ADD CONSTRAINT "ClientPackageAdjustment_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAdjustment" ADD CONSTRAINT "DepositAdjustment_reversal_fkey" FOREIGN KEY ("reversal") REFERENCES "TransactionReversal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAdjustment" ADD CONSTRAINT "DepositAdjustment_paymentSession_fkey" FOREIGN KEY ("paymentSession") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAdjustment" ADD CONSTRAINT "DepositAdjustment_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SalonResource_segmentDefinitions" ADD CONSTRAINT "_SalonResource_segmentDefinitions_A_fkey" FOREIGN KEY ("A") REFERENCES "SalonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SalonResource_segmentDefinitions" ADD CONSTRAINT "_SalonResource_segmentDefinitions_B_fkey" FOREIGN KEY ("B") REFERENCES "ServiceSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceSegment_qualifiedPractitioners" ADD CONSTRAINT "_ServiceSegment_qualifiedPractitioners_A_fkey" FOREIGN KEY ("A") REFERENCES "ServiceSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceSegment_qualifiedPractitioners" ADD CONSTRAINT "_ServiceSegment_qualifiedPractitioners_B_fkey" FOREIGN KEY ("B") REFERENCES "Stylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
