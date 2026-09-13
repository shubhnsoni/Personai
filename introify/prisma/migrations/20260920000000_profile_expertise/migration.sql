-- Additive: frameworks, intent introductions, knowledge access grants/rules,
-- payment proofs/blocks, and knowledge-gap analytics for imported profiles.

CREATE TABLE "ProfileFramework" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scoringApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfileFramework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileIntroduction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfileIntroduction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeAccessGrant" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ALLOWED',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgePurchaseRule" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceOfferingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgePurchaseRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_purchase_rule_xor" CHECK (("productId" IS NOT NULL)::int + ("serviceOfferingId" IS NOT NULL)::int = 1)
);

CREATE TABLE "KnowledgePaymentProof" (
    "id" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL DEFAULT 'platform',
    "checkoutSessionId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgePaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgePaymentBlock" (
    "id" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgePaymentBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeGapSignal" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeGapSignal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Profile" ADD COLUMN "knowledgeGapTracking" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProfileFramework_profileId_status_idx" ON "ProfileFramework"("profileId", "status");
CREATE INDEX "ProfileIntroduction_profileId_status_idx" ON "ProfileIntroduction"("profileId", "status");
CREATE UNIQUE INDEX "KnowledgeAccessGrant_documentId_memberId_key" ON "KnowledgeAccessGrant"("documentId", "memberId");
CREATE UNIQUE INDEX "KnowledgePurchaseRule_documentId_productId_key" ON "KnowledgePurchaseRule"("documentId", "productId");
CREATE UNIQUE INDEX "KnowledgePurchaseRule_documentId_serviceOfferingId_key" ON "KnowledgePurchaseRule"("documentId", "serviceOfferingId");
CREATE UNIQUE INDEX "KnowledgePaymentProof_stripeAccountId_checkoutSessionId_key" ON "KnowledgePaymentProof"("stripeAccountId", "checkoutSessionId");
CREATE INDEX "KnowledgePaymentProof_stripeAccountId_paymentIntentId_idx" ON "KnowledgePaymentProof"("stripeAccountId", "paymentIntentId");
CREATE INDEX "KnowledgePaymentProof_profileId_buyerEmail_idx" ON "KnowledgePaymentProof"("profileId", "buyerEmail");
CREATE UNIQUE INDEX "KnowledgePaymentBlock_stripeAccountId_paymentIntentId_key" ON "KnowledgePaymentBlock"("stripeAccountId", "paymentIntentId");
CREATE UNIQUE INDEX "KnowledgeGapSignal_messageId_key" ON "KnowledgeGapSignal"("messageId");
CREATE INDEX "KnowledgeGapSignal_profileId_status_createdAt_idx" ON "KnowledgeGapSignal"("profileId", "status", "createdAt");

ALTER TABLE "ProfileFramework" ADD CONSTRAINT "ProfileFramework_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileIntroduction" ADD CONSTRAINT "ProfileIntroduction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAccessGrant" ADD CONSTRAINT "KnowledgeAccessGrant_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProfileDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAccessGrant" ADD CONSTRAINT "KnowledgeAccessGrant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgePurchaseRule" ADD CONSTRAINT "KnowledgePurchaseRule_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProfileDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgePurchaseRule" ADD CONSTRAINT "KnowledgePurchaseRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgePurchaseRule" ADD CONSTRAINT "KnowledgePurchaseRule_serviceOfferingId_fkey" FOREIGN KEY ("serviceOfferingId") REFERENCES "ServiceOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgePaymentProof" ADD CONSTRAINT "KnowledgePaymentProof_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeGapSignal" ADD CONSTRAINT "KnowledgeGapSignal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeGapSignal" ADD CONSTRAINT "KnowledgeGapSignal_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
