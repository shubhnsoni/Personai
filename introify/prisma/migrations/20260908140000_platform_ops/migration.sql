ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "opsJson" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "MoneyEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payMethod" TEXT,
    "payStatus" TEXT NOT NULL,
    "visitorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MoneyEvent_kind_subjectId_key" ON "MoneyEvent"("kind", "subjectId");
CREATE INDEX IF NOT EXISTS "MoneyEvent_createdAt_idx" ON "MoneyEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "MoneyEvent_profileId_createdAt_idx" ON "MoneyEvent"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "MoneyEvent_payStatus_createdAt_idx" ON "MoneyEvent"("payStatus", "createdAt");

ALTER TABLE "MoneyEvent" DROP CONSTRAINT IF EXISTS "MoneyEvent_profileId_fkey";
ALTER TABLE "MoneyEvent" ADD CONSTRAINT "MoneyEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CapacitySample" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liveVisitors" INTEGER NOT NULL,
    "heartbeatQps" DOUBLE PRECISION NOT NULL,
    "liveChatPollQps" DOUBLE PRECISION NOT NULL,
    "llmCalls5m" INTEGER NOT NULL,
    "llmErrors5m" INTEGER NOT NULL,
    "dbMs" INTEGER NOT NULL,
    "band" TEXT NOT NULL,

    CONSTRAINT "CapacitySample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CapacitySample_at_idx" ON "CapacitySample"("at");
