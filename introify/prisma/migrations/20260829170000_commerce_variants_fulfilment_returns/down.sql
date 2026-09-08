-- Rollback for 20260829170000_commerce_variants_fulfilment_returns.
--
-- ORDER MATTERS AND IS THE WHOLE POINT. InventoryItem_variantId_fkey is ON DELETE CASCADE,
-- so deleting ProductVariant rows while that key exists would cascade-delete every stock
-- record in the database. The foreign key and the column are therefore removed FIRST, the
-- old unique key is restored, and only then are the variants dropped. Every InventoryItem
-- row survives this rollback with its onHand and reserved untouched, which is exactly what
-- the reconciliation harness asserts.
--
-- reject_append_only_mutation() is deliberately NOT dropped: six ledgers depend on it.
-- btree_gist is untouched. DigitalProduct."variantsJson" was never modified.

DROP TRIGGER IF EXISTS "CommerceEvent_append_only" ON "CommerceEvent";
DROP TRIGGER IF EXISTS "InventoryItem_variant_product_match" ON "InventoryItem";
DROP FUNCTION IF EXISTS "reject_inventory_variant_product_mismatch"();

DROP TABLE IF EXISTS "CommerceEvent";
DROP TABLE IF EXISTS "ReturnItem";
DROP TABLE IF EXISTS "ReturnRequest";
DROP TABLE IF EXISTS "FulfilmentItem";
DROP TABLE IF EXISTS "Fulfilment";
DROP TABLE IF EXISTS "ProductVariantOptionValue";
DROP TABLE IF EXISTS "ProductOptionValue";
DROP TABLE IF EXISTS "ProductOption";

-- Detach inventory from variants BEFORE the variants are removed.
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_variantId_fkey";
DROP INDEX IF EXISTS "InventoryItem_variantId_locationId_key";
DROP INDEX IF EXISTS "InventoryItem_productId_idx";
ALTER TABLE "InventoryItem" DROP COLUMN IF EXISTS "variantId";
CREATE UNIQUE INDEX "InventoryItem_productId_locationId_key" ON "InventoryItem"("productId", "locationId");

DROP INDEX IF EXISTS "ProductVariant_one_default_per_product";
DROP TABLE IF EXISTS "ProductVariant";

DROP TYPE IF EXISTS "CommerceEventActor";
DROP TYPE IF EXISTS "CommerceEventSubject";
DROP TYPE IF EXISTS "CommerceEventKind";
DROP TYPE IF EXISTS "ReturnItemRestockState";
DROP TYPE IF EXISTS "ReturnRequestState";
DROP TYPE IF EXISTS "FulfilmentState";
