-- Rollback for 20260829210000_fieldjobs_intake_and_dispatch.
--
-- Four tables, seven enums, two triggers and one function. No pre-existing object is touched and
-- no enum is modified, so unlike the first G3 migration this rollback needs no type recreation.
--
-- reject_append_only_mutation() is deliberately NOT dropped: nine other ledgers depend on it.
-- AppointmentResource, ServiceOffering and Location are untouched - this migration only pointed
-- at them.

DROP TRIGGER IF EXISTS "FieldJobEvent_append_only" ON "FieldJobEvent";
DROP TRIGGER IF EXISTS "FieldJobAssignment_tenant_guard" ON "FieldJobAssignment";
DROP FUNCTION IF EXISTS "reject_fieldjob_assignment_tenant_mismatch"();

DROP INDEX IF EXISTS "FieldJobAssignment_one_active_per_resource_per_job";
DROP INDEX IF EXISTS "FieldJobAssignment_one_active_lead_per_job";

DROP TABLE IF EXISTS "FieldJobEvent";
DROP TABLE IF EXISTS "FieldJobAssignment";
DROP TABLE IF EXISTS "FieldJob";
DROP TABLE IF EXISTS "FieldJobRequest";

DROP TYPE IF EXISTS "FieldJobEventActor";
DROP TYPE IF EXISTS "FieldJobEventKind";
DROP TYPE IF EXISTS "FieldJobAssignmentState";
DROP TYPE IF EXISTS "FieldJobAssignmentRole";
DROP TYPE IF EXISTS "FieldJobPriority";
DROP TYPE IF EXISTS "FieldJobStatus";
DROP TYPE IF EXISTS "FieldJobRequestStatus";
