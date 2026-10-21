-- Restore the remaining Prisma-managed implicit many-to-many composite keys
-- using the existing unique indexes, preserving all relation rows in place.
ALTER TABLE "_SalonResource_segmentDefinitions" ADD CONSTRAINT "_SalonResource_segmentDefinitions_AB_pkey" PRIMARY KEY USING INDEX "_SalonResource_segmentDefinitions_AB_unique";
ALTER TABLE "_ServiceSegment_qualifiedPractitioners" ADD CONSTRAINT "_ServiceSegment_qualifiedPractitioners_AB_pkey" PRIMARY KEY USING INDEX "_ServiceSegment_qualifiedPractitioners_AB_unique";
