CREATE TABLE "Creation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avatar" TEXT,
    "description" TEXT,
    "purpose" TEXT,
    "instructions" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "allowVisitorChat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Creation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Creation_profileId_slug_key" ON "Creation"("profileId", "slug");
CREATE INDEX "Creation_profileId_visibility_idx" ON "Creation"("profileId", "visibility");
ALTER TABLE "Creation" ADD CONSTRAINT "Creation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationKnowledge" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationKnowledge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationKnowledge_creationId_idx" ON "CreationKnowledge"("creationId");
ALTER TABLE "CreationKnowledge" ADD CONSTRAINT "CreationKnowledge_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationJob" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inputHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationJob_creationId_idx" ON "CreationJob"("creationId");
ALTER TABLE "CreationJob" ADD CONSTRAINT "CreationJob_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreationJobRun" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input" TEXT NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "CreationJobRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreationJobRun_creationId_createdAt_idx" ON "CreationJobRun"("creationId", "createdAt");
ALTER TABLE "CreationJobRun" ADD CONSTRAINT "CreationJobRun_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "Creation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreationJobRun" ADD CONSTRAINT "CreationJobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
