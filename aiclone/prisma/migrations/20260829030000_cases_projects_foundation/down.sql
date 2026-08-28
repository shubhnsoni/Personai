-- Documented DOWN migration for 20260829030000_cases_projects_foundation
--
-- Prisma does not execute this file automatically. It is applied only through
-- scripts/one-off/p2-guarded-sql.ts, which refuses unless BOTH the parsed and the
-- connected database are exactly the authorized disposable rehearsal target and a
-- non-empty external backup is present.
--
-- Every object dropped here was CREATED by the corresponding up migration. No
-- pre-existing table, column, index, constraint, type or function is touched, and this
-- migration added none, so rollback is a pure removal.
--
-- DROP ORDER is topological, children strictly before parents:
--   CaseEvent, CaseTaskLink, CaseApprovalLink, CaseInvoice, CaseDocumentRequest and
--   CaseDeliverable all reference CaseProject (CaseDeliverable also references
--   CaseMilestone); CaseBrief and CaseMilestone reference CaseProject; CaseProject
--   references CaseIntake. CASCADE is deliberately avoided because it could silently drop
--   constraints on pre-existing tables.
--
-- The CaseEvent_append_only trigger is dropped implicitly with its table.

DROP TABLE IF EXISTS "CaseEvent";
DROP TABLE IF EXISTS "CaseTaskLink";
DROP TABLE IF EXISTS "CaseApprovalLink";
DROP TABLE IF EXISTS "CaseInvoice";
DROP TABLE IF EXISTS "CaseDocumentRequest";
DROP TABLE IF EXISTS "CaseDeliverable";
DROP TABLE IF EXISTS "CaseMilestone";
DROP TABLE IF EXISTS "CaseBrief";
DROP TABLE IF EXISTS "CaseProject";
DROP TABLE IF EXISTS "CaseIntake";

-- Enums introduced by the up migration.
DROP TYPE IF EXISTS "CaseEventActor";
DROP TYPE IF EXISTS "CaseEventKind";
DROP TYPE IF EXISTS "CaseInvoiceState";
DROP TYPE IF EXISTS "CaseDocumentRequestStatus";
DROP TYPE IF EXISTS "CaseDeliverableStatus";
DROP TYPE IF EXISTS "CaseMilestoneStatus";
DROP TYPE IF EXISTS "CaseIntakeStatus";
DROP TYPE IF EXISTS "CaseStatus";

-- NOT dropped, deliberately:
--   * reject_append_only_mutation() belongs to 20260827140000_phase0_foundations and
--     ActivityEvent, CopilotAuditEvent, ReservationEvent and AppointmentEvent all still
--     depend on it.
--   * btree_gist belongs to 20260828170000_restaurant_reservations and is required by
--     Reservation_no_overlap and Booking_resource_no_overlap. This migration neither
--     installed nor uses it.

-- Remove this migration from Prisma's ledger so a subsequent `migrate deploy`
-- re-applies it cleanly during the reapply rehearsal.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260829030000_cases_projects_foundation';
