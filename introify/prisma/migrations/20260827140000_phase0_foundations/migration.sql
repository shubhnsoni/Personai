-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipLocation" (
    "membershipId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "MembershipLocation_pkey" PRIMARY KEY ("membershipId","locationId")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "profileId" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "confidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSourceLink" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "profileId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "profileId" TEXT,
    "type" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "payload" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "profileId" TEXT,
    "workflowKey" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureDetail" TEXT,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inputJson" JSONB,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCall" (
    "id" TEXT NOT NULL,
    "workflowStepId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "state" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workflowStepId" TEXT,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotAuditEvent" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "CopilotAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_profileId_key" ON "Workspace"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_profileId_idx" ON "Workspace"("profileId");

-- CreateIndex
CREATE INDEX "Location_workspaceId_idx" ON "Location"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_workspaceId_name_key" ON "Location"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_role_idx" ON "Membership"("workspaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "MembershipLocation_locationId_idx" ON "MembershipLocation"("locationId");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_email_idx" ON "Contact"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_phone_idx" ON "Contact"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX "Contact_profileId_email_idx" ON "Contact"("profileId", "email");

-- CreateIndex
CREATE INDEX "Contact_profileId_phone_idx" ON "Contact"("profileId", "phone");

-- CreateIndex
CREATE INDEX "ContactSourceLink_contactId_idx" ON "ContactSourceLink"("contactId");

-- CreateIndex
CREATE INDEX "ContactSourceLink_profileId_idx" ON "ContactSourceLink"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSourceLink_sourceKind_sourceId_key" ON "ContactSourceLink"("sourceKind", "sourceId");

-- CreateIndex
CREATE INDEX "ActivityEvent_contactId_occurredAt_id_idx" ON "ActivityEvent"("contactId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ActivityEvent_profileId_occurredAt_id_idx" ON "ActivityEvent"("profileId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ActivityEvent_sourceKind_sourceId_idx" ON "ActivityEvent"("sourceKind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskJob_idempotencyKey_key" ON "TaskJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TaskJob_state_nextAttemptAt_idx" ON "TaskJob"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_workspaceId_state_createdAt_idx" ON "WorkflowRun"("workspaceId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_profileId_state_createdAt_idx" ON "WorkflowRun"("profileId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_state_updatedAt_idx" ON "WorkflowRun"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_profileId_idempotencyKey_key" ON "WorkflowRun"("profileId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentRun_workflowRunId_createdAt_idx" ON "AgentRun"("workflowRunId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_state_updatedAt_idx" ON "AgentRun"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowRunId_state_ordinal_idx" ON "WorkflowStep"("workflowRunId", "state", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowRunId_ordinal_key" ON "WorkflowStep"("workflowRunId", "ordinal");

-- CreateIndex
CREATE INDEX "ToolCall_workflowStepId_createdAt_idx" ON "ToolCall"("workflowStepId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCall_workflowStepId_ordinal_key" ON "ToolCall"("workflowStepId", "ordinal");

-- CreateIndex
CREATE INDEX "Approval_workflowRunId_state_requestedAt_idx" ON "Approval"("workflowRunId", "state", "requestedAt");

-- CreateIndex
CREATE INDEX "Approval_workflowStepId_idx" ON "Approval"("workflowStepId");

-- CreateIndex
CREATE INDEX "Approval_state_requestedAt_idx" ON "Approval"("state", "requestedAt");

-- CreateIndex
CREATE INDEX "CopilotAuditEvent_workflowRunId_sequence_idx" ON "CopilotAuditEvent"("workflowRunId", "sequence");

-- CreateIndex
CREATE INDEX "CopilotAuditEvent_agentRunId_idx" ON "CopilotAuditEvent"("agentRunId");

-- CreateIndex
CREATE INDEX "CopilotAuditEvent_eventType_occurredAt_idx" ON "CopilotAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CopilotAuditEvent_workflowRunId_sequence_key" ON "CopilotAuditEvent"("workflowRunId", "sequence");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocation" ADD CONSTRAINT "MembershipLocation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocation" ADD CONSTRAINT "MembershipLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSourceLink" ADD CONSTRAINT "ContactSourceLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotAuditEvent" ADD CONSTRAINT "CopilotAuditEvent_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotAuditEvent" ADD CONSTRAINT "CopilotAuditEvent_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;




-- Add nullable compatibility foreign keys to the existing Profile table.
-- These constraints live only on new tables, preserving all existing models and rows.
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactSourceLink" ADD CONSTRAINT "ContactSourceLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce positive sequence and attempt values required by the runtime contracts.
ALTER TABLE "TaskJob" ADD CONSTRAINT "TaskJob_attempts_nonnegative_check" CHECK ("attempts" >= 0);
ALTER TABLE "TaskJob" ADD CONSTRAINT "TaskJob_maxAttempts_positive_check" CHECK ("maxAttempts" > 0);
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_attempt_positive_check" CHECK ("attempt" > 0);
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_ordinal_positive_check" CHECK ("ordinal" > 0);
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_ordinal_positive_check" CHECK ("ordinal" > 0);
ALTER TABLE "CopilotAuditEvent" ADD CONSTRAINT "CopilotAuditEvent_sequence_positive_check" CHECK ("sequence" > 0);

-- Enforce append-only event/audit ledgers at the PostgreSQL schema layer.
CREATE OR REPLACE FUNCTION "reject_append_only_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ActivityEvent_append_only"
BEFORE UPDATE OR DELETE ON "ActivityEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();

CREATE TRIGGER "CopilotAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "CopilotAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();
