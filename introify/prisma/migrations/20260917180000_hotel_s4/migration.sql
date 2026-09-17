-- Hotel S4: property ops fields, request photo/language, knowledge buckets, staff notices.

ALTER TABLE "HotelProperty" ADD COLUMN "quietHours" TEXT;
ALTER TABLE "HotelProperty" ADD COLUMN "parkingInfo" TEXT;
ALTER TABLE "HotelProperty" ADD COLUMN "propertyHours" TEXT;
ALTER TABLE "HotelProperty" ADD COLUMN "mapImageUrl" TEXT;
ALTER TABLE "HotelProperty" ADD COLUMN "mapMarkersJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HotelProperty" ADD COLUMN "slaJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "HotelProperty" ADD COLUMN "upsellsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HotelProperty" ADD COLUMN "staffLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "HotelRequest" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "HotelRequest" ADD COLUMN "guestLanguage" TEXT;
ALTER TABLE "HotelRequest" ADD COLUMN "staffNotes" TEXT;

CREATE TABLE "HotelKnowledge" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "guestVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelKnowledge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HotelKnowledge_profileId_bucket_idx" ON "HotelKnowledge"("profileId", "bucket");

ALTER TABLE "HotelKnowledge" ADD CONSTRAINT "HotelKnowledge_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HotelStaffNotice" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "requestId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelStaffNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HotelStaffNotice_profileId_createdAt_idx" ON "HotelStaffNotice"("profileId", "createdAt");

ALTER TABLE "HotelStaffNotice" ADD CONSTRAINT "HotelStaffNotice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
