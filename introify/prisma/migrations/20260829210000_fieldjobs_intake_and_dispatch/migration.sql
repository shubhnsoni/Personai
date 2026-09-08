-- Wave G4 / P2-013: the shared fieldJobs engine FOUNDATION - intake and dispatch.
--
-- STRICTLY ADDITIVE: four tables, seven enums, six CHECK constraints, two partial unique
-- indexes, two triggers, one trigger function. Zero ADD COLUMN, zero ALTER COLUMN, zero
-- ALTER TYPE, zero DROP of any kind. The build tool asserts all of that and aborts otherwise.
--
-- THIS IS THE FOUNDATION, NOT THE ENGINE. `inspection` - asset checks, parts, completion notes
-- and invoice handoff - is deliberately not built here, and fieldJobs:inspection stays declared
-- `planned` in the capability registry. Declaring it available would be a claim about code that
-- does not exist.
--
-- THE TECHNICIAN MODEL ALREADY EXISTED, SO IT IS REUSED
-- A field technician is an AppointmentResource with kind STAFF. That table is already
-- profile-scoped, already optionally tied to a Location, already carries capacity and isActive,
-- and is already the thing ServiceOffering rows are made eligible for. A separate Technician
-- table would have been a second answer to "who can do this work", and the two would have
-- drifted the first time somebody was added to one and not the other. ServiceOffering is reused
-- for the same reason: it already describes what is being sold and for how long.
--
-- The consequence is that tenancy here is profileId, bridged from Workspace.profileId - the key
-- the appointments and cohort domains already use. That is a requirement rather than a
-- preference: sharing AppointmentResource means sharing its scope.
--
-- A JOB HAPPENS AT A CUSTOMER SITE, NOT AT A Location
-- Location models the owner's own premises and is read by the reservation, appointment and
-- inventory engines. Creating Location rows for customer addresses would pollute it, so the site
-- is free text and FieldJob.originLocationId is only the owner's own premises the job is
-- dispatched FROM.
--
-- A REQUEST IS NOT A JOB
-- FieldJobRequest is separate from FieldJob for the same reason CaseIntake is separate from
-- CaseProject: a declined request must remain a record, and a job that exists must mean somebody
-- committed to it. Collapsing them would make "how many jobs do we have" unanswerable. One
-- request converts to at most one job, enforced by a UNIQUE on FieldJob.requestId.
--
-- WHAT "DISPATCH" DOES NOT MEAN HERE
-- No route is optimised, no distance or travel time is computed, no map provider is contacted,
-- and no technician is notified by email, SMS or push. Dispatch in this migration means
-- assignment and job-card state, nothing more. Whoever adds routing or notification must say so
-- explicitly rather than letting the word carry the claim.
--
-- ONE ACTIVE LEAD PER JOB is a partial unique index, because two leads means nobody is
-- accountable. One ACTIVE assignment per technician per job is a second partial unique index, so
-- a technician can be re-assigned after being released without the first row blocking it.
--
-- DELIBERATE OMISSION, ninth wave running: the five pre-existing profileId DropForeignKey
-- statements are removed programmatically with the count asserted.

