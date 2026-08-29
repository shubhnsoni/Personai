-- Rollback for 20260829130000_content_cohorts_foundation.
--
-- Drops only what the migration created, in dependency order, then removes the one
-- additive column and its unique index. It deliberately does NOT drop
-- reject_append_only_mutation(): five ledgers now depend on it. It does not touch
-- btree_gist either, which this migration did not install.

DROP TRIGGER IF EXISTS "CohortEvent_append_only" ON "CohortEvent";

DROP TABLE IF EXISTS "CohortEvent";
DROP TABLE IF EXISTS "CohortCertificate";
DROP TABLE IF EXISTS "CohortSubmission";
DROP TABLE IF EXISTS "CohortAssignment";
DROP TABLE IF EXISTS "CohortAttendance";
DROP TABLE IF EXISTS "CohortSession";
DROP TABLE IF EXISTS "CohortMembership";
DROP TABLE IF EXISTS "Cohort";

DROP INDEX IF EXISTS "CourseEnrollment_courseId_idempotencyKey_key";
ALTER TABLE "CourseEnrollment" DROP COLUMN IF EXISTS "idempotencyKey";

DROP TYPE IF EXISTS "CohortEventActor";
DROP TYPE IF EXISTS "CohortEventKind";
DROP TYPE IF EXISTS "CohortRenewalState";
DROP TYPE IF EXISTS "CohortCertificateState";
DROP TYPE IF EXISTS "CohortSubmissionState";
DROP TYPE IF EXISTS "CohortAttendanceStatus";
DROP TYPE IF EXISTS "CohortSessionStatus";
DROP TYPE IF EXISTS "CohortMembershipStatus";
DROP TYPE IF EXISTS "CohortStatus";
