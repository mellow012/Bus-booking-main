/*
  Warnings:

  - You are about to drop the column `assignedConductorIds` on the `Route` table. All the data in the column will be lost.
  - You are about to drop the column `assignedOperatorIds` on the `Route` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Route" DROP COLUMN "assignedConductorIds",
DROP COLUMN "assignedOperatorIds";
