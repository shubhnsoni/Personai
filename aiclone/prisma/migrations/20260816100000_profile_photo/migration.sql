-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN "chatAvatarMode" TEXT NOT NULL DEFAULT 'ORB';
