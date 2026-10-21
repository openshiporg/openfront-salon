-- The bounded-core migration removed the composite primary keys from these
-- Prisma-managed implicit many-to-many tables but retained equivalent unique
-- indexes. Promote those existing indexes in place: no join rows are rewritten,
-- no history is deleted, and the unique pair invariant is preserved.
ALTER TABLE "_Appointment_services" ADD CONSTRAINT "_Appointment_services_AB_pkey" PRIMARY KEY USING INDEX "_Appointment_services_AB_unique";
ALTER TABLE "_ClientNote_photos" ADD CONSTRAINT "_ClientNote_photos_AB_pkey" PRIMARY KEY USING INDEX "_ClientNote_photos_AB_unique";
ALTER TABLE "_FormTemplate_requiredForCategories" ADD CONSTRAINT "_FormTemplate_requiredForCategories_AB_pkey" PRIMARY KEY USING INDEX "_FormTemplate_requiredForCategories_AB_unique";
ALTER TABLE "_IntakeForm_requiredForServices" ADD CONSTRAINT "_IntakeForm_requiredForServices_AB_pkey" PRIMARY KEY USING INDEX "_IntakeForm_requiredForServices_AB_unique";
ALTER TABLE "_Location_stylists" ADD CONSTRAINT "_Location_stylists_AB_pkey" PRIMARY KEY USING INDEX "_Location_stylists_AB_unique";
ALTER TABLE "_Membership_includedServices" ADD CONSTRAINT "_Membership_includedServices_AB_pkey" PRIMARY KEY USING INDEX "_Membership_includedServices_AB_unique";
ALTER TABLE "_SalonResource_services" ADD CONSTRAINT "_SalonResource_services_AB_pkey" PRIMARY KEY USING INDEX "_SalonResource_services_AB_unique";
ALTER TABLE "_ServicePackage_services" ADD CONSTRAINT "_ServicePackage_services_AB_pkey" PRIMARY KEY USING INDEX "_ServicePackage_services_AB_unique";
ALTER TABLE "_Service_specialists" ADD CONSTRAINT "_Service_specialists_AB_pkey" PRIMARY KEY USING INDEX "_Service_specialists_AB_unique";
ALTER TABLE "_Stylist_waitlistEntries" ADD CONSTRAINT "_Stylist_waitlistEntries_AB_pkey" PRIMARY KEY USING INDEX "_Stylist_waitlistEntries_AB_unique";
