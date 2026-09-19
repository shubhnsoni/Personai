-- WhatsApp shop intake S1: admin-managed Twilio WhatsApp business numbers.

CREATE TYPE "WhatsappNumberProvider" AS ENUM ('TWILIO');
CREATE TYPE "WhatsappNumberStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "WhatsappBusinessNumber" (
    "id" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider" "WhatsappNumberProvider" NOT NULL DEFAULT 'TWILIO',
    "accountSid" TEXT NOT NULL DEFAULT '',
    "authToken" TEXT NOT NULL DEFAULT '',
    "whatsappFrom" TEXT NOT NULL DEFAULT '',
    "status" "WhatsappNumberStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappBusinessNumber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappBusinessNumber_e164_key" ON "WhatsappBusinessNumber"("e164");
CREATE INDEX "WhatsappBusinessNumber_status_isDefault_idx" ON "WhatsappBusinessNumber"("status", "isDefault");
