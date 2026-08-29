-- Wave G3 / P2-012: retainers for cases and projects, and access levels for courses.
--
-- Nine tables, eleven enums, twelve CHECK constraints, two partial unique indexes, six
-- triggers and four trigger functions. Additive except for a single statement, enumerated by
-- exact text in the build tool, which aborts if the generated diff contains any ADD COLUMN,
-- ALTER COLUMN, DROP TABLE, DROP COLUMN, DROP INDEX, or any DROP CONSTRAINT other than the
-- five pre-existing profileId drops.
--
-- THE ONE NON-ADDITIVE STATEMENT
--     ALTER TYPE "CaseEventKind" ADD VALUE 'RETAINER' BEFORE 'NOTE';
-- A retainer event needs a kind of its own. The alternative was to reuse 'NOTE' with a
-- discriminator smuggled into the free-text `to` column, the way brief events already do.
-- That was rejected: a query for retainer history would become
--     WHERE kind = 'NOTE' AND "to" LIKE 'RETAINER%'
-- which is the sort of encoding that quietly becomes a lie. CohortEventKind already carries a
-- domain-specific 'RENEWAL' member, so this is the established shape.
--
-- BEFORE 'NOTE' is not decoration. Prisma emits a bare ADD VALUE, which Postgres appends at
-- the END of the enum, leaving the database reading (..., APPROVAL, NOTE, RETAINER) while
-- schema.prisma reads (..., APPROVAL, RETAINER, NOTE). Postgres cannot reorder an enum
-- afterwards, so the position is decided at insertion time or never. The build tool rewrites
-- the statement to name the position, with the substitution counted and asserted, so there is
-- no order divergence for a later wave to trip over.
--
-- Postgres cannot remove an enum value, so down.sql recreates the type rather than pretending
-- the rollback is a no-op. It refuses to run if any CaseEvent row is already using 'RETAINER',
-- which is the correct behaviour: a migration whose new value is in use cannot be rolled back
-- without losing data.
--
-- PART ONE - RETAINERS
--
-- A retainer is an AGREEMENT plus a DRAW-DOWN LEDGER, not a payment. Nothing here charges
-- anything. CaseRetainerPeriod.billingState mirrors the existing CaseInvoiceState vocabulary
-- and CaseRetainerPeriod.invoiceId points at a real CaseInvoice row; money movement stays with
-- Payment, exactly as it does for cases today.
--
-- It is workspace-scoped and linked to cases through CaseRetainerCaseLink rather than owning a
-- single caseId, because a retainer is an agreement with a client that work from several cases
-- draws against. Tying it to one case would make "renewal period" meaningless - you would be
-- renewing per case rather than per agreement.
--
-- The allowance is SNAPSHOT onto each period rather than read from the agreement, so amending
-- the agreement cannot rewrite what a closed period included.
--
-- OVERAGE IS ALLOWED AND REPORTED, NOT PREVENTED. used may exceed included. Refusing a draw
-- once an allowance is spent would misrepresent work that was actually done; the honest
-- behaviour is to record it and show the overage. What IS constrained is that used can never
-- go negative, that a draw must be denominated in the same basis as its period, that a draw
-- may only name a case the retainer is actually linked to, and that a draw may only belong to
-- a period of its own retainer.
--
-- CaseRetainerDraw stores the signed delta AND the resulting used balance, the same
-- self-verifying shape as InventoryMovement: replaying the deltas must reproduce the stored
-- after-values. It is append-only, enforced by a trigger.
--
-- PART TWO - COURSE ACCESS LEVELS
--
-- This is the first real content-visibility decision in the repository. Until now any ACTIVE
-- or COMPLETED enrolment returned every module and every lesson of a course, and
-- CourseLesson.isFree was written by importers and enforced by nothing.
--
-- BACKWARD COMPATIBILITY IS THE DEFAULT, NOT A MIGRATION STEP. A lesson with no
-- CourseLessonAccess row is visible to every tier. No existing course has such rows, so every
-- existing course behaves exactly as it does today and no backfill is required. That is why
-- this part needs no data migration at all: the absence of a rule means "no restriction",
-- which is the pre-existing behaviour rather than a new interpretation of it.
--
-- Tenancy follows the cohort domain exactly: profileId, bridged from Workspace.profileId. No
-- Cohort* or Course* table gains a workspaceId.
--
-- CourseAccessGrant is keyed on enrollmentId (UNIQUE), one grant per enrolment, because the
-- enrolment is already the learner-to-course record the content reader resolves. Making the
-- enrolment the identity means the grant needs no idempotency key: asking twice finds the same
-- row. CourseAccessChange does carry one, because a change genuinely can be replayed.
--
-- rank is what makes UPGRADE and DOWNGRADE derivable from data instead of trusted from the
-- caller. A CHECK forbids a change whose two tiers are the same row.
--
-- NO PAYMENT EXECUTION ANYWHERE. CourseAccessLevel.priceCents describes a tier for an owner;
-- nothing reads it to charge anybody. CourseAccessGrant.paymentId and
-- CourseAccessChange.paymentId are references to charges that happened elsewhere, deliberately
-- bare strings with no foreign key - Payment is profile-scoped while this tree hangs off a
-- course, the same reason CaseInvoice.paymentId is a bare string.
--
-- DELIBERATE OMISSION, seventh wave running:
-- `prisma migrate diff` again emitted five DropForeignKey statements against
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- Removed programmatically with the count asserted. They are pre-existing drift between
-- schema.prisma and 20260827140000_phase0_foundations.

