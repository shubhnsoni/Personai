-- Wave C / P2-006: shared cases and projects foundation.
--
-- STRICTLY ADDITIVE. Creates eight enums and ten tables with their indexes and foreign
-- keys, plus one append-only trigger. It adds NO column to, and alters NO property of,
-- any pre-existing table.
--
-- This was verified rather than assumed: the generated diff contained 0 DROP TABLE,
-- 0 DROP COLUMN, 0 ALTER COLUMN and 0 ADD COLUMN statements. `prisma format` was used to
-- add the required opposite relation fields, and that measurement is what proves the
-- reformatting was cosmetic alignment only, with no semantic effect on existing models.
--
-- DESIGN INTENT: compose, do not duplicate. Clients are Contacts. Case work items are
-- TaskJobs, linked through CaseTaskLink. Sign-off reuses the existing Approval ledger
-- through CaseApprovalLink. Uploaded files stay ProfileDocuments, referenced by
-- CaseDeliverable and CaseDocumentRequest. Contact-level ActivityEvent is untouched;
-- CaseEvent is a separate case-level timeline. CaseInvoice records billing STATE and
-- links out to Payment; it is deliberately not a second accounting ledger.
--
-- NAME NOTE: the case aggregate is CaseProject because `Project` is already taken by the
-- pre-existing portfolio model. Renaming that would have been breaking for no benefit.
--
-- Tenancy is workspaceId, which /api/platform already authorizes against. Unlike the
-- restaurant and appointment domains there is no legacy profileId-scoped table to bridge
-- to, so no bridge is invented.
--
-- DELIBERATE OMISSION, third wave running:
-- `prisma migrate diff` again emitted five DropForeignKey statements against
--     ActivityEvent_profileId_fkey, Contact_profileId_fkey,
--     ContactSourceLink_profileId_fkey, WorkflowRun_profileId_fkey,
--     Workspace_profileId_fkey
-- Removed programmatically with the count asserted. They are pre-existing drift between
-- schema.prisma and 20260827140000_phase0_foundations. Dropping them would strip
-- referential integrity from five existing tables for reasons unconnected to cases.

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('INTAKE', 'BRIEFED', 'ACTIVE', 'ON_HOLD', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CaseIntakeStatus" AS ENUM ('NEW', 'QUALIFYING', 'ACCEPTED', 'DECLINED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CaseMilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CaseDeliverableStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'DELIVERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseDocumentRequestStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'WAIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseInvoiceState" AS ENUM ('NONE', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "CaseEventKind" AS ENUM ('CREATED', 'STATUS', 'MILESTONE', 'DELIVERABLE', 'DOCUMENT', 'INVOICE', 'TASK', 'APPROVAL', 'NOTE');

-- CreateEnum
CREATE TYPE "CaseEventActor" AS ENUM ('CLIENT', 'STAFF', 'SYSTEM');

-- CreateTable
CREATE TABLE "CaseIntake" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "CaseIntakeStatus" NOT NULL DEFAULT 'NEW',
    "declineReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseProject" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "locationId" TEXT,
    "contactId" TEXT,
    "intakeId" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'INTAKE',
    "invoiceState" "CaseInvoiceState" NOT NULL DEFAULT 'NONE',
    "openedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseBrief" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "scope" TEXT,
    "constraints" TEXT,
    "agreedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseMilestone" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "status" "CaseMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDeliverable" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "status" "CaseDeliverableStatus" NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDocumentRequest" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CaseDocumentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "dueAt" TIMESTAMP(3),
    "documentId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "waivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseInvoice" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "state" "CaseInvoiceState" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTaskLink" (
    "caseId" TEXT NOT NULL,
    "taskJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseTaskLink_pkey" PRIMARY KEY ("caseId","taskJobId")
);

-- CreateTable
CREATE TABLE "CaseApprovalLink" (
    "caseId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseApprovalLink_pkey" PRIMARY KEY ("caseId","approvalId")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "CaseEventKind" NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "CaseEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseIntake_workspaceId_status_createdAt_idx" ON "CaseIntake"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CaseIntake_contactId_idx" ON "CaseIntake"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseIntake_workspaceId_idempotencyKey_key" ON "CaseIntake"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CaseProject_intakeId_key" ON "CaseProject"("intakeId");

-- CreateIndex
CREATE INDEX "CaseProject_workspaceId_status_createdAt_idx" ON "CaseProject"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CaseProject_contactId_idx" ON "CaseProject"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseProject_workspaceId_reference_key" ON "CaseProject"("workspaceId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "CaseProject_workspaceId_idempotencyKey_key" ON "CaseProject"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CaseBrief_caseId_key" ON "CaseBrief"("caseId");

-- CreateIndex
CREATE INDEX "CaseMilestone_caseId_status_idx" ON "CaseMilestone"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CaseMilestone_caseId_ordinal_key" ON "CaseMilestone"("caseId", "ordinal");

-- CreateIndex
CREATE INDEX "CaseDeliverable_caseId_status_idx" ON "CaseDeliverable"("caseId", "status");

-- CreateIndex
CREATE INDEX "CaseDeliverable_milestoneId_idx" ON "CaseDeliverable"("milestoneId");

-- CreateIndex
CREATE INDEX "CaseDocumentRequest_caseId_status_idx" ON "CaseDocumentRequest"("caseId", "status");

-- CreateIndex
CREATE INDEX "CaseInvoice_caseId_state_idx" ON "CaseInvoice"("caseId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CaseInvoice_caseId_reference_key" ON "CaseInvoice"("caseId", "reference");

-- CreateIndex
CREATE INDEX "CaseTaskLink_taskJobId_idx" ON "CaseTaskLink"("taskJobId");

-- CreateIndex
CREATE INDEX "CaseApprovalLink_approvalId_idx" ON "CaseApprovalLink"("approvalId");

-- CreateIndex
CREATE INDEX "CaseEvent_caseId_seq_idx" ON "CaseEvent"("caseId", "seq");

-- AddForeignKey
ALTER TABLE "CaseIntake" ADD CONSTRAINT "CaseIntake_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseIntake" ADD CONSTRAINT "CaseIntake_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseProject" ADD CONSTRAINT "CaseProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseProject" ADD CONSTRAINT "CaseProject_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseProject" ADD CONSTRAINT "CaseProject_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseProject" ADD CONSTRAINT "CaseProject_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "CaseIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseBrief" ADD CONSTRAINT "CaseBrief_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseMilestone" ADD CONSTRAINT "CaseMilestone_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeliverable" ADD CONSTRAINT "CaseDeliverable_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeliverable" ADD CONSTRAINT "CaseDeliverable_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "CaseMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeliverable" ADD CONSTRAINT "CaseDeliverable_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProfileDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocumentRequest" ADD CONSTRAINT "CaseDocumentRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocumentRequest" ADD CONSTRAINT "CaseDocumentRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProfileDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInvoice" ADD CONSTRAINT "CaseInvoice_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTaskLink" ADD CONSTRAINT "CaseTaskLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTaskLink" ADD CONSTRAINT "CaseTaskLink_taskJobId_fkey" FOREIGN KEY ("taskJobId") REFERENCES "TaskJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseApprovalLink" ADD CONSTRAINT "CaseApprovalLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseApprovalLink" ADD CONSTRAINT "CaseApprovalLink_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the case timeline. Reuses the existing
-- reject_append_only_mutation() function from 20260827140000_phase0_foundations
-- rather than defining another equivalent trigger.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "CaseEvent_append_only"
BEFORE UPDATE OR DELETE ON "CaseEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
