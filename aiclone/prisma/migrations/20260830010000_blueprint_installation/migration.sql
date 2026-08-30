-- Blueprint INSTALLATION: the durable half of the blueprint runtime.
--
-- STRICTLY ADDITIVE: two tables, two enums, ten CHECK constraints, one partial unique index,
-- three triggers, two new trigger functions. Zero ADD COLUMN, zero ALTER COLUMN, zero ALTER TYPE,
-- zero DROP of any kind. The build tool asserts every one of those counts and the exact table and
-- enum names, and aborts otherwise.
--
-- Phase 1 shipped PREVIEW, which resolves what choosing a blueprint would mean and is incapable of
-- writing. This is what an install actually records. The preview response says "installation does
-- not exist"; from this migration forward that sentence has to change, and
-- check-onboarding-blueprint-coverage.ts is built to go red the moment a model matching
-- /Install|Blueprint/ appears in this schema, precisely so nobody can add durable installation
-- state and leave a now-false claim standing in src/lib/onboarding-needs.ts.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT CREATE
--
--   NO WORKFLOW TEMPLATE TABLE, and no second workflow engine. The static registry IS the
--   template. blueprint.id encodes the version - "restaurant-venue-v2" against "-v3" - and the
--   registry RETAINS deprecated entries rather than deleting them, which is exactly what makes
--   pinning an id sufficient for immutability. A template table would be a copy of blueprints.ts
--   able to disagree with it, and reconciling the two would become somebody's job forever.
--   WorkflowRun, WorkflowStep, Approval and TaskJob already exist and are untouched.
--
--   NO SURFACE OR TERMINOLOGY TABLE. Surfaces and field packs already live per PROFILE as JSON on
--   Profile.personalityConfig, written through src/lib/surfaces.ts. A table here would be a second
--   representation of one concept. An unscoped Terminology table is worse still: terminology only
--   means anything relative to an installation, and a global table would invite exactly the
--   cross-tenant leak this schema spends three triggers preventing elsewhere. The resolved pack is
--   frozen into configJson on a workspace-scoped row, so it is scoped by construction.
--
--   NO PERMISSION WRITE. Nothing in this migration or its runtime touches
--   Profile.personalityConfig. configJson RECORDS the surfaces a blueprint's corresponding role
--   implies; it does not grant them. The reason is structural rather than cautious: surfaces are
--   per PROFILE, an installation is per WORKSPACE, and a user reaches many workspaces through
--   Membership, which is keyed by userId. Applying workspace-scoped intent to a profile-scoped
--   store would change what that user sees in workspaces this install said nothing about. The
--   runtime harness proves the non-write by comparing the stored config byte for byte across an
--   install.
--
--   NO FAILED STATE AND NO REFUSAL ROW. A failed install leaves NOTHING - one transaction, and the
--   atomicity proof asserts per-table row counts before and after an injected last-step failure. A
--   refusal row would be a partial write that the proof would then need an exception for, and an
--   assertion with an exception carved out of it is the kind that stops noticing.
--
--   NO SCHEDULER, NO MESSAGING, NO PAYMENT. Installing configures. It does not notify.
--
-- ---------------------------------------------------------------------------
-- ONE ACTIVE INSTALLATION PER WORKSPACE, and why it is in the database
--
-- A blueprint carries terminology for an entire vertical: the calendar noun is "job" or "booking"
-- or "reservation", not all three at once. Two simultaneously active blueprints would leave the
-- product with two answers to "what is this thing called" and no way to choose. So the constraint
-- is a partial unique index on ("workspaceId") WHERE state = 'ACTIVE' - the same mechanism that
-- already enforces one default variant per product, and the same reason: Postgres can express it
-- and Prisma cannot.
--
-- The consequence is the behaviour that was asked for, obtained structurally rather than by
-- convention: changing blueprint is an UPGRADE THROUGH SUPERSESSION. A second install is not
-- discouraged, it is unrepresentable. restaurant-venue-v3 supersedes v2 supersedes v1, so that
-- path has real registry data to be tested against.
--
-- ---------------------------------------------------------------------------
-- AVOIDING ALTER TYPE, deliberately
--
-- Both enums here are NEW, so they are created and can be dropped cleanly. Nothing adds a value to
-- an existing type. Postgres cannot remove an enum value, so an ALTER TYPE ... ADD VALUE would
-- force this rollback to drop and recreate the type and re-point every column at it, reallocating
-- OIDs and implicit NOT NULL constraint names - and the apply -> rollback -> reapply proof could
-- no longer show byte-identical catalog state. Wave H0 extended FieldJobEvent by subjectType for
-- this exact reason; this migration simply never needed to.
--
-- DELIBERATE OMISSION, eleventh wave running: the five pre-existing profileId DropForeignKey
-- statements are removed programmatically with the count asserted.

