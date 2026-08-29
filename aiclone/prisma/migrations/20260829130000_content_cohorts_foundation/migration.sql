-- Wave D / P2-008: shared content and cohort foundation.
--
-- ADDITIVE. Creates nine enums and eight tables with their indexes and foreign keys,
-- plus one append-only trigger, and adds exactly ONE nullable column to one pre-existing
-- table. Measured, not assumed: the generated diff contained 0 DROP TABLE, 0 DROP COLUMN,
-- 0 ALTER COLUMN and exactly 1 ADD COLUMN.
--
-- THE ONE COLUMN: CourseEnrollment."idempotencyKey" TEXT NULL, with
-- CourseEnrollment_courseId_idempotencyKey_key. Enrolment previously had no idempotency
-- key at all, so a retried enrolment created a duplicate row. NULLs are distinct in
-- Postgres, so the unique index constrains only rows that actually carry a key and every
-- existing row is unaffected. The alternative - a separate cohort-only enrolment table -
-- would have forked the learner's relationship to a course, which is exactly the kind of
-- duplication this wave exists to avoid.
--
-- DESIGN INTENT: promote what exists, do not fork it. The PROGRAM is the pre-existing
-- Course with its CourseModule and CourseLesson children. Learner identity stays Member.
-- The learner's relation to a program stays CourseEnrollment. Per-lesson progress stays
-- LessonCompletion, which is why there is NO progress table: progress is computed from
-- the completion rows that already exist rather than cached into a second place that can
-- disagree with them.
--
-- A Cohort is the genuinely missing concept - a dated, capacity-bounded run of a Course
-- that people attend together. CohortMembership points at the CourseEnrollment instead of
-- copying the learner's email, name or payment reference. Submissions and certificates
-- reference ProfileDocument, the existing upload store. Session venues reference the
-- existing Location. Renewal reminders point at a TaskJob rather than starting a second
-- queue. There is no new payment, messaging or file table anywhere in this migration.
--
-- CERTIFICATE POLICY IS DATA: Cohort carries attendanceThresholdPct,
-- requireAllAssignments and requireAllLessons so eligibility is computed from persisted
-- records against a configured rule, instead of a threshold hidden in code.
--
-- Tenancy is profileId, bridged from the caller's workspace exactly as the appointment
-- domain does, because Course is already profileId-scoped and Workspace.profileId is
-- unique. A second tenant key would have split the course tree.
--
-- DELIBERATE OMISSION, fourth wave running:
-- `prisma migrate diff` again emitted five DropForeignKey statements against
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- Removed programmatically with the count asserted. They are pre-existing drift between
-- schema.prisma and 20260827140000_phase0_foundations. Dropping them would strip
-- referential integrity from five existing tables for reasons unconnected to cohorts.

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('PLANNED', 'ENROLLING', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CohortMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CohortSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CohortAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "CohortSubmissionState" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CohortCertificateState" AS ENUM ('INELIGIBLE', 'ELIGIBLE', 'ISSUED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CohortRenewalState" AS ENUM ('NONE', 'SCHEDULED', 'REMINDED', 'RENEWED', 'LAPSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CohortEventKind" AS ENUM ('CREATED', 'STATUS', 'MEMBERSHIP', 'SESSION', 'ATTENDANCE', 'ASSIGNMENT', 'SUBMISSION', 'CERTIFICATE', 'RENEWAL', 'NOTE');

-- CreateEnum
CREATE TYPE "CohortEventActor" AS ENUM ('LEARNER', 'STAFF', 'SYSTEM');

-- AlterTable
ALTER TABLE "CourseEnrollment" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'PLANNED',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "capacity" INTEGER,
    "attendanceThresholdPct" INTEGER NOT NULL DEFAULT 0,
    "requireAllAssignments" BOOLEAN NOT NULL DEFAULT false,
    "requireAllLessons" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMembership" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "CohortMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "leaveReason" TEXT,
    "renewalState" "CohortRenewalState" NOT NULL DEFAULT 'NONE',
    "renewalDueAt" TIMESTAMP(3),
    "renewalRemindAt" TIMESTAMP(3),
    "renewalTaskJobId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortSession" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "CohortSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "locationId" TEXT,
    "heldAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" "CohortAttendanceStatus" NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortAssignment" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "dueAt" TIMESTAMP(3),
    "maxPoints" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "state" "CohortSubmissionState" NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "points" INTEGER,
    "feedback" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortCertificate" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "state" "CohortCertificateState" NOT NULL DEFAULT 'INELIGIBLE',
    "serial" TEXT,
    "issuedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortEvent" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "CohortEventKind" NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "CohortEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cohort_profileId_status_idx" ON "Cohort"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_courseId_code_key" ON "Cohort"("courseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_profileId_idempotencyKey_key" ON "Cohort"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CohortMembership_cohortId_status_idx" ON "CohortMembership"("cohortId", "status");

-- CreateIndex
CREATE INDEX "CohortMembership_renewalState_renewalRemindAt_idx" ON "CohortMembership"("renewalState", "renewalRemindAt");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMembership_cohortId_enrollmentId_key" ON "CohortMembership"("cohortId", "enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMembership_cohortId_idempotencyKey_key" ON "CohortMembership"("cohortId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CohortSession_cohortId_startsAt_idx" ON "CohortSession"("cohortId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CohortSession_cohortId_ordinal_key" ON "CohortSession"("cohortId", "ordinal");

-- CreateIndex
CREATE INDEX "CohortAttendance_membershipId_status_idx" ON "CohortAttendance"("membershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CohortAttendance_sessionId_membershipId_key" ON "CohortAttendance"("sessionId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortAssignment_cohortId_ordinal_key" ON "CohortAssignment"("cohortId", "ordinal");

-- CreateIndex
CREATE INDEX "CohortSubmission_membershipId_state_idx" ON "CohortSubmission"("membershipId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CohortSubmission_assignmentId_membershipId_key" ON "CohortSubmission"("assignmentId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortSubmission_assignmentId_idempotencyKey_key" ON "CohortSubmission"("assignmentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CohortCertificate_membershipId_key" ON "CohortCertificate"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortCertificate_serial_key" ON "CohortCertificate"("serial");

-- CreateIndex
CREATE INDEX "CohortCertificate_state_idx" ON "CohortCertificate"("state");

-- CreateIndex
CREATE INDEX "CohortEvent_cohortId_seq_idx" ON "CohortEvent"("cohortId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_idempotencyKey_key" ON "CourseEnrollment"("courseId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_renewalTaskJobId_fkey" FOREIGN KEY ("renewalTaskJobId") REFERENCES "TaskJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSession" ADD CONSTRAINT "CohortSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSession" ADD CONSTRAINT "CohortSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAttendance" ADD CONSTRAINT "CohortAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CohortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAttendance" ADD CONSTRAINT "CohortAttendance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CohortMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAssignment" ADD CONSTRAINT "CohortAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSubmission" ADD CONSTRAINT "CohortSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CohortAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSubmission" ADD CONSTRAINT "CohortSubmission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CohortMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSubmission" ADD CONSTRAINT "CohortSubmission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProfileDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortCertificate" ADD CONSTRAINT "CohortCertificate_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CohortMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortCertificate" ADD CONSTRAINT "CohortCertificate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProfileDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortEvent" ADD CONSTRAINT "CohortEvent_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the cohort timeline. Reuses the existing
-- reject_append_only_mutation() function from 20260827140000_phase0_foundations
-- rather than defining another equivalent trigger.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "CohortEvent_append_only"
BEFORE UPDATE OR DELETE ON "CohortEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
