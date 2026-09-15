-- Platform waitlist + contact intake (paid checkout closed; public support channel).

CREATE TABLE "PlatformInquiry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "message" TEXT,
    "plan" TEXT,
    "cadence" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformInquiry_kind_createdAt_idx" ON "PlatformInquiry"("kind", "createdAt");
CREATE INDEX "PlatformInquiry_email_idx" ON "PlatformInquiry"("email");
