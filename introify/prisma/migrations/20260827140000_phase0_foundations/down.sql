-- Documented DOWN migration for 20260827140000_phase0_foundations
--
-- Prisma does not execute this file automatically. It is applied only through
-- scripts/one-off/p2-guarded-sql.ts, which refuses to run unless the parsed AND
-- connected database is exactly the authorized disposable rehearsal target.
--
-- Every object dropped here was CREATED by the corresponding up migration.
-- No pre-existing table, column, index, constraint, type or function is touched.
--
-- DROP ORDER is topological, derived from the live catalog rather than assumed.
-- A first attempt ordered by hand failed on 2BP01 (Approval depends on
-- WorkflowStep) and rolled back atomically; the order below is computed from the
-- actual FK edges among the 14 new tables, children strictly before parents, so
-- no CASCADE is needed. CASCADE is deliberately avoided: it could silently drop
-- constraints on pre-existing tables.
--
-- FK edges among the new tables:
--   ActivityEvent->Contact            AgentRun->WorkflowRun
--   Approval->WorkflowRun             Approval->WorkflowStep
--   Contact->Workspace                ContactSourceLink->Contact
--   CopilotAuditEvent->AgentRun       CopilotAuditEvent->WorkflowRun
--   Location->Workspace               Membership->Workspace
--   MembershipLocation->Location      MembershipLocation->Membership
--   ToolCall->WorkflowStep            WorkflowRun->Workspace
--   WorkflowStep->WorkflowRun

DROP TABLE IF EXISTS "MembershipLocation";
DROP TABLE IF EXISTS "ContactSourceLink";
DROP TABLE IF EXISTS "ActivityEvent";
DROP TABLE IF EXISTS "TaskJob";
DROP TABLE IF EXISTS "ToolCall";
DROP TABLE IF EXISTS "Approval";
DROP TABLE IF EXISTS "CopilotAuditEvent";
DROP TABLE IF EXISTS "Location";
DROP TABLE IF EXISTS "Membership";
DROP TABLE IF EXISTS "Contact";
DROP TABLE IF EXISTS "AgentRun";
DROP TABLE IF EXISTS "WorkflowStep";
DROP TABLE IF EXISTS "WorkflowRun";
DROP TABLE IF EXISTS "Workspace";

-- Enum introduced by the up migration
DROP TYPE IF EXISTS "MembershipRole";

-- Append-only enforcement function introduced by the up migration.
-- Its triggers were dropped implicitly with their tables above.
DROP FUNCTION IF EXISTS "reject_append_only_mutation"();

-- Remove this migration from Prisma's ledger so a subsequent `migrate deploy`
-- re-applies it cleanly during the reapply rehearsal.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260827140000_phase0_foundations';
