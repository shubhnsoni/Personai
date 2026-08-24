-- AlterTable Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "autoMemoryEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "liveChatEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "liveChatSlaMinutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable ProfileDocument
ALTER TABLE "ProfileDocument" ADD COLUMN IF NOT EXISTS "visitorKey" TEXT;
ALTER TABLE "ProfileDocument" ADD COLUMN IF NOT EXISTS "memberId" TEXT;
ALTER TABLE "ProfileDocument" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;

-- AlterTable Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "memberId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'AI';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "liveRequestedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "liveRespondedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastSummarizedMsgId" TEXT;

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "ProfileDocument_profileId_visitorKey_idx" ON "ProfileDocument"("profileId", "visitorKey");
CREATE INDEX IF NOT EXISTS "Conversation_profileId_visitorId_idx" ON "Conversation"("profileId", "visitorId");
CREATE INDEX IF NOT EXISTS "Conversation_profileId_mode_idx" ON "Conversation"("profileId", "mode");

DO $$ BEGIN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
