-- Per-service turnover buffer (minutes kept free after the service); 15 matches the previous fixed buffer.
-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bufferMinutes" INTEGER DEFAULT 15;