-- CreateEnum
CREATE TYPE "FieldJobRequestStatus" AS ENUM ('NEW', 'QUALIFYING', 'QUOTED', 'ACCEPTED', 'DECLINED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "FieldJobStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldJobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FieldJobAssignmentRole" AS ENUM ('LEAD', 'HELPER');

-- CreateEnum
CREATE TYPE "FieldJobAssignmentState" AS ENUM ('ASSIGNED', 'ACCEPTED', 'DECLINED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED', 'RELEASED');

-- CreateEnum
CREATE TYPE "FieldJobEventKind" AS ENUM ('CREATED', 'STATUS', 'ASSIGNMENT', 'SCHEDULE', 'ESTIMATE', 'NOTE');

-- CreateEnum
CREATE TYPE "FieldJobEventActor" AS ENUM ('CUSTOMER', 'TECHNICIAN', 'STAFF', 'SYSTEM');

-- CreateTable
CREATE TABLE "FieldJobRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "serviceOfferingId" TEXT,
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "requesterPhone" TEXT,
    "siteAddress" TEXT,
    "status" "FieldJobRequestStatus" NOT NULL DEFAULT 'NEW',
    "estimateCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "declineReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJob" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "requestId" TEXT,
    "serviceOfferingId" TEXT,
    "originLocationId" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "FieldJobStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "FieldJobPriority" NOT NULL DEFAULT 'NORMAL',
    "siteAddress" TEXT NOT NULL,
    "siteNotes" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "estimateCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dispatchedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJobAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "role" "FieldJobAssignmentRole" NOT NULL DEFAULT 'HELPER',
    "state" "FieldJobAssignmentState" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "onSiteAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "releaseReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "FieldJobEventKind" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "FieldJobEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldJobRequest_profileId_status_createdAt_idx" ON "FieldJobRequest"("profileId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobRequest_profileId_idempotencyKey_key" ON "FieldJobRequest"("profileId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJob_requestId_key" ON "FieldJob"("requestId");

-- CreateIndex
CREATE INDEX "FieldJob_profileId_status_scheduledStartAt_idx" ON "FieldJob"("profileId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "FieldJob_profileId_priority_status_idx" ON "FieldJob"("profileId", "priority", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJob_profileId_reference_key" ON "FieldJob"("profileId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJob_profileId_idempotencyKey_key" ON "FieldJob"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FieldJobAssignment_jobId_state_idx" ON "FieldJobAssignment"("jobId", "state");

-- CreateIndex
CREATE INDEX "FieldJobAssignment_resourceId_state_idx" ON "FieldJobAssignment"("resourceId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobAssignment_jobId_idempotencyKey_key" ON "FieldJobAssignment"("jobId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FieldJobEvent_jobId_seq_idx" ON "FieldJobEvent"("jobId", "seq");

-- CreateIndex
CREATE INDEX "FieldJobEvent_jobId_subjectType_subjectId_idx" ON "FieldJobEvent"("jobId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "FieldJobRequest" ADD CONSTRAINT "FieldJobRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobRequest" ADD CONSTRAINT "FieldJobRequest_serviceOfferingId_fkey" FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJob" ADD CONSTRAINT "FieldJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJob" ADD CONSTRAINT "FieldJob_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FieldJobRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJob" ADD CONSTRAINT "FieldJob_serviceOfferingId_fkey" FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJob" ADD CONSTRAINT "FieldJob_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobAssignment" ADD CONSTRAINT "FieldJobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FieldJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobAssignment" ADD CONSTRAINT "FieldJobAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AppointmentResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobEvent" ADD CONSTRAINT "FieldJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FieldJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guarantees the application cannot bypass.
-- ---------------------------------------------------------------------------

ALTER TABLE "FieldJobRequest"
  ADD CONSTRAINT "FieldJobRequest_estimateCents_nonnegative" CHECK ("estimateCents" IS NULL OR "estimateCents" >= 0);

ALTER TABLE "FieldJob"
  ADD CONSTRAINT "FieldJob_estimateCents_nonnegative" CHECK ("estimateCents" IS NULL OR "estimateCents" >= 0);

-- Both or neither. A job with a start and no end has no duration; a job with an end and no start
-- has no beginning. Either would break every "what is on today" query in a different way.
ALTER TABLE "FieldJob"
  ADD CONSTRAINT "FieldJob_schedule_complete" CHECK (
    ("scheduledStartAt" IS NULL AND "scheduledEndAt" IS NULL)
    OR
    ("scheduledStartAt" IS NOT NULL AND "scheduledEndAt" IS NOT NULL)
  );
ALTER TABLE "FieldJob"
  ADD CONSTRAINT "FieldJob_schedule_ordered" CHECK (
    "scheduledEndAt" IS NULL OR "scheduledStartAt" IS NULL OR "scheduledEndAt" > "scheduledStartAt"
  );

-- A declined assignment must say why, and a released one must too. An unexplained refusal is
-- indistinguishable from a mistake when somebody reads the job card a week later.
ALTER TABLE "FieldJobAssignment"
  ADD CONSTRAINT "FieldJobAssignment_decline_has_reason" CHECK (
    "state" <> 'DECLINED' OR ("declineReason" IS NOT NULL AND length(btrim("declineReason")) > 0)
  );
ALTER TABLE "FieldJobAssignment"
  ADD CONSTRAINT "FieldJobAssignment_release_has_reason" CHECK (
    "state" <> 'RELEASED' OR ("releaseReason" IS NOT NULL AND length(btrim("releaseReason")) > 0)
  );

-- ---------------------------------------------------------------------------
-- Partial unique indexes. Postgres needs the WHERE clause and Prisma cannot express it.
-- ---------------------------------------------------------------------------

-- One active LEAD per job. Two leads means nobody is accountable for the job.
CREATE UNIQUE INDEX "FieldJobAssignment_one_active_lead_per_job"
  ON "FieldJobAssignment"("jobId")
  WHERE "role" = 'LEAD' AND "state" NOT IN ('DECLINED', 'RELEASED');

-- One active assignment per technician per job. Partial rather than a plain unique key, so a
-- technician released from a job can later be assigned to it again without the old row blocking
-- them - and so the history of both assignments survives.
CREATE UNIQUE INDEX "FieldJobAssignment_one_active_per_resource_per_job"
  ON "FieldJobAssignment"("jobId", "resourceId")
  WHERE "state" NOT IN ('DECLINED', 'RELEASED');

-- ---------------------------------------------------------------------------
-- A job and its technician must belong to the same profile. This is the tenant-isolation rule
-- expressed in the database rather than only in the engine, because the engine is not the only
-- possible writer. It is the same shape as the four G3 guards and the Wave G variant guard: a
-- rule a composite foreign key would express if Prisma could describe one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_fieldjob_assignment_tenant_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    job_profile TEXT;
    resource_profile TEXT;
BEGIN
    SELECT j."profileId" INTO job_profile FROM "FieldJob" j WHERE j."id" = NEW."jobId";
    SELECT r."profileId" INTO resource_profile FROM "AppointmentResource" r WHERE r."id" = NEW."resourceId";
    IF job_profile IS NULL OR resource_profile IS NULL THEN
        RAISE EXCEPTION 'FieldJobAssignment references a job or resource that does not exist';
    END IF;
    IF job_profile <> resource_profile THEN
        RAISE EXCEPTION 'job % belongs to profile % but resource % belongs to profile %',
            NEW."jobId", job_profile, NEW."resourceId", resource_profile;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "FieldJobAssignment_tenant_guard"
BEFORE INSERT OR UPDATE ON "FieldJobAssignment"
FOR EACH ROW EXECUTE FUNCTION "reject_fieldjob_assignment_tenant_mismatch"();

-- Append-only enforcement, reusing reject_append_only_mutation() from
-- 20260827140000_phase0_foundations for the tenth ledger in this database.
CREATE TRIGGER "FieldJobEvent_append_only"
BEFORE UPDATE OR DELETE ON "FieldJobEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