-- CreateEnum
CREATE TYPE "CaseRetainerState" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CaseRetainerBasis" AS ENUM ('UNITS', 'VALUE');

-- CreateEnum
CREATE TYPE "CaseRetainerPeriodKind" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CaseRetainerPeriodState" AS ENUM ('OPEN', 'CLOSED', 'RENEWED', 'LAPSED');

-- CreateEnum
CREATE TYPE "CaseRetainerDrawKind" AS ENUM ('DRAW', 'CREDIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CourseAccessGrantState" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CourseAccessGrantSource" AS ENUM ('MANUAL', 'PURCHASE', 'COHORT');

-- CreateEnum
CREATE TYPE "CourseAccessChangeDirection" AS ENUM ('UPGRADE', 'DOWNGRADE');

-- CreateEnum
CREATE TYPE "CourseAccessChangeState" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseAccessEventKind" AS ENUM ('LEVEL', 'VISIBILITY', 'GRANT', 'CHANGE', 'NOTE');

-- CreateEnum
CREATE TYPE "CourseAccessEventActor" AS ENUM ('LEARNER', 'STAFF', 'SYSTEM');

-- AlterEnum
ALTER TYPE "CaseEventKind" ADD VALUE 'RETAINER' BEFORE 'NOTE';

-- CreateTable
CREATE TABLE "CaseRetainer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" "CaseRetainerState" NOT NULL DEFAULT 'DRAFT',
    "basis" "CaseRetainerBasis" NOT NULL,
    "includedUnits" INTEGER,
    "includedValueCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "periodKind" "CaseRetainerPeriodKind" NOT NULL DEFAULT 'MONTHLY',
    "periodDays" INTEGER,
    "rolloverAllowed" BOOLEAN NOT NULL DEFAULT false,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRetainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRetainerCaseLink" (
    "retainerId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRetainerCaseLink_pkey" PRIMARY KEY ("retainerId","caseId")
);

-- CreateTable
CREATE TABLE "CaseRetainerPeriod" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "includedUnits" INTEGER,
    "includedValueCents" INTEGER,
    "usedUnits" INTEGER NOT NULL DEFAULT 0,
    "usedValueCents" INTEGER NOT NULL DEFAULT 0,
    "state" "CaseRetainerPeriodState" NOT NULL DEFAULT 'OPEN',
    "billingState" "CaseInvoiceState" NOT NULL DEFAULT 'NONE',
    "invoiceId" TEXT,
    "closedAt" TIMESTAMP(3),
    "renewedAt" TIMESTAMP(3),
    "lapsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRetainerPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRetainerDraw" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "caseId" TEXT,
    "seq" BIGSERIAL NOT NULL,
    "kind" "CaseRetainerDrawKind" NOT NULL,
    "unitsDelta" INTEGER,
    "valueDeltaCents" INTEGER,
    "usedUnitsAfter" INTEGER NOT NULL,
    "usedValueCentsAfter" INTEGER NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "actor" "CaseEventActor" NOT NULL,
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRetainerDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAccessLevel" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAccessLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLessonAccess" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "accessLevelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAccessGrant" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "accessLevelId" TEXT NOT NULL,
    "state" "CourseAccessGrantState" NOT NULL DEFAULT 'PENDING',
    "source" "CourseAccessGrantSource" NOT NULL DEFAULT 'MANUAL',
    "grantedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAccessChange" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "fromAccessLevelId" TEXT NOT NULL,
    "toAccessLevelId" TEXT NOT NULL,
    "direction" "CourseAccessChangeDirection" NOT NULL,
    "state" "CourseAccessChangeState" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "decisionNote" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "invoiceRef" TEXT,
    "paymentId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAccessChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAccessEvent" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "CourseAccessEventKind" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "CourseAccessEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseRetainer_workspaceId_state_idx" ON "CaseRetainer"("workspaceId", "state");

