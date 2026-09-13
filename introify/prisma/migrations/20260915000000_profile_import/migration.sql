-- AlterTable
-- Existing documents keep public, published behaviour.
ALTER TABLE "ProfileDocument" ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "publicationState" TEXT NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "ProfileImportJob" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "targetProfileId" TEXT,
    "requestId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "draft" JSONB,
    "sources" JSONB,
    "warnings" JSONB,
    "error" TEXT,
    "appliedProfileId" TEXT,
    "appliedSlug" TEXT,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileImportJob_ownerUserId_requestId_key" ON "ProfileImportJob"("ownerUserId", "requestId");

-- CreateIndex
CREATE INDEX "ProfileImportJob_ownerUserId_createdAt_idx" ON "ProfileImportJob"("ownerUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProfileImportJob" ADD CONSTRAINT "ProfileImportJob_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileImportJob" ADD CONSTRAINT "ProfileImportJob_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileImportJob" ADD CONSTRAINT "ProfileImportJob_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
