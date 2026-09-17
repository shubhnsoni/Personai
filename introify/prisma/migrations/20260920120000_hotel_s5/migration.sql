-- Hotel S5: staff assignments, group stub, white-label, webhook placeholder, department-scoped notices.

ALTER TABLE "HotelProperty" ADD COLUMN "staffJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HotelProperty" ADD COLUMN "groupJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "HotelProperty" ADD COLUMN "whiteLabel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HotelProperty" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "HotelProperty" ADD COLUMN "integrationsJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "HotelStaffNotice" ADD COLUMN "department" TEXT;
ALTER TABLE "HotelStaffNotice" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'in_app';

CREATE INDEX "HotelStaffNotice_profileId_department_idx" ON "HotelStaffNotice"("profileId", "department");
