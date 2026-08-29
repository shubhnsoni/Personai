-- Wave G / P2-011: commerce variants, fulfilment and returns.
--
-- NOT strictly additive, and deliberately so. Nine tables and six enums are created, and
-- the inventory identity moves from (product, location) to (variant, location). Every
-- non-additive statement is enumerated by exact text in the build tool, which aborts if the
-- generated diff contains any destructive or column-altering statement it did not expect.
--
-- Measured on the generated diff: 9 CREATE TABLE, 6 CREATE TYPE, 1 ADD COLUMN, 0 ALTER
-- COLUMN, 0 DROP TABLE, 0 DROP COLUMN, and exactly one DROP INDEX - the old inventory
-- unique key.
--
-- WHY THE GENERATED STATEMENT COULD NOT BE USED AS-IS
-- `prisma migrate diff` emits:
--     ALTER TABLE "InventoryItem" ADD COLUMN "variantId" TEXT NOT NULL;
-- That succeeds only on an EMPTY table. On any database that actually holds stock it fails
-- outright. The five InventoryItem statements are therefore lifted out and re-emitted below
-- around a backfill, in an order that is safe on a populated table. The END STATE is
-- byte-identical to what Prisma expects, so the next diff sees no churn from this rework.
--
-- WHAT EXISTED BEFORE: DigitalProduct."variantsJson", a JSON blob of `[{name}]` objects
-- carrying a name and nothing else - no SKU, no price, no stock, no identity an order line
-- or a stock record could reference. It is left EXACTLY as it is, still written by
-- src/app/actions/products.ts and still read by three UI files. Reinterpreting its contents
-- is a data decision, not a schema one.
--
-- BACKWARD COMPATIBILITY IS DETERMINISTIC, NOT BEST-EFFORT
-- Every existing DigitalProduct receives exactly one default variant whose id is
-- 'var_' || "DigitalProduct"."id". A derived id rather than a random one is what makes the
-- reconciliation proof exact: the harness can assert, row by row, that each pre-existing
-- stock record now points at the default variant of the product it used to point at, and
-- that its onHand and reserved are unchanged. A cuid() would have made that a join on
-- faith.
--
-- The backfill then asserts in SQL that no InventoryItem row was left without a variant
-- before the column is made NOT NULL. If the assertion fires the transaction aborts and the
-- migration fails loudly rather than dropping stock on the floor.
--
-- productId IS KEPT on InventoryItem, as a denormalized parent. A composite foreign key
-- (productId, variantId) -> ProductVariant(productId, id) would have expressed the
-- consistency rule, but Prisma's datamodel cannot describe it, so every future
-- `migrate diff` would try to drop it - a sixth permanent entry in the drift tax this
-- repository already pays. A trigger is invisible to the diff, which six existing triggers
-- across five migrations demonstrate, so the rule is enforced by
-- reject_inventory_variant_product_mismatch() instead. Same guarantee, no new drift.
--
-- ONE DEFAULT VARIANT PER PRODUCT is a partial unique index. Postgres needs the WHERE
-- clause and Prisma cannot express it; like the CHECK constraints and triggers already
-- here, it survives the diff untouched.
--
-- NO EXTERNAL INTEGRATION. Fulfilment.carrier, trackingNumber and trackingUrl are
-- owner-entered strings. ReturnRequest.refundPaymentId is a pointer to a refund that
-- happened elsewhere. Nothing in this wave contacts a carrier, a payment processor or a
-- messaging provider.
--
-- DELIBERATE OMISSION, sixth wave running:
-- `prisma migrate diff` again emitted five DropForeignKey statements against
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- Removed programmatically with the count asserted. They are pre-existing drift between
-- schema.prisma and 20260827140000_phase0_foundations.

