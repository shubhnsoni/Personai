-- Wave A / P1-006: real reservations related to RestaurantTable.
--
-- STRICTLY ADDITIVE. This migration creates three enums, two tables, five indexes,
-- three foreign keys, one extension, one exclusion constraint and one append-only
-- trigger. It does not alter, rename, retype, narrow or drop ANY pre-existing
-- table, column, index, constraint, type or function.
--
-- DELIBERATE OMISSION, recorded so the next author does not "restore" it:
-- `prisma migrate diff` also emitted five DropForeignKey statements against
-- pre-existing tables:
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- Those were EXCLUDED on purpose. They are pre-existing drift between
-- schema.prisma (which declares `profileId String?` on those models with no
-- relation field) and 20260827140000_phase0_foundations (which created real FK
-- constraints). Dropping them would remove referential integrity from five
-- existing tables, which is outside this migration's additive scope and unrelated
-- to reservations. The drift is reported separately; it is not fixed here.

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('REQUESTED', 'HELD', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReservationEventKind" AS ENUM ('CREATED', 'STATUS', 'HOLD_EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationEventActor" AS ENUM ('GUEST', 'STAFF', 'SYSTEM');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "partySize" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'REQUESTED',
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "note" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "seatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "noShowAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationEvent" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "ReservationEventKind" NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "ReservationEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_profileId_status_idx" ON "Reservation"("profileId", "status");

-- CreateIndex
CREATE INDEX "Reservation_profileId_startAt_idx" ON "Reservation"("profileId", "startAt");

-- CreateIndex
CREATE INDEX "Reservation_tableId_startAt_idx" ON "Reservation"("tableId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_profileId_idempotencyKey_key" ON "Reservation"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReservationEvent_reservationId_seq_idx" ON "ReservationEvent"("reservationId", "seq");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationEvent" ADD CONSTRAINT "ReservationEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Overlap prevention, defense-in-depth layer.
--
-- The application enforces overlap refusal in src/lib/reservations by taking a
-- transactional row lock on the parent RestaurantTable before testing overlap.
-- That is the primary mechanism and it is what the harness proves under real
-- interleaved transactions.
--
-- This exclusion constraint is the second layer: it also refuses an overlap
-- introduced by a direct SQL writer that bypasses the application entirely.
--
-- btree_gist availability was PROBED on the rehearsal target before writing this
-- (pg_available_extensions reported it available and not yet installed), so this
-- is a verified capability rather than an assumption.
--
-- Range bounds are half-open '[)' on purpose: a booking that ends exactly when
-- the next one starts does NOT overlap, which is the correct table-turnover
-- semantic. Only non-terminal statuses participate, so a cancelled or completed
-- booking never blocks the slot.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_no_overlap"
    EXCLUDE USING gist (
        "tableId" WITH =,
        tsrange("startAt", "endAt", '[)') WITH &&
    )
    WHERE ("status" IN ('REQUESTED', 'HELD', 'CONFIRMED', 'SEATED'));

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the reservation ledger.
--
-- Reuses the reject_append_only_mutation() function created by
-- 20260827140000_phase0_foundations rather than defining a second copy. The
-- function's presence was verified on the target before writing this.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "ReservationEvent_append_only"
BEFORE UPDATE OR DELETE ON "ReservationEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
