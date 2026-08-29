-- Rollback for 20260829190000_retainers_and_course_access_levels.
--
-- The interesting part is the enum. Postgres cannot remove a value from an enum type, so this
-- rollback recreates "CaseEventKind" without 'RETAINER' instead of pretending the forward
-- migration's ALTER TYPE was reversible. It refuses to run if any CaseEvent row is already
-- using 'RETAINER': a migration whose new value is in use cannot be rolled back without
-- destroying history, and failing loudly is the only honest outcome.
--
-- reject_append_only_mutation() is deliberately NOT dropped: eight ledgers depend on it.
-- btree_gist is untouched. No pre-existing table, column or index is modified by this file.

DROP TRIGGER IF EXISTS "CourseAccessEvent_append_only" ON "CourseAccessEvent";
DROP TRIGGER IF EXISTS "CaseRetainerDraw_append_only" ON "CaseRetainerDraw";
DROP TRIGGER IF EXISTS "CourseLessonAccess_course_guard" ON "CourseLessonAccess";
DROP TRIGGER IF EXISTS "CourseAccessGrant_course_guard" ON "CourseAccessGrant";
DROP TRIGGER IF EXISTS "CaseRetainerCaseLink_tenant_guard" ON "CaseRetainerCaseLink";
DROP TRIGGER IF EXISTS "CaseRetainerDraw_mismatch_guard" ON "CaseRetainerDraw";

DROP FUNCTION IF EXISTS "reject_lesson_access_course_mismatch"();
DROP FUNCTION IF EXISTS "reject_access_grant_course_mismatch"();
DROP FUNCTION IF EXISTS "reject_retainer_case_link_tenant_mismatch"();
DROP FUNCTION IF EXISTS "reject_retainer_draw_mismatch"();

DROP INDEX IF EXISTS "CourseAccessChange_one_open_per_grant";
DROP INDEX IF EXISTS "CaseRetainerPeriod_one_open_per_retainer";

DROP TABLE IF EXISTS "CourseAccessEvent";
DROP TABLE IF EXISTS "CourseAccessChange";
DROP TABLE IF EXISTS "CourseAccessGrant";
DROP TABLE IF EXISTS "CourseLessonAccess";
DROP TABLE IF EXISTS "CourseAccessLevel";

DROP TABLE IF EXISTS "CaseRetainerDraw";
DROP TABLE IF EXISTS "CaseRetainerPeriod";
DROP TABLE IF EXISTS "CaseRetainerCaseLink";
DROP TABLE IF EXISTS "CaseRetainer";

DROP TYPE IF EXISTS "CourseAccessEventActor";
DROP TYPE IF EXISTS "CourseAccessEventKind";
DROP TYPE IF EXISTS "CourseAccessChangeState";
DROP TYPE IF EXISTS "CourseAccessChangeDirection";
DROP TYPE IF EXISTS "CourseAccessGrantSource";
DROP TYPE IF EXISTS "CourseAccessGrantState";

DROP TYPE IF EXISTS "CaseRetainerDrawKind";
DROP TYPE IF EXISTS "CaseRetainerPeriodState";
DROP TYPE IF EXISTS "CaseRetainerPeriodKind";
DROP TYPE IF EXISTS "CaseRetainerBasis";
DROP TYPE IF EXISTS "CaseRetainerState";

-- Recreate CaseEventKind without 'RETAINER', in its original member order, so the rolled-back
-- catalog is identical to the pre-migration one rather than merely close to it.
DO $$
DECLARE
    in_use BIGINT;
BEGIN
    SELECT count(*) INTO in_use FROM "CaseEvent" WHERE "kind" = 'RETAINER';
    IF in_use > 0 THEN
        RAISE EXCEPTION 'cannot roll back: % CaseEvent rows use kind RETAINER', in_use;
    END IF;
END $$;

ALTER TABLE "CaseEvent" ALTER COLUMN "kind" TYPE TEXT USING "kind"::TEXT;
DROP TYPE "CaseEventKind";
CREATE TYPE "CaseEventKind" AS ENUM ('CREATED', 'STATUS', 'MILESTONE', 'DELIVERABLE', 'DOCUMENT', 'INVOICE', 'TASK', 'APPROVAL', 'NOTE');
ALTER TABLE "CaseEvent" ALTER COLUMN "kind" TYPE "CaseEventKind" USING "kind"::"CaseEventKind";
