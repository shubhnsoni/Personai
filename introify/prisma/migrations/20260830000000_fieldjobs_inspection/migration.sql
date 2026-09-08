-- Wave H0 / P2-017: fieldJobs:inspection - asset checks, checklists, parts, completion notes
-- and invoice HANDOFF.
--
-- STRICTLY ADDITIVE: five tables, five enums, eighteen CHECK constraints, one partial unique
-- index, three triggers, three trigger functions. Zero ADD COLUMN, zero ALTER COLUMN, zero
-- ALTER TYPE, zero DROP of any kind. The build tool asserts every one of those counts and the
-- exact table and enum names, and aborts otherwise.
--
-- THIS IS THE CAPABILITY G4 DELIBERATELY LEFT UNBUILT. G4's header said inspection was not
-- built and that fieldJobs:inspection stayed `planned`; its schema-invariant harness listed
-- FieldJobInspection, FieldJobPart and FieldJobAsset among tables that must NOT exist. Two of
-- those names are now built under the FieldJobInspection prefix. The harness list is revised in
-- the same commit rather than quietly dropped, and every name that stays forbidden stays
-- forbidden for the reason it always had.
--
-- WHAT IS STILL NOT BUILT, so the word "inspection" does not carry a claim:
--
--   NO ASSET REGISTRY. An ASSET item records the identity of the equipment it inspected -
--   assetLabel, assetSerial, assetLocationHint - as columns on the item row. There is no Asset
--   table, no per-asset lifecycle and no per-asset service history. An Asset table would be a
--   second answer to "what equipment exists", and the first answer has not been needed yet.
--   The build tool refuses to create one.
--
--   NO INVOICE AND NO PAYMENT. invoiceHandoffState is a handoff flag: the owner marking an
--   inspection billable and passing it on. No FieldJobInvoice table is created, no Payment row
--   is written, and nothing calls a payment provider. invoiceHandoffReference is free text
--   because this schema does not know what is on the other side of the handoff.
--
--   NO FILE STORAGE AND NO UPLOAD. evidenceManifest is owner-entered METADATA about evidence
--   held somewhere else. No byte is stored, fetched or served, and nothing dereferences a value
--   in that column.
--
--   NO ROUTING AND NO NOTIFICATION, unchanged from G4. There is no distance, travel-time,
--   latitude, longitude or notifiedAt column anywhere in these five tables.
--
-- THE EVENT LEDGER IS REUSED, NOT FORKED, AND THAT CHOICE IS LOAD-BEARING
-- FieldJobEvent already says in its own comment that subjectType and subjectId are what let one
-- stream cover the request, the job, an assignment and the schedule. Inspection is the fifth
-- subject: subjectType "inspection", "inspectionItem", "inspectionPart" and "inspectionHandoff",
-- using the EXISTING FieldJobEventKind values. No new event table and no new enum value.
--
-- Avoiding ALTER TYPE ... ADD VALUE is deliberate and not merely tidy. Postgres cannot remove an
-- enum value, so adding one would force this migration's rollback to drop and recreate
-- FieldJobEventKind and re-point FieldJobEvent."kind" at the new type. That reallocates the
-- table OID and the implicit NOT NULL constraint names, and the apply -> rollback -> reapply
-- proof would no longer be able to show byte-identical catalog state. Extending by subjectType
-- is both the designed extension point and the only strictly additive one.
--
-- PARTS COMPOSE THE INVENTORY ENGINE
-- FieldJobInspectionPart points at an InventoryItem and at the InventoryMovement that consumed
-- it. It does not restate variant, product, location, price or stock level - all of those are
-- read through InventoryItem, whose existing CHECK constraints already make a negative or
-- over-reserved balance impossible. movementId is UNIQUE, so two part lines cannot both claim
-- the same movement. A part line with no movement is a recorded intent; a part line with one has
-- moved real stock through the existing append-only ledger.
--
-- TENANCY AND THE BOUNDARY THE DATABASE ENFORCES ITSELF
-- Tenancy is profileId bridged from Workspace.profileId, exactly as G4. FieldJobInspection
-- carries a denormalized profileId so profile-scoped queries need no join, and a trigger
-- guarantees it equals its job's profileId - the same shape as InventoryItem's denormalized
-- productId guard. Two further triggers enforce rules a composite foreign key would express if
-- Prisma could describe one: a part's stock record must belong to the same profile AND, when the
-- job names an origin location, to that location; and an item's template line must belong to the
-- inspection's own template.
--
-- DELIBERATE OMISSION, tenth wave running: the five pre-existing profileId DropForeignKey
-- statements are removed programmatically with the count asserted.

