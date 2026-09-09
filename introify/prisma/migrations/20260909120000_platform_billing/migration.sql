-- DropForeignKey
ALTER TABLE "ArBuild" DROP CONSTRAINT "ArBuild_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ArBuild" DROP CONSTRAINT "ArBuild_productId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "billingAccountId" TEXT;

-- AlterTable
ALTER TABLE "ArBuild" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "leaseUntil" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "recipe" TEXT,
ADD COLUMN     "requestKey" TEXT,
ADD COLUMN     "reservationId" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "billingAccountId" TEXT;

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "defaultForUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccountMember" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccountMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvitation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "workspaceIds" JSONB NOT NULL,
    "workspaceRole" TEXT NOT NULL DEFAULT 'VIEWER',
    "accountRole" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerScheduleId" TEXT,
    "providerPriceId" TEXT,
    "planId" TEXT NOT NULL DEFAULT 'free',
    "planVersion" TEXT NOT NULL DEFAULT '2026-09-09',
    "cadence" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'FREE',
    "paidThrough" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "allowanceAnchor" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "pendingPlanId" TEXT,
    "pendingCadence" TEXT,
    "lastProviderEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCreditGrant" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCreditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReservation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "profileId" TEXT,
    "actorId" TEXT,
    "unit" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operationKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RESERVED',
    "allocations" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operationKey" TEXT NOT NULL,
    "reservationId" TEXT,
    "grantId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingTrialClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "grantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingTrialClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingStorageObject" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "profileId" TEXT,
    "path" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingStorageObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCheckout" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "cadence" TEXT,
    "planVersion" TEXT NOT NULL DEFAULT '2026-09-09',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "providerUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "liveMode" BOOLEAN NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerInvoiceId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerSubscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "hostedUrl" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAuditEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_defaultForUserId_key" ON "BillingAccount"("defaultForUserId");

-- CreateIndex
CREATE INDEX "BillingAccount_ownerUserId_idx" ON "BillingAccount"("ownerUserId");