-- CreateIndex
CREATE INDEX "CaseRetainer_contactId_idx" ON "CaseRetainer"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRetainer_workspaceId_reference_key" ON "CaseRetainer"("workspaceId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRetainer_workspaceId_idempotencyKey_key" ON "CaseRetainer"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CaseRetainerCaseLink_caseId_idx" ON "CaseRetainerCaseLink"("caseId");

-- CreateIndex
CREATE INDEX "CaseRetainerPeriod_retainerId_state_idx" ON "CaseRetainerPeriod"("retainerId", "state");

-- CreateIndex
CREATE INDEX "CaseRetainerPeriod_invoiceId_idx" ON "CaseRetainerPeriod"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRetainerPeriod_retainerId_ordinal_key" ON "CaseRetainerPeriod"("retainerId", "ordinal");

-- CreateIndex
CREATE INDEX "CaseRetainerDraw_retainerId_seq_idx" ON "CaseRetainerDraw"("retainerId", "seq");

-- CreateIndex
CREATE INDEX "CaseRetainerDraw_periodId_seq_idx" ON "CaseRetainerDraw"("periodId", "seq");

-- CreateIndex
CREATE INDEX "CaseRetainerDraw_caseId_idx" ON "CaseRetainerDraw"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRetainerDraw_periodId_idempotencyKey_key" ON "CaseRetainerDraw"("periodId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CourseAccessLevel_profileId_isActive_idx" ON "CourseAccessLevel"("profileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccessLevel_courseId_key_key" ON "CourseAccessLevel"("courseId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccessLevel_courseId_rank_key" ON "CourseAccessLevel"("courseId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLessonAccess_lessonId_key" ON "CourseLessonAccess"("lessonId");

