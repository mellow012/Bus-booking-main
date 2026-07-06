/*
  Warnings:

  - You are about to drop the column `branches` on the `Company` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "returnDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "branches";

-- AlterTable
ALTER TABLE "SeatReservation" ADD COLUMN     "bookingSegmentId" TEXT;

-- CreateTable
CREATE TABLE "BookingSegment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "seatNumbers" JSONB NOT NULL,
    "passengerCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "originStopId" TEXT,
    "destinationStopId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingSegment_bookingId_idx" ON "BookingSegment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingSegment_scheduleId_idx" ON "BookingSegment"("scheduleId");

-- CreateIndex
CREATE INDEX "BookingSegment_companyId_idx" ON "BookingSegment"("companyId");

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatReservation" ADD CONSTRAINT "SeatReservation_bookingSegmentId_fkey" FOREIGN KEY ("bookingSegmentId") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
