ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "calendarToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_calendarToken_key" ON "Profile"("calendarToken");
