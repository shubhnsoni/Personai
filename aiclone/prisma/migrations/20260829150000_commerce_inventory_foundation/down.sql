-- Rollback for 20260829150000_commerce_inventory_foundation.
--
-- Drops only what the migration created, in dependency order. It deliberately does NOT
-- drop reject_append_only_mutation(): five ledgers now depend on it. It does not touch
-- btree_gist either, which this migration did not install. DigitalProduct."stock" was
-- never modified, so there is nothing to restore.

DROP TRIGGER IF EXISTS "InventoryMovement_append_only" ON "InventoryMovement";

DROP TABLE IF EXISTS "InventoryReservation";
DROP TABLE IF EXISTS "InventoryMovement";
DROP TABLE IF EXISTS "InventoryItem";

DROP TYPE IF EXISTS "InventoryReservationState";
DROP TYPE IF EXISTS "InventoryMovementActor";
DROP TYPE IF EXISTS "InventoryMovementKind";