-- CreateIndex
CREATE INDEX "BillingAccountMember_userId_status_idx" ON "BillingAccountMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccountMember_accountId_userId_key" ON "BillingAccountMember"("accountId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvitation_tokenHash_key" ON "BillingInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "BillingInvitation_accountId_emailKey_status_idx" ON "BillingInvitation"("accountId", "emailKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_accountId_key" ON "PlatformSubscription"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_providerSubscriptionId_key" ON "PlatformSubscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCreditGrant_sourceKey_key" ON "BillingCreditGrant"("sourceKey");

-- CreateIndex
CREATE INDEX "BillingCreditGrant_accountId_unit_expiresAt_idx" ON "BillingCreditGrant"("accountId", "unit", "expiresAt");

-- CreateIndex
CREATE INDEX "BillingReservation_accountId_state_idx" ON "BillingReservation"("accountId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "BillingReservation_accountId_unit_operationKey_key" ON "BillingReservation"("accountId", "unit", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLedgerEntry_operationKey_key" ON "BillingLedgerEntry"("operationKey");

-- CreateIndex
CREATE INDEX "BillingLedgerEntry_accountId_createdAt_idx" ON "BillingLedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingTrialClaim_userId_key" ON "BillingTrialClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingTrialClaim_grantId_key" ON "BillingTrialClaim"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingStorageObject_path_key" ON "BillingStorageObject"("path");

-- CreateIndex
CREATE INDEX "BillingStorageObject_accountId_idx" ON "BillingStorageObject"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckout_providerSessionId_key" ON "BillingCheckout"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckout_providerPaymentId_key" ON "BillingCheckout"("providerPaymentId");

-- CreateIndex
CREATE INDEX "BillingCheckout_accountId_status_idx" ON "BillingCheckout"("accountId", "status");

-- CreateIndex
CREATE INDEX "BillingProviderEvent_status_createdAt_idx" ON "BillingProviderEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_providerInvoiceId_key" ON "PlatformInvoice"("providerInvoiceId");

-- CreateIndex
CREATE INDEX "PlatformInvoice_accountId_createdAt_idx" ON "PlatformInvoice"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingAuditEvent_accountId_createdAt_idx" ON "BillingAuditEvent"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArBuild_reservationId_key" ON "ArBuild"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ArBuild_requestKey_key" ON "ArBuild"("requestKey");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArBuild" ADD CONSTRAINT "ArBuild_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArBuild" ADD CONSTRAINT "ArBuild_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccountMember" ADD CONSTRAINT "BillingAccountMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvitation" ADD CONSTRAINT "BillingInvitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCreditGrant" ADD CONSTRAINT "BillingCreditGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReservation" ADD CONSTRAINT "BillingReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingStorageObject" ADD CONSTRAINT "BillingStorageObject_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing businesses and collaborators. Over-limit accounts remain readable;
-- only positive resource growth is restricted by the new entitlement checks.
INSERT INTO "BillingAccount" (id, name, "ownerUserId", "defaultForUserId", "createdAt", "updatedAt")
SELECT 'ba_' || md5(u.id), COALESCE(NULLIF(u.name, ''), 'My') || ' account', u.id, u.id, u."createdAt", CURRENT_TIMESTAMP
FROM "User" u ON CONFLICT ("defaultForUserId") DO NOTHING;

UPDATE "Profile" p SET "billingAccountId" = a.id
FROM "BillingAccount" a WHERE a."defaultForUserId" = p."userId" AND p."billingAccountId" IS NULL;

UPDATE "Workspace" w SET "billingAccountId" = p."billingAccountId"
FROM "Profile" p WHERE p.id = w."profileId" AND w."billingAccountId" IS NULL;

INSERT INTO "BillingAccountMember" (id, "accountId", "userId", role, "createdAt", "updatedAt")
SELECT 'bam_' || md5(a.id || ':' || a."ownerUserId"), a.id, a."ownerUserId", 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BillingAccount" a ON CONFLICT ("accountId", "userId") DO NOTHING;

INSERT INTO "BillingAccountMember" (id, "accountId", "userId", role, "createdAt", "updatedAt")
SELECT DISTINCT 'bam_' || md5(w."billingAccountId" || ':' || m."userId"), w."billingAccountId", m."userId", 'MEMBER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Membership" m JOIN "Workspace" w ON w.id = m."workspaceId"
WHERE w."billingAccountId" IS NOT NULL ON CONFLICT ("accountId", "userId") DO NOTHING;

ALTER TABLE "BillingCreditGrant" ADD CONSTRAINT "BillingCreditGrant_nonnegative" CHECK (quantity > 0 AND remaining >= 0 AND remaining <= quantity);
ALTER TABLE "BillingReservation" ADD CONSTRAINT "BillingReservation_positive" CHECK (amount > 0);
ALTER TABLE "BillingStorageObject" ADD CONSTRAINT "BillingStorageObject_nonnegative" CHECK (bytes >= 0);
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_positive" CHECK ("amountCents" > 0);
ALTER TABLE "BillingCreditGrant" ADD CONSTRAINT "BillingCreditGrant_unit" CHECK (unit IN ('AI', 'PHOTOREAL'));
ALTER TABLE "BillingReservation" ADD CONSTRAINT "BillingReservation_state" CHECK (state IN ('RESERVED', 'CONSUMED', 'RELEASED'));
ALTER TABLE "BillingReservation" ADD CONSTRAINT "BillingReservation_unit" CHECK (unit IN ('AI', 'PHOTOREAL'));
CREATE INDEX "ArBuild_worker_idx" ON "ArBuild" (status, "nextAttemptAt", "leaseUntil");

-- Observations are ordered by the database, never by clocks on Node replicas.
CREATE SEQUENCE "BillingObservationSequence";
ALTER TABLE "PlatformSubscription" ADD COLUMN "lastObservationId" BIGINT NOT NULL DEFAULT 0;