-- CreateIndex
CREATE INDEX "CourseLessonAccess_accessLevelId_idx" ON "CourseLessonAccess"("accessLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccessGrant_enrollmentId_key" ON "CourseAccessGrant"("enrollmentId");

-- CreateIndex
CREATE INDEX "CourseAccessGrant_accessLevelId_state_idx" ON "CourseAccessGrant"("accessLevelId", "state");

-- CreateIndex
CREATE INDEX "CourseAccessGrant_state_expiresAt_idx" ON "CourseAccessGrant"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "CourseAccessChange_grantId_state_idx" ON "CourseAccessChange"("grantId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccessChange_grantId_idempotencyKey_key" ON "CourseAccessChange"("grantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CourseAccessEvent_courseId_seq_idx" ON "CourseAccessEvent"("courseId", "seq");

-- CreateIndex
CREATE INDEX "CourseAccessEvent_courseId_subjectType_subjectId_idx" ON "CourseAccessEvent"("courseId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "CaseRetainer" ADD CONSTRAINT "CaseRetainer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainer" ADD CONSTRAINT "CaseRetainer_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerCaseLink" ADD CONSTRAINT "CaseRetainerCaseLink_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "CaseRetainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerCaseLink" ADD CONSTRAINT "CaseRetainerCaseLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerPeriod" ADD CONSTRAINT "CaseRetainerPeriod_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "CaseRetainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerPeriod" ADD CONSTRAINT "CaseRetainerPeriod_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerDraw" ADD CONSTRAINT "CaseRetainerDraw_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "CaseRetainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerDraw" ADD CONSTRAINT "CaseRetainerDraw_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CaseRetainerPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRetainerDraw" ADD CONSTRAINT "CaseRetainerDraw_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessLevel" ADD CONSTRAINT "CourseAccessLevel_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessLevel" ADD CONSTRAINT "CourseAccessLevel_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonAccess" ADD CONSTRAINT "CourseLessonAccess_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonAccess" ADD CONSTRAINT "CourseLessonAccess_accessLevelId_fkey" FOREIGN KEY ("accessLevelId") REFERENCES "CourseAccessLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessGrant" ADD CONSTRAINT "CourseAccessGrant_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessGrant" ADD CONSTRAINT "CourseAccessGrant_accessLevelId_fkey" FOREIGN KEY ("accessLevelId") REFERENCES "CourseAccessLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessChange" ADD CONSTRAINT "CourseAccessChange_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "CourseAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessChange" ADD CONSTRAINT "CourseAccessChange_fromAccessLevelId_fkey" FOREIGN KEY ("fromAccessLevelId") REFERENCES "CourseAccessLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessChange" ADD CONSTRAINT "CourseAccessChange_toAccessLevelId_fkey" FOREIGN KEY ("toAccessLevelId") REFERENCES "CourseAccessLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccessEvent" ADD CONSTRAINT "CourseAccessEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guarantees the application cannot bypass. Prisma cannot express any of these, and six
-- migrations of evidence say `migrate diff` leaves them alone.
-- ---------------------------------------------------------------------------

-- A retainer is denominated in units OR in money, never both and never neither. A retainer
-- that is both is a retainer nobody can reconcile.
ALTER TABLE "CaseRetainer"
  ADD CONSTRAINT "CaseRetainer_basis_matches_included" CHECK (
    ("basis" = 'UNITS' AND "includedUnits" IS NOT NULL AND "includedValueCents" IS NULL)
    OR
    ("basis" = 'VALUE' AND "includedValueCents" IS NOT NULL AND "includedUnits" IS NULL)
  );
ALTER TABLE "CaseRetainer"
  ADD CONSTRAINT "CaseRetainer_includedUnits_positive" CHECK ("includedUnits" IS NULL OR "includedUnits" > 0);
ALTER TABLE "CaseRetainer"
  ADD CONSTRAINT "CaseRetainer_includedValueCents_positive" CHECK ("includedValueCents" IS NULL OR "includedValueCents" > 0);

-- CUSTOM is the only period kind that carries a day count, and it must carry one. Both halves
-- matter: a CUSTOM retainer with no length has no renewal date, and a MONTHLY retainer with a
-- day count has two contradictory answers.
ALTER TABLE "CaseRetainer"
  ADD CONSTRAINT "CaseRetainer_periodDays_matches_kind" CHECK (
    ("periodKind" = 'CUSTOM' AND "periodDays" IS NOT NULL AND "periodDays" > 0)
    OR
    ("periodKind" <> 'CUSTOM' AND "periodDays" IS NULL)
  );

ALTER TABLE "CaseRetainerPeriod"
  ADD CONSTRAINT "CaseRetainerPeriod_dates_ordered" CHECK ("endsOn" > "startsOn");
ALTER TABLE "CaseRetainerPeriod"
  ADD CONSTRAINT "CaseRetainerPeriod_used_nonnegative" CHECK ("usedUnits" >= 0 AND "usedValueCents" >= 0);
ALTER TABLE "CaseRetainerPeriod"
  ADD CONSTRAINT "CaseRetainerPeriod_included_single_basis" CHECK (
    (("includedUnits" IS NOT NULL)::int + (("includedValueCents" IS NOT NULL))::int) = 1
  );

-- A draw is denominated in exactly one basis, and it always records the balance it produced.
ALTER TABLE "CaseRetainerDraw"
  ADD CONSTRAINT "CaseRetainerDraw_delta_single_basis" CHECK (
    (("unitsDelta" IS NOT NULL)::int + (("valueDeltaCents" IS NOT NULL))::int) = 1
  );
ALTER TABLE "CaseRetainerDraw"
  ADD CONSTRAINT "CaseRetainerDraw_after_nonnegative" CHECK ("usedUnitsAfter" >= 0 AND "usedValueCentsAfter" >= 0);
ALTER TABLE "CaseRetainerDraw"
  ADD CONSTRAINT "CaseRetainerDraw_delta_nonzero" CHECK (
    COALESCE("unitsDelta", 0) <> 0 OR COALESCE("valueDeltaCents", 0) <> 0
  );

ALTER TABLE "CourseAccessLevel"
  ADD CONSTRAINT "CourseAccessLevel_rank_positive" CHECK ("rank" >= 1);
ALTER TABLE "CourseAccessLevel"
  ADD CONSTRAINT "CourseAccessLevel_priceCents_nonnegative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

-- A change between two tiers that are the same row is not a change.
ALTER TABLE "CourseAccessChange"
  ADD CONSTRAINT "CourseAccessChange_levels_differ" CHECK ("fromAccessLevelId" <> "toAccessLevelId");

ALTER TABLE "CourseAccessGrant"
  ADD CONSTRAINT "CourseAccessGrant_expiry_after_grant" CHECK (
    "expiresAt" IS NULL OR "grantedAt" IS NULL OR "expiresAt" > "grantedAt"
  );

-- ---------------------------------------------------------------------------
-- Partial unique indexes. Postgres needs the WHERE clause and Prisma cannot express it.
-- ---------------------------------------------------------------------------

-- One open period per retainer. Two open periods would mean two answers to "what is the
-- current allowance", which is the ambiguity this whole table exists to remove.
CREATE UNIQUE INDEX "CaseRetainerPeriod_one_open_per_retainer"
  ON "CaseRetainerPeriod"("retainerId") WHERE "state" = 'OPEN';

-- One in-flight tier change per grant. Two simultaneous upgrades would race to rewrite the
-- same entitlement.
CREATE UNIQUE INDEX "CourseAccessChange_one_open_per_grant"
  ON "CourseAccessChange"("grantId") WHERE "state" IN ('REQUESTED', 'APPROVED');

-- ---------------------------------------------------------------------------
-- Cross-row invariants. Each of these is a rule a composite foreign key would express if
-- Prisma could describe one; a trigger is invisible to `migrate diff`, which is why the
-- existing eight triggers in this database have survived every generated migration.
-- ---------------------------------------------------------------------------

-- A draw may only belong to a period of its own retainer, and may only name a case the
-- retainer is actually linked to. Without the first rule a draw could consume another
-- client's allowance; without the second, work could be billed to an agreement that never
-- covered it.
CREATE OR REPLACE FUNCTION "reject_retainer_draw_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    period_retainer TEXT;
    period_included_units INT;
    period_included_value INT;
    linked BIGINT;
BEGIN
    SELECT p."retainerId", p."includedUnits", p."includedValueCents"
      INTO period_retainer, period_included_units, period_included_value
      FROM "CaseRetainerPeriod" p WHERE p."id" = NEW."periodId";
    IF period_retainer IS NULL THEN
        RAISE EXCEPTION 'CaseRetainerDraw.periodId % does not exist', NEW."periodId";
    END IF;
    IF period_retainer <> NEW."retainerId" THEN
        RAISE EXCEPTION 'CaseRetainerDraw.retainerId % does not own period % (owned by %)',
            NEW."retainerId", NEW."periodId", period_retainer;
    END IF;

    -- A units draw against a money period, or the reverse, would produce a balance in a
    -- currency the period does not measure.
    IF NEW."unitsDelta" IS NOT NULL AND period_included_units IS NULL THEN
        RAISE EXCEPTION 'CaseRetainerDraw % is denominated in units but period % is denominated in value',
            NEW."id", NEW."periodId";
    END IF;
    IF NEW."valueDeltaCents" IS NOT NULL AND period_included_value IS NULL THEN
        RAISE EXCEPTION 'CaseRetainerDraw % is denominated in value but period % is denominated in units',
            NEW."id", NEW."periodId";
    END IF;

    IF NEW."caseId" IS NOT NULL THEN
        SELECT count(*) INTO linked FROM "CaseRetainerCaseLink" l
         WHERE l."retainerId" = NEW."retainerId" AND l."caseId" = NEW."caseId";
        IF linked = 0 THEN
            RAISE EXCEPTION 'case % is not linked to retainer %, so it cannot draw against it',
                NEW."caseId", NEW."retainerId";
        END IF;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "CaseRetainerDraw_mismatch_guard"
BEFORE INSERT ON "CaseRetainerDraw"
FOR EACH ROW EXECUTE FUNCTION "reject_retainer_draw_mismatch"();

-- A retainer and the cases linked to it must belong to the same workspace. This is the
-- tenant-isolation rule expressed in the database rather than only in the engine.
CREATE OR REPLACE FUNCTION "reject_retainer_case_link_tenant_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    retainer_ws TEXT;
    case_ws TEXT;
BEGIN
    SELECT r."workspaceId" INTO retainer_ws FROM "CaseRetainer" r WHERE r."id" = NEW."retainerId";
    SELECT c."workspaceId" INTO case_ws FROM "CaseProject" c WHERE c."id" = NEW."caseId";
    IF retainer_ws IS NULL OR case_ws IS NULL THEN
        RAISE EXCEPTION 'CaseRetainerCaseLink references a retainer or case that does not exist';
    END IF;
    IF retainer_ws <> case_ws THEN
        RAISE EXCEPTION 'retainer % belongs to workspace % but case % belongs to workspace %',
            NEW."retainerId", retainer_ws, NEW."caseId", case_ws;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "CaseRetainerCaseLink_tenant_guard"
BEFORE INSERT OR UPDATE ON "CaseRetainerCaseLink"
FOR EACH ROW EXECUTE FUNCTION "reject_retainer_case_link_tenant_mismatch"();

-- An entitlement must name a tier of the course the learner is actually enrolled on.
-- Otherwise a learner could hold a tier from someone else's course, and content visibility
-- would silently answer from the wrong catalogue.
CREATE OR REPLACE FUNCTION "reject_access_grant_course_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    level_course TEXT;
    enrollment_course TEXT;
BEGIN
    SELECT l."courseId" INTO level_course FROM "CourseAccessLevel" l WHERE l."id" = NEW."accessLevelId";
    SELECT e."courseId" INTO enrollment_course FROM "CourseEnrollment" e WHERE e."id" = NEW."enrollmentId";
    IF level_course IS NULL OR enrollment_course IS NULL THEN
        RAISE EXCEPTION 'CourseAccessGrant references an access level or enrolment that does not exist';
    END IF;
    IF level_course <> enrollment_course THEN
        RAISE EXCEPTION 'access level % belongs to course % but enrolment % is on course %',
            NEW."accessLevelId", level_course, NEW."enrollmentId", enrollment_course;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "CourseAccessGrant_course_guard"
BEFORE INSERT OR UPDATE ON "CourseAccessGrant"
FOR EACH ROW EXECUTE FUNCTION "reject_access_grant_course_mismatch"();

-- A visibility rule must name a tier of the course the lesson belongs to, reached through the
-- lesson's module. Without this a tier from one course could gate a lesson in another, and the
-- rule would be unreachable rather than merely wrong.
CREATE OR REPLACE FUNCTION "reject_lesson_access_course_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    level_course TEXT;
    lesson_course TEXT;
BEGIN
    SELECT l."courseId" INTO level_course FROM "CourseAccessLevel" l WHERE l."id" = NEW."accessLevelId";
    SELECT m."courseId" INTO lesson_course
      FROM "CourseLesson" les JOIN "CourseModule" m ON m."id" = les."moduleId"
     WHERE les."id" = NEW."lessonId";
    IF level_course IS NULL OR lesson_course IS NULL THEN
        RAISE EXCEPTION 'CourseLessonAccess references an access level or lesson that does not exist';
    END IF;
    IF level_course <> lesson_course THEN
        RAISE EXCEPTION 'access level % belongs to course % but lesson % belongs to course %',
            NEW."accessLevelId", level_course, NEW."lessonId", lesson_course;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "CourseLessonAccess_course_guard"
BEFORE INSERT OR UPDATE ON "CourseLessonAccess"
FOR EACH ROW EXECUTE FUNCTION "reject_lesson_access_course_mismatch"();

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the two new ledgers. Reuses the existing
-- reject_append_only_mutation() from 20260827140000_phase0_foundations rather than defining a
-- ninth and tenth equivalent function.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "CaseRetainerDraw_append_only"
BEFORE UPDATE OR DELETE ON "CaseRetainerDraw"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();

CREATE TRIGGER "CourseAccessEvent_append_only"
BEFORE UPDATE OR DELETE ON "CourseAccessEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
