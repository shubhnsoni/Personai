-- Rollback for 20260830010000_blueprint_installation.
--
-- Two tables, two enums, three triggers and two functions. No pre-existing object is touched and
-- NO ENUM IS MODIFIED, so this rollback needs no type recreation and can return the catalog to a
-- byte-identical state.
--
-- reject_append_only_mutation() is deliberately NOT dropped: ten other ledgers depend on it. Only
-- the trigger that references it is removed.
--
-- Workspace and Profile are untouched - this migration only pointed at them.

DROP TRIGGER IF EXISTS "BlueprintInstallationEvent_append_only" ON "BlueprintInstallationEvent";
DROP TRIGGER IF EXISTS "BlueprintInstallation_supersession_guard" ON "BlueprintInstallation";
DROP TRIGGER IF EXISTS "BlueprintInstallationEvent_tenant_guard" ON "BlueprintInstallationEvent";

DROP FUNCTION IF EXISTS "reject_blueprint_installation_supersession_mismatch"();
DROP FUNCTION IF EXISTS "reject_blueprint_installation_event_tenant_mismatch"();

DROP INDEX IF EXISTS "BlueprintInstallation_one_active_per_workspace";

DROP TABLE IF EXISTS "BlueprintInstallationEvent";
DROP TABLE IF EXISTS "BlueprintInstallation";

DROP TYPE IF EXISTS "BlueprintInstallationEventKind";
DROP TYPE IF EXISTS "BlueprintInstallationState";