-- CreateEnum
CREATE TYPE "FieldJobInspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldJobInspectionOutcome" AS ENUM ('PASS', 'FAIL', 'ADVISORY');

-- CreateEnum
CREATE TYPE "FieldJobInspectionItemKind" AS ENUM ('CHECK', 'MEASUREMENT', 'ASSET');

-- CreateEnum
CREATE TYPE "FieldJobInspectionItemResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FieldJobInvoiceHandoffState" AS ENUM ('NOT_READY', 'READY', 'HANDED_OFF', 'DECLINED');

-- CreateTable
CREATE TABLE "FieldJobInspectionTemplate" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "serviceOfferingId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobInspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJobInspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "FieldJobInspectionItemKind" NOT NULL DEFAULT 'CHECK',
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT,
    "expectedMin" DECIMAL(14,4),
    "expectedMax" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobInspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJobInspection" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "templateId" TEXT,
    "assignmentId" TEXT,
    "reference" TEXT NOT NULL,
    "status" "FieldJobInspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "outcome" "FieldJobInspectionOutcome",
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "completionNotes" TEXT,
    "evidenceManifest" JSONB,
    "invoiceHandoffState" "FieldJobInvoiceHandoffState" NOT NULL DEFAULT 'NOT_READY',
    "invoiceHandoffAt" TIMESTAMP(3),
    "invoiceHandoffReference" TEXT,
    "invoiceHandoffNote" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJobInspectionItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "position" INTEGER NOT NULL,
    "kind" "FieldJobInspectionItemKind" NOT NULL DEFAULT 'CHECK',
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "result" "FieldJobInspectionItemResult" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "measuredValue" DECIMAL(14,4),
    "unit" TEXT,
    "expectedMin" DECIMAL(14,4),
    "expectedMax" DECIMAL(14,4),
    "assetLabel" TEXT,
    "assetSerial" TEXT,
    "assetLocationHint" TEXT,
    "recordedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobInspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJobInspectionPart" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "movementId" TEXT,
    "qty" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldJobInspectionPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldJobInspectionTemplate_profileId_isActive_idx" ON "FieldJobInspectionTemplate"("profileId", "isActive");

