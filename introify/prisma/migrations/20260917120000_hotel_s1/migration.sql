-- Hotel S1: property, rooms, stays, restaurant links, requests, dynamic QR.

CREATE TABLE "HotelProperty" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "address" TEXT,
    "receptionPhone" TEXT,
    "receptionWhatsapp" TEXT,
    "website" TEXT,
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "timezone" TEXT,
    "languagesJson" TEXT NOT NULL DEFAULT '["en"]',
    "roomCount" INTEGER,
    "wifiName" TEXT,
    "wifiPassword" TEXT,
    "policiesSummary" TEXT,
    "amenitiesJson" TEXT NOT NULL DEFAULT '[]',
    "emergencyContact" TEXT,
    "servicesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelProperty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelProperty_profileId_key" ON "HotelProperty"("profileId");

ALTER TABLE "HotelProperty" ADD CONSTRAINT "HotelProperty_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "building" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelRoom_profileId_number_key" ON "HotelRoom"("profileId", "number");
CREATE INDEX "HotelRoom_profileId_isActive_sortOrder_idx" ON "HotelRoom"("profileId", "isActive", "sortOrder");

ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HotelStay" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "guestName" TEXT,
    "roomId" TEXT,
    "arrival" TIMESTAMP(3),
    "departure" TIMESTAMP(3),
    "language" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelStay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelStay_token_key" ON "HotelStay"("token");
CREATE INDEX "HotelStay_profileId_roomId_idx" ON "HotelStay"("profileId", "roomId");

ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HotelRestaurantLink" (
    "id" TEXT NOT NULL,
    "hotelProfileId" TEXT NOT NULL,
    "restaurantProfileId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelRestaurantLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelRestaurantLink_hotelProfileId_restaurantProfileId_key" ON "HotelRestaurantLink"("hotelProfileId", "restaurantProfileId");
CREATE INDEX "HotelRestaurantLink_restaurantProfileId_idx" ON "HotelRestaurantLink"("restaurantProfileId");

ALTER TABLE "HotelRestaurantLink" ADD CONSTRAINT "HotelRestaurantLink_hotelProfileId_fkey" FOREIGN KEY ("hotelProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelRestaurantLink" ADD CONSTRAINT "HotelRestaurantLink_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HotelRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roomId" TEXT,
    "stayId" TEXT,
    "conversationId" TEXT,
    "guestName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HotelRequest_profileId_status_createdAt_idx" ON "HotelRequest"("profileId", "status", "createdAt");
CREATE INDEX "HotelRequest_profileId_department_status_idx" ON "HotelRequest"("profileId", "department", "status");

ALTER TABLE "HotelRequest" ADD CONSTRAINT "HotelRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelRequest" ADD CONSTRAINT "HotelRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelRequest" ADD CONSTRAINT "HotelRequest_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HotelQr" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "roomId" TEXT,
    "stayId" TEXT,
    "label" TEXT,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelQr_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelQr_code_key" ON "HotelQr"("code");
CREATE INDEX "HotelQr_profileId_kind_idx" ON "HotelQr"("profileId", "kind");

ALTER TABLE "HotelQr" ADD CONSTRAINT "HotelQr_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelQr" ADD CONSTRAINT "HotelQr_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelQr" ADD CONSTRAINT "HotelQr_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
