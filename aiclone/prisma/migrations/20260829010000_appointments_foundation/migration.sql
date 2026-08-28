-- Wave B / P2-005: shared appointments foundation.
--
-- STRICTLY ADDITIVE. Creates seven enums, six tables, their indexes and foreign keys,
-- adds eleven nullable-or-defaulted columns plus four indexes to the pre-existing
-- Booking table, and installs one exclusion constraint and one append-only trigger.
--
-- It does NOT alter, rename, retype or drop any pre-existing table, column, index,
-- constraint, type or function. Existing Booking rows stay valid: every added column is
-- nullable or carries a default.
--
-- Booking.status is deliberately LEFT AS text. It is text NOT NULL with real data in it
-- (the rehearsal target holds 'CONFIRMED'), so converting it to a Prisma enum would be a
-- breaking change, not an additive one. The canonical vocabulary and legal transitions
-- live in src/lib/appointments/lifecycle.ts and are validated on the way in. The
-- exclusion constraint below references the SAME status literals; if that list and
-- OCCUPYING_STATUSES ever drift, the database and the application would disagree about
-- what a conflict is, so lifecycle.ts documents itself as the single source of truth.
--
-- DELIBERATE OMISSION, and this is the second wave to hit it:
-- `prisma migrate diff` again emitted five DropForeignKey statements against
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- They were REMOVED programmatically (and the removal count asserted) rather than
-- hand-edited. They are pre-existing drift between schema.prisma, which declares those
-- profileId columns with no relation field, and 20260827140000_phase0_foundations, which
-- created real FK constraints. Dropping them would strip referential integrity from five
-- existing tables for no reason connected to appointments. Reported in
-- INTEGRATION_QUEUE.md; still awaiting its own decision.

-- CreateEnum
CREATE TYPE "AppointmentResourceKind" AS ENUM ('STAFF', 'ROOM', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "AppointmentWaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentDepositState" AS ENUM ('NONE', 'REQUIRED', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'FORFEITED', 'FAILED');

-- CreateEnum
CREATE TYPE "AppointmentReminderChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AppointmentReminderState" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "AppointmentEventKind" AS ENUM ('CREATED', 'STATUS', 'DEPOSIT', 'REMINDER', 'WAITLIST');

-- CreateEnum
CREATE TYPE "AppointmentEventActor" AS ENUM ('GUEST', 'STAFF', 'SYSTEM');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "noShowAt" TIMESTAMP(3),
ADD COLUMN     "partySize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resourceId" TEXT;

-- CreateTable
CREATE TABLE "AppointmentResource" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "AppointmentResourceKind" NOT NULL DEFAULT 'STAFF',
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceResource" (
    "serviceOfferingId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "ServiceResource_pkey" PRIMARY KEY ("serviceOfferingId","resourceId")
);

