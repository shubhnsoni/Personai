-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "clerkId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE UNIQUE INDEX "Member_clerkId_key" ON "Member"("clerkId");

CREATE TABLE "MemberSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberSession_tokenHash_key" ON "MemberSession"("tokenHash");
ALTER TABLE "MemberSession" ADD CONSTRAINT "MemberSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LibraryLink" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibraryLink_tokenHash_key" ON "LibraryLink"("tokenHash");
ALTER TABLE "LibraryLink" ADD CONSTRAINT "LibraryLink_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD COLUMN "memberId" TEXT;
ALTER TABLE "ProductPurchase" ADD COLUMN "memberId" TEXT;
ALTER TABLE "CourseEnrollment" ADD COLUMN "memberId" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "memberId" TEXT;
ALTER TABLE "CommunityMember" ADD COLUMN "memberId" TEXT;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductPurchase" ADD CONSTRAINT "ProductPurchase_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
