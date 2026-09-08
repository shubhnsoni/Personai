-- AlterTable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "aiProviderOverride" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "aiJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "profileId" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitorSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "landPath" TEXT,
    "landRef" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrerHost" TEXT,
    "country" TEXT,
    "region" TEXT,
    "device" TEXT,
    "visitorEmail" TEXT,

    CONSTRAINT "VisitorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitorPageview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "ms" INTEGER,

    CONSTRAINT "VisitorPageview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiCallLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "ms" INTEGER NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_profileId_createdAt_idx" ON "AuditEvent"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "VisitorSession_profileId_lastSeenAt_idx" ON "VisitorSession"("profileId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "VisitorSession_profileId_visitorId_lastSeenAt_idx" ON "VisitorSession"("profileId", "visitorId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "VisitorPageview_sessionId_enteredAt_idx" ON "VisitorPageview"("sessionId", "enteredAt");
CREATE INDEX IF NOT EXISTS "AiCallLog_createdAt_idx" ON "AiCallLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AiCallLog_provider_createdAt_idx" ON "AiCallLog"("provider", "createdAt");

ALTER TABLE "VisitorSession" DROP CONSTRAINT IF EXISTS "VisitorSession_profileId_fkey";
ALTER TABLE "VisitorSession" ADD CONSTRAINT "VisitorSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitorPageview" DROP CONSTRAINT IF EXISTS "VisitorPageview_sessionId_fkey";
ALTER TABLE "VisitorPageview" ADD CONSTRAINT "VisitorPageview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
