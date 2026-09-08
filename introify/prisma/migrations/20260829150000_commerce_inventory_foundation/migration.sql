-- Wave F / P2-010: commerce inventory foundation.
--
-- STRICTLY ADDITIVE. Creates three enums and three tables with their indexes and foreign
-- keys, then adds four CHECK constraints and one append-only trigger. Measured, not
-- assumed: the generated diff contained 0 DROP TABLE, 0 DROP COLUMN, 0 ALTER COLUMN and
-- 0 ADD COLUMN. Not one pre-existing table is altered in any way.
--
-- WHAT EXISTED BEFORE: DigitalProduct."stock", one nullable Int. Nothing decremented it,
-- nothing reserved against it, there was no location dimension, no movement history and
-- no oversell refusal. That column is left EXACTLY as it is - not renamed, not dropped,
-- not migrated - because deciding what its existing values mean is a data decision, not a
-- schema one. These tables are authoritative going forward.
--
-- DESIGN INTENT: reuse, do not duplicate. The product is the pre-existing DigitalProduct.
-- The site is the pre-existing Location. Demand is the pre-existing Order and OrderLine,
-- and a reservation points at an OrderLine rather than copying its quantity or price.
-- There is no new product, order, fulfilment or payment table here.
--
-- locationId is REQUIRED. Stock that is not anywhere is not stock, and a nullable
-- location would need either a partial unique index or a denormalized discriminator to
-- keep "one record per product per place" enforceable. Both would be schema drift; this
-- database has already been bitten by drift once. The runtime refuses with a clear
-- message when a workspace has no Location yet.
--
-- THE OVERSELL GUARANTEE IS A CONSTRAINT, NOT A CONVENTION:
--     InventoryItem_onHand_nonnegative      onHand   >= 0
--     InventoryItem_reserved_nonnegative    reserved >= 0
--     InventoryItem_reserved_within_onHand  reserved <= onHand
--     InventoryReservation_qty_positive     qty      >  0
-- Application code can be wrong; a CHECK constraint cannot be bypassed by it. Like the
-- four append-only triggers and the two exclusion constraints already in this database,
-- these live in SQL rather than in schema.prisma, and Prisma's diff leaves them alone -
-- which is why the four existing triggers have survived four migrations untouched.
--
-- THE LEDGER IS SELF-VERIFYING: InventoryMovement stores the signed deltas AND the
-- resulting balances, so replaying the deltas must reproduce the stored after-values. The
-- harness checks exactly that rather than trusting the engine to have been consistent.
--
-- Tenancy is profileId, bridged from the caller's workspace as the appointment and cohort
-- domains do, because DigitalProduct and Order are both already profileId-scoped.
--
-- DELIBERATE OMISSION, fifth wave running:
-- `prisma migrate diff` again emitted five DropForeignKey statements against
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- Removed programmatically with the count asserted. They are pre-existing drift between
-- schema.prisma and 20260827140000_phase0_foundations. Dropping them would strip
-- referential integrity from five existing tables for reasons unconnected to inventory.

-- CreateEnum
CREATE TYPE "InventoryMovementKind" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'CONSUME', 'RETURN', 'COUNT');

-- CreateEnum
CREATE TYPE "InventoryMovementActor" AS ENUM ('STAFF', 'SYSTEM', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "InventoryReservationState" AS ENUM ('HELD', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "InventoryMovementKind" NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "actor" "InventoryMovementActor" NOT NULL DEFAULT 'STAFF',
    "actorId" TEXT,
    "orderId" TEXT,
    "orderLineId" TEXT,
    "reservationId" TEXT,
    "idempotencyKey" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "state" "InventoryReservationState" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_profileId_locationId_idx" ON "InventoryItem"("profileId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryItem_profileId_onHand_idx" ON "InventoryItem"("profileId", "onHand");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_productId_locationId_key" ON "InventoryItem"("productId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_seq_idx" ON "InventoryMovement"("itemId", "seq");

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_itemId_idempotencyKey_key" ON "InventoryMovement"("itemId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_orderLineId_key" ON "InventoryReservation"("orderLineId");

-- CreateIndex
CREATE INDEX "InventoryReservation_itemId_state_idx" ON "InventoryReservation"("itemId", "state");

-- CreateIndex
CREATE INDEX "InventoryReservation_state_expiresAt_idx" ON "InventoryReservation"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_itemId_idempotencyKey_key" ON "InventoryReservation"("itemId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Oversell is impossible at the storage layer, not merely refused in code.
-- ---------------------------------------------------------------------------
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_onHand_nonnegative" CHECK ("onHand" >= 0);
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_reserved_nonnegative" CHECK ("reserved" >= 0);
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_reserved_within_onHand" CHECK ("reserved" <= "onHand");
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_qty_positive" CHECK ("qty" > 0);

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the movement ledger. Reuses the existing
-- reject_append_only_mutation() function from 20260827140000_phase0_foundations
-- rather than defining a sixth equivalent trigger.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "InventoryMovement_append_only"
BEFORE UPDATE OR DELETE ON "InventoryMovement"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
