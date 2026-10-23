-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "guestEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "guestName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "guestPhone" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Client_guestEmail_idx" ON "Client"("guestEmail");