-- CreateEnum
CREATE TYPE "BlueprintInstallationState" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "BlueprintInstallationEventKind" AS ENUM ('INSTALLED', 'UPGRADED', 'SUPERSEDED', 'REMOVED');

-- CreateTable
CREATE TABLE "BlueprintInstallation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT,
    "blueprintId" TEXT NOT NULL,
    "blueprintVersion" TEXT NOT NULL,
    "state" "BlueprintInstallationState" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "supersedesInstallationId" TEXT,
    "installedBy" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "BlueprintInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintInstallationEvent" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "BlueprintInstallationEventKind" NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "blueprintVersion" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlueprintInstallationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintInstallation_supersedesInstallationId_key" ON "BlueprintInstallation"("supersedesInstallationId");

-- CreateIndex
CREATE INDEX "BlueprintInstallation_workspaceId_state_installedAt_idx" ON "BlueprintInstallation"("workspaceId", "state", "installedAt");

-- CreateIndex
CREATE INDEX "BlueprintInstallation_blueprintId_state_idx" ON "BlueprintInstallation"("blueprintId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintInstallation_workspaceId_idempotencyKey_key" ON "BlueprintInstallation"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BlueprintInstallationEvent_installationId_createdAt_idx" ON "BlueprintInstallationEvent"("installationId", "createdAt");

-- CreateIndex
CREATE INDEX "BlueprintInstallationEvent_workspaceId_createdAt_idx" ON "BlueprintInstallationEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "BlueprintInstallation" ADD CONSTRAINT "BlueprintInstallation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintInstallation" ADD CONSTRAINT "BlueprintInstallation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintInstallation" ADD CONSTRAINT "BlueprintInstallation_supersedesInstallationId_fkey" FOREIGN KEY ("supersedesInstallationId") REFERENCES "BlueprintInstallation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintInstallationEvent" ADD CONSTRAINT "BlueprintInstallationEvent_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "BlueprintInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guarantees the application cannot bypass.
-- ---------------------------------------------------------------------------

-- An installation must say WHICH blueprint, at WHICH version, on WHOSE authority. A blank in any
-- of these turns the ledger into a record that something happened to something.
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_blueprintId_not_blank" CHECK (length(btrim("blueprintId")) > 0);
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_blueprintVersion_not_blank" CHECK (length(btrim("blueprintVersion")) > 0);
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_installedBy_not_blank" CHECK (length(btrim("installedBy")) > 0);

-- A blank idempotency key would collapse the replay guarantee into "whatever the caller passed",
-- and the unique index on (workspaceId, idempotencyKey) would happily accept one blank per
-- workspace, making the FIRST install unrepeatable and the second a conflict.
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_idempotencyKey_not_blank" CHECK (length(btrim("idempotencyKey")) > 0);

-- REMOVED means removed at a knowable time. Without this a removal is undatable, and the ledger
-- cannot answer "how long did this workspace run that blueprint".
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_removed_has_timestamp" CHECK (
    "state" <> 'REMOVED' OR "removedAt" IS NOT NULL
  );

-- And the converse, which is the half that is easy to forget: something still ACTIVE cannot carry
-- a removal date. Without it, a stale removedAt survives a reinstall and the row says two things.
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_active_has_no_removal" CHECK (
    "state" <> 'ACTIVE' OR "removedAt" IS NULL
  );

-- A row cannot supersede itself. Cheap to express, and it makes an infinite supersession chain
-- unrepresentable rather than merely unlikely.
ALTER TABLE "BlueprintInstallation"
  ADD CONSTRAINT "BlueprintInstallation_no_self_supersession" CHECK (
    "supersedesInstallationId" IS NULL OR "supersedesInstallationId" <> "id"
  );

