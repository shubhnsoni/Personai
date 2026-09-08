-- Wave G3 / P2-012, second migration: retainer agreement history.
--
-- STRICTLY ADDITIVE: one table, zero enums, zero column changes. The build tool aborts on any
-- ADD COLUMN, ALTER COLUMN, ALTER TYPE or DROP of any kind, which is a stricter bar than the
-- first G3 migration needed.
--
-- WHY THIS EXISTS SEPARATELY, stated plainly rather than folded into the first migration's
-- history: 20260829190000 shipped the retainer tables, and CaseRetainerDraw records every
-- movement of the allowance. What it cannot record is a STATE change - activating an agreement,
-- closing or renewing a period, linking a case. CaseEvent could not be reused either, because
-- CaseEvent."caseId" is NOT NULL while a retainer legitimately exists before any case is linked
-- to it.
--
-- Fanning agreement events out to every linked case was considered and rejected: a retainer with
-- no links yet would then have no history at all, which is exactly the moment an owner most
-- wants one. Requiring a linked case before activation would have papered over that by making
-- the gap unreachable rather than absent.
--
-- The table reuses the pre-existing "CaseEventKind" and "CaseEventActor" enums, so it adds no
-- vocabulary. subjectType and subjectId say whether a row is about the agreement, a period, a
-- case link or a draw, so one stream covers all four rather than needing four tables.
--
-- DELIBERATE OMISSION, eighth wave running: the five pre-existing profileId DropForeignKey
-- statements are removed programmatically with the count asserted.

-- CreateTable
CREATE TABLE "CaseRetainerEvent" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "kind" "CaseEventKind" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "CaseEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRetainerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseRetainerEvent_retainerId_seq_idx" ON "CaseRetainerEvent"("retainerId", "seq");

-- CreateIndex
CREATE INDEX "CaseRetainerEvent_retainerId_subjectType_subjectId_idx" ON "CaseRetainerEvent"("retainerId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "CaseRetainerEvent" ADD CONSTRAINT "CaseRetainerEvent_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "CaseRetainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only enforcement, reusing reject_append_only_mutation() from
-- 20260827140000_phase0_foundations for the ninth ledger in this database.
CREATE TRIGGER "CaseRetainerEvent_append_only"
BEFORE UPDATE OR DELETE ON "CaseRetainerEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