-- CreateTable
CREATE TABLE "AppointmentWaitlistEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "serviceOfferingId" TEXT NOT NULL,
    "resourceId" TEXT,
    "requestedStart" TIMESTAMP(3) NOT NULL,
    "requestedEnd" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "status" "AppointmentWaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "offeredBookingId" TEXT,
    "offerExpiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentDeposit" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "state" "AppointmentDepositState" NOT NULL DEFAULT 'REQUIRED',
    "providerRef" TEXT,
    "idempotencyKey" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "channel" "AppointmentReminderChannel" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "state" "AppointmentReminderState" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "AppointmentEventKind" NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "AppointmentEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentResource_profileId_isActive_idx" ON "AppointmentResource"("profileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentResource_profileId_name_key" ON "AppointmentResource"("profileId", "name");

-- CreateIndex
CREATE INDEX "ServiceResource_resourceId_idx" ON "ServiceResource"("resourceId");

-- CreateIndex
CREATE INDEX "AppointmentWaitlistEntry_profileId_status_requestedStart_idx" ON "AppointmentWaitlistEntry"("profileId", "status", "requestedStart");

-- CreateIndex
CREATE INDEX "AppointmentWaitlistEntry_serviceOfferingId_status_idx" ON "AppointmentWaitlistEntry"("serviceOfferingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentWaitlistEntry_profileId_idempotencyKey_key" ON "AppointmentWaitlistEntry"("profileId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentDeposit_bookingId_key" ON "AppointmentDeposit"("bookingId");

-- CreateIndex
CREATE INDEX "AppointmentDeposit_profileId_state_idx" ON "AppointmentDeposit"("profileId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentDeposit_profileId_idempotencyKey_key" ON "AppointmentDeposit"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AppointmentReminder_state_sendAt_idx" ON "AppointmentReminder"("state", "sendAt");

-- CreateIndex
CREATE INDEX "AppointmentReminder_profileId_state_idx" ON "AppointmentReminder"("profileId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentReminder_bookingId_channel_sendAt_key" ON "AppointmentReminder"("bookingId", "channel", "sendAt");

-- CreateIndex
CREATE INDEX "AppointmentEvent_bookingId_seq_idx" ON "AppointmentEvent"("bookingId", "seq");

-- CreateIndex
CREATE INDEX "Booking_profileId_startTime_idx" ON "Booking"("profileId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_profileId_status_idx" ON "Booking"("profileId", "status");

-- CreateIndex
CREATE INDEX "Booking_resourceId_startTime_idx" ON "Booking"("resourceId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_profileId_idempotencyKey_key" ON "Booking"("profileId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AppointmentResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentResource" ADD CONSTRAINT "AppointmentResource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentResource" ADD CONSTRAINT "AppointmentResource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_serviceOfferingId_fkey" FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AppointmentResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentWaitlistEntry" ADD CONSTRAINT "AppointmentWaitlistEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentWaitlistEntry" ADD CONSTRAINT "AppointmentWaitlistEntry_serviceOfferingId_fkey" FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentWaitlistEntry" ADD CONSTRAINT "AppointmentWaitlistEntry_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AppointmentResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentWaitlistEntry" ADD CONSTRAINT "AppointmentWaitlistEntry_offeredBookingId_fkey" FOREIGN KEY ("offeredBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentDeposit" ADD CONSTRAINT "AppointmentDeposit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentDeposit" ADD CONSTRAINT "AppointmentDeposit_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Resource double-booking prevention, defense-in-depth layer.
--
-- The application enforces conflict refusal in src/lib/appointments by taking a
-- transactional row lock on the parent AppointmentResource before testing overlap.
-- That is the primary mechanism and is what the harness proves under genuinely
-- interleaved transactions. This constraint additionally refuses an overlap
-- introduced by a direct SQL writer that bypasses the application.
--
-- btree_gist is already installed by 20260828170000_restaurant_reservations. CREATE
-- EXTENSION IF NOT EXISTS keeps this migration independently replayable without
-- assuming ordering.
--
-- The predicate is narrow on purpose:
--   * "resourceId" IS NOT NULL  -- pre-existing bookings have no resource and must
--                                 never conflict with each other
--   * status IN (occupying)     -- a cancelled, completed, no-show or expired
--                                 appointment must not hold a slot
-- Half-open '[)' bounds mean an appointment ending exactly when the next begins does
-- not conflict, which is the correct back-to-back scheduling semantic.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_resource_no_overlap"
    EXCLUDE USING gist (
        "resourceId" WITH =,
        tsrange("startTime", "endTime", '[)') WITH &&
    )
    WHERE (
        "resourceId" IS NOT NULL
        AND "status" IN ('PENDING_PAYMENT', 'HELD', 'CONFIRMED', 'CHECKED_IN')
    );

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the appointment ledger. Reuses the existing
-- reject_append_only_mutation() function created by
-- 20260827140000_phase0_foundations rather than defining a second copy.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "AppointmentEvent_append_only"
BEFORE UPDATE OR DELETE ON "AppointmentEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
