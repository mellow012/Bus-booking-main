-- Add sessionVersion to User
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Backfill for safety (redundant with DEFAULT but explicit)
UPDATE "User" SET "sessionVersion" = 1 WHERE "sessionVersion" IS NULL;