-- The ledger has the same requirements, for the same reason: an append-only line that cannot say
-- who did what to which version is not evidence of anything.
ALTER TABLE "BlueprintInstallationEvent"
  ADD CONSTRAINT "BlueprintInstallationEvent_actor_not_blank" CHECK (length(btrim("actor")) > 0);
ALTER TABLE "BlueprintInstallationEvent"
  ADD CONSTRAINT "BlueprintInstallationEvent_blueprintId_not_blank" CHECK (length(btrim("blueprintId")) > 0);
ALTER TABLE "BlueprintInstallationEvent"
  ADD CONSTRAINT "BlueprintInstallationEvent_blueprintVersion_not_blank" CHECK (length(btrim("blueprintVersion")) > 0);

-- ---------------------------------------------------------------------------
-- Partial unique index. Postgres needs the WHERE clause and Prisma cannot express it.
-- ---------------------------------------------------------------------------

-- At most one ACTIVE installation per workspace. Superseded and removed rows are retained without
-- limit, because they are the history; only the live one is exclusive.
CREATE UNIQUE INDEX "BlueprintInstallation_one_active_per_workspace"
  ON "BlueprintInstallation"("workspaceId")
  WHERE "state" = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- The ledger's denormalized workspaceId must be the truth.
--
-- workspaceId is duplicated onto the event so the ledger can be read per tenant without joining
-- through an installation whose own row may since have moved to SUPERSEDED or REMOVED. A
-- denormalized tenant key that nothing checks is a cross-tenant leak waiting for one bad write,
-- so it is checked here rather than trusted to the engine - which is not the only possible writer.
-- Same shape as FieldJobInspection's denormalized profileId guard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_blueprint_installation_event_tenant_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    install_workspace TEXT;
BEGIN
    SELECT i."workspaceId" INTO install_workspace
      FROM "BlueprintInstallation" i WHERE i."id" = NEW."installationId";
    IF install_workspace IS NULL THEN
        RAISE EXCEPTION 'BlueprintInstallationEvent references an installation that does not exist';
    END IF;
    IF install_workspace <> NEW."workspaceId" THEN
        RAISE EXCEPTION 'ledger line claims workspace % but installation % belongs to workspace %',
            NEW."workspaceId", NEW."installationId", install_workspace;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "BlueprintInstallationEvent_tenant_guard"
BEFORE INSERT ON "BlueprintInstallationEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_blueprint_installation_event_tenant_mismatch"();

-- ---------------------------------------------------------------------------
-- SUPERSESSION MAY NOT CROSS A WORKSPACE BOUNDARY.
--
-- An upgrade points the new installation at the one it replaced. If that pointer could reach
-- another workspace's installation, one tenant could claim to have superseded another's - and
-- because supersedesInstallationId is UNIQUE, doing so would also make the victim's row
-- permanently unsupersedable by its rightful owner. A foreign-key constraint cannot express
-- "same workspace", so a trigger does.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_blueprint_installation_supersession_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    prior_workspace TEXT;
BEGIN
    IF NEW."supersedesInstallationId" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT p."workspaceId" INTO prior_workspace
      FROM "BlueprintInstallation" p WHERE p."id" = NEW."supersedesInstallationId";
    IF prior_workspace IS NULL THEN
        RAISE EXCEPTION 'BlueprintInstallation supersedes an installation that does not exist';
    END IF;
    IF prior_workspace <> NEW."workspaceId" THEN
        RAISE EXCEPTION 'installation in workspace % cannot supersede installation % in workspace %',
            NEW."workspaceId", NEW."supersedesInstallationId", prior_workspace;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "BlueprintInstallation_supersession_guard"
BEFORE INSERT OR UPDATE ON "BlueprintInstallation"
FOR EACH ROW EXECUTE FUNCTION "reject_blueprint_installation_supersession_mismatch"();

-- ---------------------------------------------------------------------------
-- The installation ledger is append-only, enforced by the database.
--
-- Reuses reject_append_only_mutation(), created by an earlier migration and already guarding ten
-- other ledgers. Not redefined here: a second definition of a shared function is how the two
-- quietly diverge.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "BlueprintInstallationEvent_append_only"
BEFORE UPDATE OR DELETE ON "BlueprintInstallationEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
