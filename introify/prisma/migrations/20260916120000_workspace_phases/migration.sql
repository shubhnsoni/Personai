ALTER TABLE "Creation" ADD COLUMN "trialKind" TEXT NOT NULL DEFAULT 'CHAT';
ALTER TABLE "Creation" ADD COLUMN "remixPolicy" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Creation" ADD COLUMN "versionNote" TEXT;

ALTER TABLE "CreationJob" ADD COLUMN "outputHint" TEXT;
ALTER TABLE "CreationJob" ADD COLUMN "offered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreationJob" ADD COLUMN "priceCents" INTEGER;
ALTER TABLE "CreationJob" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';
DROP INDEX IF EXISTS "CreationJob_creationId_idx";
CREATE INDEX "CreationJob_creationId_offered_idx" ON "CreationJob"("creationId", "offered");

CREATE TABLE "CreationMessage" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actorProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationMessage_creationId_createdAt_idx" ON "CreationMessage"("creationId", "createdAt");
ALTER TABLE "CreationMessage" ADD CONSTRAINT "CreationMessage_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationOrder" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "runId" TEXT,
    "creatorProfileId" TEXT NOT NULL,
    "buyerProfileId" TEXT,
    "buyerEmail" TEXT,
    "priceCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "creatorCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'awaiting_checkout',
    "input" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    CONSTRAINT "CreationOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationOrder_creatorProfileId_createdAt_idx" ON "CreationOrder"("creatorProfileId", "createdAt");
CREATE INDEX "CreationOrder_buyerProfileId_createdAt_idx" ON "CreationOrder"("buyerProfileId", "createdAt");
CREATE INDEX "CreationOrder_creationId_status_idx" ON "CreationOrder"("creationId", "status");
ALTER TABLE "CreationOrder" ADD CONSTRAINT "CreationOrder_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationOrder" ADD CONSTRAINT "CreationOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreationOrder" ADD CONSTRAINT "CreationOrder_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreationOrder" ADD CONSTRAINT "CreationOrder_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CreationReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreationReview_orderId_key" ON "CreationReview"("orderId");
CREATE INDEX "CreationReview_creationId_createdAt_idx" ON "CreationReview"("creationId", "createdAt");
ALTER TABLE "CreationReview" ADD CONSTRAINT "CreationReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CreationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationReview" ADD CONSTRAINT "CreationReview_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationAccess" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreationAccess_creationId_buyerProfileId_key" ON "CreationAccess"("creationId", "buyerProfileId");
CREATE INDEX "CreationAccess_buyerProfileId_lastUsedAt_idx" ON "CreationAccess"("buyerProfileId", "lastUsedAt");
ALTER TABLE "CreationAccess" ADD CONSTRAINT "CreationAccess_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkspaceConnection" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unavailable',
    "scopes" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceConnection_profileId_kind_label_key" ON "WorkspaceConnection"("profileId", "kind", "label");
CREATE INDEX "WorkspaceConnection_profileId_kind_idx" ON "WorkspaceConnection"("profileId", "kind");
ALTER TABLE "WorkspaceConnection" ADD CONSTRAINT "WorkspaceConnection_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationPermission" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreationPermission_creationId_connectionId_key" ON "CreationPermission"("creationId", "connectionId");
ALTER TABLE "CreationPermission" ADD CONSTRAINT "CreationPermission_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationPermission" ADD CONSTRAINT "CreationPermission_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WorkspaceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationSchedule" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationSchedule_enabled_nextRunAt_idx" ON "CreationSchedule"("enabled", "nextRunAt");
ALTER TABLE "CreationSchedule" ADD CONSTRAINT "CreationSchedule_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationSchedule" ADD CONSTRAINT "CreationSchedule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationApproval" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "CreationApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationApproval_creationId_status_idx" ON "CreationApproval"("creationId", "status");
ALTER TABLE "CreationApproval" ADD CONSTRAINT "CreationApproval_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationAudit" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "connectionId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationAudit_creationId_createdAt_idx" ON "CreationAudit"("creationId", "createdAt");
ALTER TABLE "CreationAudit" ADD CONSTRAINT "CreationAudit_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationAudit" ADD CONSTRAINT "CreationAudit_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WorkspaceConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CreationSkillDep" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "usesId" TEXT NOT NULL,
    "extraCost" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CreationSkillDep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreationSkillDep_hostId_usesId_key" ON "CreationSkillDep"("hostId", "usesId");
ALTER TABLE "CreationSkillDep" ADD CONSTRAINT "CreationSkillDep_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationSkillDep" ADD CONSTRAINT "CreationSkillDep_usesId_fkey" FOREIGN KEY ("usesId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationTeam" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationTeam_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationTeam_profileId_idx" ON "CreationTeam"("profileId");
ALTER TABLE "CreationTeam" ADD CONSTRAINT "CreationTeam_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'skill',
    CONSTRAINT "CreationTeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreationTeamMember_teamId_creationId_key" ON "CreationTeamMember"("teamId", "creationId");
ALTER TABLE "CreationTeamMember" ADD CONSTRAINT "CreationTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CreationTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationTeamMember" ADD CONSTRAINT "CreationTeamMember_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BridgeSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" TEXT NOT NULL DEFAULT 'Desktop Bridge is not connected. Cloud jobs still run on Introify servers.',
    CONSTRAINT "BridgeSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BridgeSession_profileId_key" ON "BridgeSession"("profileId");
