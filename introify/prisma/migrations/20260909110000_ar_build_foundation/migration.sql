-- ArBuild predates the billing ledger in schema.prisma, but was never added to
-- the tracked migration chain. Establish its legacy shape before the billing
-- migration alters it. Existing tables, rows and foreign-key policies are kept.
CREATE TABLE IF NOT EXISTS "ArBuild" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerTaskId" TEXT,
    "glbUrl" TEXT,
    "usdzUrl" TEXT,
    "credits" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "chargeCents" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArBuild_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArBuild_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArBuild_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ArBuild_batchId_idx" ON "ArBuild"("batchId");
CREATE INDEX IF NOT EXISTS "ArBuild_profileId_createdAt_idx" ON "ArBuild"("profileId", "createdAt");