-- CreateEnum
CREATE TYPE "FulfilmentState" AS ENUM ('DRAFT', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnRequestState" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnItemRestockState" AS ENUM ('PENDING', 'RESTOCKED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "CommerceEventKind" AS ENUM ('VARIANT', 'FULFILMENT', 'RETURN', 'RESTOCK', 'NOTE');

-- CreateEnum
CREATE TYPE "CommerceEventSubject" AS ENUM ('VARIANT', 'FULFILMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "CommerceEventActor" AS ENUM ('STAFF', 'SYSTEM', 'CUSTOMER');

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOptionValue" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER,
    "compareAtCents" INTEGER,
    "weightGrams" INTEGER,
    "sku" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantOptionValue" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fulfilment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "locationId" TEXT,
    "reference" TEXT NOT NULL,
    "state" "FulfilmentState" NOT NULL DEFAULT 'DRAFT',
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "packedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fulfilment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentItem" (
    "id" TEXT NOT NULL,
    "fulfilmentId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfilmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "state" "ReturnRequestState" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "decisionNote" TEXT,
    "decidedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "refundPaymentId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "restockState" "ReturnItemRestockState" NOT NULL DEFAULT 'PENDING',
    "restockedAt" TIMESTAMP(3),
    "restockMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "CommerceEventKind" NOT NULL,
    "subjectType" "CommerceEventSubject" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "CommerceEventActor" NOT NULL DEFAULT 'STAFF',
    "actorId" TEXT,
    "orderId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOption_productId_ordinal_idx" ON "ProductOption"("productId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_name_key" ON "ProductOption"("productId", "name");

-- CreateIndex
CREATE INDEX "ProductOptionValue_optionId_ordinal_idx" ON "ProductOptionValue"("optionId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptionValue_optionId_value_key" ON "ProductOptionValue"("optionId", "value");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_ordinal_idx" ON "ProductVariant"("productId", "ordinal");

-- CreateIndex
CREATE INDEX "ProductVariant_profileId_isActive_idx" ON "ProductVariant"("profileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_id_key" ON "ProductVariant"("productId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_profileId_sku_key" ON "ProductVariant"("profileId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_profileId_idempotencyKey_key" ON "ProductVariant"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProductVariantOptionValue_optionValueId_idx" ON "ProductVariantOptionValue"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantOptionValue_variantId_optionId_key" ON "ProductVariantOptionValue"("variantId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantOptionValue_variantId_optionValueId_key" ON "ProductVariantOptionValue"("variantId", "optionValueId");

-- CreateIndex
CREATE INDEX "Fulfilment_orderId_state_idx" ON "Fulfilment"("orderId", "state");

-- CreateIndex
CREATE INDEX "Fulfilment_profileId_state_idx" ON "Fulfilment"("profileId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfilment_profileId_reference_key" ON "Fulfilment"("profileId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfilment_profileId_idempotencyKey_key" ON "Fulfilment"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FulfilmentItem_orderLineId_idx" ON "FulfilmentItem"("orderLineId");

-- CreateIndex
CREATE INDEX "FulfilmentItem_variantId_idx" ON "FulfilmentItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfilmentItem_fulfilmentId_orderLineId_key" ON "FulfilmentItem"("fulfilmentId", "orderLineId");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_state_idx" ON "ReturnRequest"("orderId", "state");

-- CreateIndex
CREATE INDEX "ReturnRequest_profileId_state_idx" ON "ReturnRequest"("profileId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_profileId_reference_key" ON "ReturnRequest"("profileId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_profileId_idempotencyKey_key" ON "ReturnRequest"("profileId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_restockMovementId_key" ON "ReturnItem"("restockMovementId");

-- CreateIndex
CREATE INDEX "ReturnItem_orderLineId_idx" ON "ReturnItem"("orderLineId");

-- CreateIndex
CREATE INDEX "ReturnItem_restockState_idx" ON "ReturnItem"("restockState");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_returnRequestId_orderLineId_key" ON "ReturnItem"("returnRequestId", "orderLineId");

-- CreateIndex
CREATE INDEX "CommerceEvent_profileId_seq_idx" ON "CommerceEvent"("profileId", "seq");

-- CreateIndex
CREATE INDEX "CommerceEvent_subjectType_subjectId_idx" ON "CommerceEvent"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "CommerceEvent_orderId_idx" ON "CommerceEvent"("orderId");

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentItem" ADD CONSTRAINT "FulfilmentItem_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "Fulfilment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentItem" ADD CONSTRAINT "FulfilmentItem_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentItem" ADD CONSTRAINT "FulfilmentItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_refundPaymentId_fkey" FOREIGN KEY ("refundPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_restockMovementId_fkey" FOREIGN KEY ("restockMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- STEP 1. Give every existing product exactly one default variant.
--
-- The id is derived from the product id so the mapping is reproducible and the
-- reconciliation proof can be exact. priceCents is left NULL, which means "inherit the
-- product price" - the default variant must not become a second, divergent price.
-- ---------------------------------------------------------------------------
INSERT INTO "ProductVariant" ("id", "profileId", "productId", "isDefault", "isActive", "title", "ordinal", "sku", "createdAt", "updatedAt")
SELECT
    'var_' || p."id",
    p."profileId",
    p."id",
    true,
    p."isActive",
    'Default',
    0,
    p."sku",
    p."createdAt",
    CURRENT_TIMESTAMP
FROM "DigitalProduct" p;

-- ---------------------------------------------------------------------------
-- STEP 2. Add the column as NULLABLE so the statement is safe on a populated table.
-- ---------------------------------------------------------------------------
ALTER TABLE "InventoryItem" ADD COLUMN "variantId" TEXT;

-- ---------------------------------------------------------------------------
-- STEP 3. Point every existing stock record at its product's default variant.
-- ---------------------------------------------------------------------------
UPDATE "InventoryItem" i
SET "variantId" = 'var_' || i."productId";

-- ---------------------------------------------------------------------------
-- STEP 4. Refuse to continue if any stock record was left unmapped. Failing here aborts
-- the whole migration, which is the only acceptable outcome: the alternative is silently
-- losing a stock row to a NOT NULL violation later, or worse, to a delete.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    unmapped BIGINT;
    orphaned BIGINT;
BEGIN
    SELECT count(*) INTO unmapped FROM "InventoryItem" WHERE "variantId" IS NULL;
    IF unmapped > 0 THEN
        RAISE EXCEPTION 'variant backfill left % InventoryItem rows unmapped', unmapped;
    END IF;
    SELECT count(*) INTO orphaned
      FROM "InventoryItem" i
      LEFT JOIN "ProductVariant" v ON v."id" = i."variantId"
     WHERE v."id" IS NULL;
    IF orphaned > 0 THEN
        RAISE EXCEPTION 'variant backfill produced % InventoryItem rows pointing at a missing variant', orphaned;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 5. Now the column can be tightened and the identity swapped.
-- ---------------------------------------------------------------------------
ALTER TABLE "InventoryItem" ALTER COLUMN "variantId" SET NOT NULL;

DROP INDEX "InventoryItem_productId_locationId_key";

CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

CREATE UNIQUE INDEX "InventoryItem_variantId_locationId_key" ON "InventoryItem"("variantId", "locationId");

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- STEP 6. Guarantees the application cannot bypass.
-- ---------------------------------------------------------------------------
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_priceCents_nonnegative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_compareAtCents_nonnegative" CHECK ("compareAtCents" IS NULL OR "compareAtCents" >= 0);
ALTER TABLE "FulfilmentItem"
  ADD CONSTRAINT "FulfilmentItem_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "ReturnItem"
  ADD CONSTRAINT "ReturnItem_qty_positive" CHECK ("qty" > 0);

-- Exactly one default variant per product. Needs a WHERE clause, which Prisma cannot
-- express; like the CHECK constraints and triggers already in this database it survives
-- `migrate diff` untouched.
CREATE UNIQUE INDEX "ProductVariant_one_default_per_product"
  ON "ProductVariant"("productId") WHERE "isDefault";

-- ---------------------------------------------------------------------------
-- STEP 7. A stock record's productId and variantId may never disagree.
--
-- This is the rule a composite foreign key would have expressed. A trigger is used instead
-- because Prisma's datamodel cannot describe that key, so it would be dropped by every
-- future generated migration.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_inventory_variant_product_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    owner TEXT;
BEGIN
    SELECT v."productId" INTO owner FROM "ProductVariant" v WHERE v."id" = NEW."variantId";
    IF owner IS NULL THEN
        RAISE EXCEPTION 'InventoryItem.variantId % does not exist', NEW."variantId";
    END IF;
    IF owner <> NEW."productId" THEN
        RAISE EXCEPTION 'InventoryItem.productId % does not match the product of variant % (%)',
            NEW."productId", NEW."variantId", owner;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "InventoryItem_variant_product_match"
BEFORE INSERT OR UPDATE ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION "reject_inventory_variant_product_mismatch"();

-- ---------------------------------------------------------------------------
-- STEP 8. Append-only enforcement for the commerce timeline. Reuses the existing
-- reject_append_only_mutation() function from 20260827140000_phase0_foundations rather than
-- defining a seventh equivalent trigger.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "CommerceEvent_append_only"
BEFORE UPDATE OR DELETE ON "CommerceEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
