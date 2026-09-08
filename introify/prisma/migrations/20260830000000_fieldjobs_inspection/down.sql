-- Rollback for 20260830000000_fieldjobs_inspection.
--
-- Five tables, five enums, three triggers and three functions. No pre-existing object is touched
-- and NO ENUM IS MODIFIED, so this rollback needs no type recreation and can return the catalog
-- to a byte-identical state - which is exactly why the migration extended FieldJobEvent by
-- subjectType instead of adding a FieldJobEventKind value.
--
-- reject_append_only_mutation() is deliberately NOT dropped: ten other ledgers depend on it.
-- FieldJob, FieldJobAssignment, Profile, ServiceOffering, InventoryItem and InventoryMovement are
-- untouched - this migration only pointed at them.

DROP TRIGGER IF EXISTS "FieldJobInspectionPart_boundary_guard" ON "FieldJobInspectionPart";
DROP TRIGGER IF EXISTS "FieldJobInspectionItem_template_guard" ON "FieldJobInspectionItem";
DROP TRIGGER IF EXISTS "FieldJobInspection_tenant_guard" ON "FieldJobInspection";

DROP FUNCTION IF EXISTS "reject_fieldjob_inspection_part_boundary"();
DROP FUNCTION IF EXISTS "reject_fieldjob_inspection_item_template_mismatch"();
DROP FUNCTION IF EXISTS "reject_fieldjob_inspection_tenant_mismatch"();

DROP INDEX IF EXISTS "FieldJobInspection_one_open_per_job";

DROP TABLE IF EXISTS "FieldJobInspectionPart";
DROP TABLE IF EXISTS "FieldJobInspectionItem";
DROP TABLE IF EXISTS "FieldJobInspection";
DROP TABLE IF EXISTS "FieldJobInspectionTemplateItem";
DROP TABLE IF EXISTS "FieldJobInspectionTemplate";

DROP TYPE IF EXISTS "FieldJobInvoiceHandoffState";
DROP TYPE IF EXISTS "FieldJobInspectionItemResult";
DROP TYPE IF EXISTS "FieldJobInspectionItemKind";
DROP TYPE IF EXISTS "FieldJobInspectionOutcome";
DROP TYPE IF EXISTS "FieldJobInspectionStatus";
