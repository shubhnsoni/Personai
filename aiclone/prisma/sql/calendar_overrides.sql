ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "bufferMinutes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CalendarOverride" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "isBlocked" BOOLEAN NOT NULL DEFAULT true,
  "startTime" TEXT,
  "endTime" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarOverride_profileId_date_idx" ON "CalendarOverride"("profileId", "date");

DO $$ BEGIN
  ALTER TABLE "CalendarOverride"
    ADD CONSTRAINT "CalendarOverride_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