-- CreateIndex
CREATE INDEX "FieldJobInspectionTemplate_serviceOfferingId_idx" ON "FieldJobInspectionTemplate"("serviceOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionTemplate_profileId_name_key" ON "FieldJobInspectionTemplate"("profileId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionTemplate_profileId_idempotencyKey_key" ON "FieldJobInspectionTemplate"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FieldJobInspectionTemplateItem_templateId_idx" ON "FieldJobInspectionTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionTemplateItem_templateId_position_key" ON "FieldJobInspectionTemplateItem"("templateId", "position");

-- CreateIndex
CREATE INDEX "FieldJobInspection_profileId_status_createdAt_idx" ON "FieldJobInspection"("profileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FieldJobInspection_jobId_status_idx" ON "FieldJobInspection"("jobId", "status");

-- CreateIndex
CREATE INDEX "FieldJobInspection_templateId_idx" ON "FieldJobInspection"("templateId");

-- CreateIndex
CREATE INDEX "FieldJobInspection_assignmentId_idx" ON "FieldJobInspection"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspection_profileId_reference_key" ON "FieldJobInspection"("profileId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspection_jobId_idempotencyKey_key" ON "FieldJobInspection"("jobId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FieldJobInspectionItem_inspectionId_result_idx" ON "FieldJobInspectionItem"("inspectionId", "result");

-- CreateIndex
CREATE INDEX "FieldJobInspectionItem_templateItemId_idx" ON "FieldJobInspectionItem"("templateItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionItem_inspectionId_position_key" ON "FieldJobInspectionItem"("inspectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionItem_inspectionId_idempotencyKey_key" ON "FieldJobInspectionItem"("inspectionId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionPart_movementId_key" ON "FieldJobInspectionPart"("movementId");

-- CreateIndex
CREATE INDEX "FieldJobInspectionPart_inspectionId_idx" ON "FieldJobInspectionPart"("inspectionId");

-- CreateIndex
CREATE INDEX "FieldJobInspectionPart_inventoryItemId_idx" ON "FieldJobInspectionPart"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldJobInspectionPart_inspectionId_idempotencyKey_key" ON "FieldJobInspectionPart"("inspectionId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "FieldJobInspectionTemplate" ADD CONSTRAINT "FieldJobInspectionTemplate_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionTemplate" ADD CONSTRAINT "FieldJobInspectionTemplate_serviceOfferingId_fkey" FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionTemplateItem" ADD CONSTRAINT "FieldJobInspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FieldJobInspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspection" ADD CONSTRAINT "FieldJobInspection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FieldJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspection" ADD CONSTRAINT "FieldJobInspection_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspection" ADD CONSTRAINT "FieldJobInspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FieldJobInspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspection" ADD CONSTRAINT "FieldJobInspection_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FieldJobAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionItem" ADD CONSTRAINT "FieldJobInspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "FieldJobInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionItem" ADD CONSTRAINT "FieldJobInspectionItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "FieldJobInspectionTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionPart" ADD CONSTRAINT "FieldJobInspectionPart_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "FieldJobInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionPart" ADD CONSTRAINT "FieldJobInspectionPart_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJobInspectionPart" ADD CONSTRAINT "FieldJobInspectionPart_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guarantees the application cannot bypass.
-- ---------------------------------------------------------------------------

-- A line has to say something, and a position has to be a position.
ALTER TABLE "FieldJobInspectionTemplateItem"
  ADD CONSTRAINT "FieldJobInspectionTemplateItem_label_not_blank" CHECK (length(btrim("label")) > 0);
ALTER TABLE "FieldJobInspectionTemplateItem"
  ADD CONSTRAINT "FieldJobInspectionTemplateItem_position_nonnegative" CHECK ("position" >= 0);

-- A reading with no unit is not a reading. 12 what?
ALTER TABLE "FieldJobInspectionTemplateItem"
  ADD CONSTRAINT "FieldJobInspectionTemplateItem_measurement_has_unit" CHECK (
    "kind" <> 'MEASUREMENT' OR ("unit" IS NOT NULL AND length(btrim("unit")) > 0)
  );
ALTER TABLE "FieldJobInspectionTemplateItem"
  ADD CONSTRAINT "FieldJobInspectionTemplateItem_range_ordered" CHECK (
    "expectedMin" IS NULL OR "expectedMax" IS NULL OR "expectedMax" >= "expectedMin"
  );

ALTER TABLE "FieldJobInspection"
  ADD CONSTRAINT "FieldJobInspection_reference_not_blank" CHECK (length(btrim("reference")) > 0);

-- A completed inspection with no verdict is a finished inspection that says nothing, and one
-- with no notes is indistinguishable from one nobody filled in.
ALTER TABLE "FieldJobInspection"
  ADD CONSTRAINT "FieldJobInspection_completed_has_outcome" CHECK (
    "status" <> 'COMPLETED' OR "outcome" IS NOT NULL
  );
ALTER TABLE "FieldJobInspection"
  ADD CONSTRAINT "FieldJobInspection_completed_has_notes" CHECK (
    "status" <> 'COMPLETED' OR ("completionNotes" IS NOT NULL AND length(btrim("completionNotes")) > 0)
  );
ALTER TABLE "FieldJobInspection"
  ADD CONSTRAINT "FieldJobInspection_cancel_has_reason" CHECK (
    "status" <> 'CANCELLED' OR ("cancelReason" IS NOT NULL AND length(btrim("cancelReason")) > 0)
  );

-- Billing cannot be handed off from an inspection that has not finished. NOT_READY is the only
-- handoff state an unfinished inspection may hold, so "we invoiced it before we inspected it" is
-- unrepresentable rather than merely discouraged.
ALTER TABLE "FieldJobInspection"
  ADD CONSTRAINT "FieldJobInspection_handoff_requires_completion" CHECK (
    "invoiceHandoffState" = 'NOT_READY' OR "status" = 'COMPLETED'
  );
ALTER TABLE "FieldJobInspection"
  ADD CONSTRAINT "FieldJobInspection_handoff_has_timestamp" CHECK (
    "invoiceHandoffState" <> 'HANDED_OFF' OR "invoiceHandoffAt" IS NOT NULL
  );

ALTER TABLE "FieldJobInspectionItem"
  ADD CONSTRAINT "FieldJobInspectionItem_label_not_blank" CHECK (length(btrim("label")) > 0);
ALTER TABLE "FieldJobInspectionItem"
  ADD CONSTRAINT "FieldJobInspectionItem_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "FieldJobInspectionItem"
  ADD CONSTRAINT "FieldJobInspectionItem_measurement_has_unit" CHECK (
    "kind" <> 'MEASUREMENT' OR ("unit" IS NOT NULL AND length(btrim("unit")) > 0)
  );
ALTER TABLE "FieldJobInspectionItem"
  ADD CONSTRAINT "FieldJobInspectionItem_range_ordered" CHECK (
    "expectedMin" IS NULL OR "expectedMax" IS NULL OR "expectedMax" >= "expectedMin"
  );

-- A failed line must say why. Same rule as a declined assignment in G4: an unexplained refusal
-- reads as a mistake when somebody opens the record a week later.
ALTER TABLE "FieldJobInspectionItem"
  ADD CONSTRAINT "FieldJobInspectionItem_fail_has_notes" CHECK (
    "result" <> 'FAIL' OR ("notes" IS NOT NULL AND length(btrim("notes")) > 0)
  );

-- An equipment check that does not name the equipment is not an equipment check. This constraint
-- is the whole of the asset-identity guarantee, because there is no Asset table to point at.
ALTER TABLE "FieldJobInspectionItem"
  ADD CONSTRAINT "FieldJobInspectionItem_asset_has_identity" CHECK (
    "kind" <> 'ASSET' OR ("assetLabel" IS NOT NULL AND length(btrim("assetLabel")) > 0)
  );

-- Using zero of a part is not using a part, and a negative cost is not a cost.
ALTER TABLE "FieldJobInspectionPart"
  ADD CONSTRAINT "FieldJobInspectionPart_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "FieldJobInspectionPart"
  ADD CONSTRAINT "FieldJobInspectionPart_unitCost_nonnegative" CHECK (
    "unitCostCents" IS NULL OR "unitCostCents" >= 0
  );

-- ---------------------------------------------------------------------------
-- Partial unique index. Postgres needs the WHERE clause and Prisma cannot express it.
-- ---------------------------------------------------------------------------

-- At most one OPEN inspection per job. A job may be inspected more than once over its life -
-- before and after the work, or after a failure is fixed - so this is not a plain unique key on
-- jobId. But two inspections open at the same time on one job means two answers to "what is the
-- current state of this job", so the previous one must be completed or cancelled first.
CREATE UNIQUE INDEX "FieldJobInspection_one_open_per_job"
  ON "FieldJobInspection"("jobId")
  WHERE "status" IN ('DRAFT', 'IN_PROGRESS', 'SUBMITTED');

-- ---------------------------------------------------------------------------
-- An inspection, its job and its technician must belong to the same profile. Expressed in the
-- database rather than only in the engine, because the engine is not the only possible writer.
-- Same shape as G4's FieldJobAssignment_tenant_guard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_fieldjob_inspection_tenant_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    job_profile TEXT;
    assignment_job TEXT;
BEGIN
    SELECT j."profileId" INTO job_profile FROM "FieldJob" j WHERE j."id" = NEW."jobId";
    IF job_profile IS NULL THEN
        RAISE EXCEPTION 'FieldJobInspection references a job that does not exist';
    END IF;
    IF job_profile <> NEW."profileId" THEN
        RAISE EXCEPTION 'inspection claims profile % but job % belongs to profile %',
            NEW."profileId", NEW."jobId", job_profile;
    END IF;
    IF NEW."assignmentId" IS NOT NULL THEN
        SELECT a."jobId" INTO assignment_job FROM "FieldJobAssignment" a WHERE a."id" = NEW."assignmentId";
        IF assignment_job IS NULL THEN
            RAISE EXCEPTION 'FieldJobInspection references an assignment that does not exist';
        END IF;
        IF assignment_job <> NEW."jobId" THEN
            RAISE EXCEPTION 'assignment % belongs to job % but the inspection belongs to job %',
                NEW."assignmentId", assignment_job, NEW."jobId";
        END IF;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "FieldJobInspection_tenant_guard"
BEFORE INSERT OR UPDATE ON "FieldJobInspection"
FOR EACH ROW EXECUTE FUNCTION "reject_fieldjob_inspection_tenant_mismatch"();

-- ---------------------------------------------------------------------------
-- A snapshotted line may only cite a template line from the inspection's OWN template.
-- Otherwise an inspection could claim provenance from a checklist it never used, and the
-- snapshot would stop being evidence of what was actually asked.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_fieldjob_inspection_item_template_mismatch"()
RETURNS TRIGGER AS $$
DECLARE
    inspection_template TEXT;
    line_template TEXT;
BEGIN
    IF NEW."templateItemId" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT i."templateId" INTO inspection_template FROM "FieldJobInspection" i WHERE i."id" = NEW."inspectionId";
    SELECT ti."templateId" INTO line_template
      FROM "FieldJobInspectionTemplateItem" ti WHERE ti."id" = NEW."templateItemId";
    IF line_template IS NULL THEN
        RAISE EXCEPTION 'FieldJobInspectionItem references a template line that does not exist';
    END IF;
    IF inspection_template IS NULL THEN
        RAISE EXCEPTION 'inspection % has no template, so item % cannot cite template line %',
            NEW."inspectionId", NEW."id", NEW."templateItemId";
    END IF;
    IF inspection_template <> line_template THEN
        RAISE EXCEPTION 'template line % belongs to template % but the inspection uses template %',
            NEW."templateItemId", line_template, inspection_template;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "FieldJobInspectionItem_template_guard"
BEFORE INSERT OR UPDATE ON "FieldJobInspectionItem"
FOR EACH ROW EXECUTE FUNCTION "reject_fieldjob_inspection_item_template_mismatch"();

-- ---------------------------------------------------------------------------
-- PARTS MAY NOT CROSS A TENANT OR A LOCATION BOUNDARY.
--
-- Two separate rules in one guard, because they fail differently:
--
--   TENANT  - the stock record must belong to the same profile as the inspection. Without this,
--             one tenant could consume another tenant's stock by id, and the inventory ledger
--             would balance while the theft was invisible.
--
--   LOCATION - when the job names an origin location, the stock must come from THAT location.
--             A job dispatched from the north depot cannot consume the south depot's stock,
--             because nobody drove it there. When the job names no origin location the rule does
--             not apply, and the tenant rule still does.
--
-- The third rule is bookkeeping: a movement cited by a part line must be a movement of the SAME
-- stock record, or the part line would be pointing at somebody else's stock movement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reject_fieldjob_inspection_part_boundary"()
RETURNS TRIGGER AS $$
DECLARE
    inspection_profile TEXT;
    inspection_job TEXT;
    item_profile TEXT;
    item_location TEXT;
    job_origin TEXT;
    movement_item TEXT;
BEGIN
    SELECT i."profileId", i."jobId" INTO inspection_profile, inspection_job
      FROM "FieldJobInspection" i WHERE i."id" = NEW."inspectionId";
    IF inspection_profile IS NULL THEN
        RAISE EXCEPTION 'FieldJobInspectionPart references an inspection that does not exist';
    END IF;

    SELECT it."profileId", it."locationId" INTO item_profile, item_location
      FROM "InventoryItem" it WHERE it."id" = NEW."inventoryItemId";
    IF item_profile IS NULL THEN
        RAISE EXCEPTION 'FieldJobInspectionPart references a stock record that does not exist';
    END IF;

    IF item_profile <> inspection_profile THEN
        RAISE EXCEPTION 'part stock % belongs to profile % but the inspection belongs to profile %',
            NEW."inventoryItemId", item_profile, inspection_profile;
    END IF;

    SELECT j."originLocationId" INTO job_origin FROM "FieldJob" j WHERE j."id" = inspection_job;
    IF job_origin IS NOT NULL AND item_location <> job_origin THEN
        RAISE EXCEPTION 'part stock % is held at location % but the job is dispatched from location %',
            NEW."inventoryItemId", item_location, job_origin;
    END IF;

    IF NEW."movementId" IS NOT NULL THEN
        SELECT m."itemId" INTO movement_item FROM "InventoryMovement" m WHERE m."id" = NEW."movementId";
        IF movement_item IS NULL THEN
            RAISE EXCEPTION 'FieldJobInspectionPart references a movement that does not exist';
        END IF;
        IF movement_item <> NEW."inventoryItemId" THEN
            RAISE EXCEPTION 'movement % moved stock record % but the part line claims stock record %',
                NEW."movementId", movement_item, NEW."inventoryItemId";
        END IF;
    END IF;

    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "FieldJobInspectionPart_boundary_guard"
BEFORE INSERT OR UPDATE ON "FieldJobInspectionPart"
FOR EACH ROW EXECUTE FUNCTION "reject_fieldjob_inspection_part_boundary"();

-- No new append-only trigger is created, because no new event table is created. Inspection
-- history goes into FieldJobEvent, which reject_append_only_mutation() has guarded since G4.
