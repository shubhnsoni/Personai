-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderLineStatus" AS ENUM ('QUEUED', 'PREPARING', 'READY', 'SERVED');

-- CreateEnum
CREATE TYPE "OrderPayMethod" AS ENUM ('UPI', 'COD', 'WHATSAPP', 'STRIPE');

-- CreateEnum
CREATE TYPE "OrderPayStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderEventActor" AS ENUM ('GUEST', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrderEventKind" AS ENUM ('CREATED', 'ORDER_STATUS', 'LINE_STATUS', 'PAYMENT_STATUS', 'BACKFILL');

-- CreateEnum
CREATE TYPE "OfferReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ProfileImageCategory" AS ENUM ('AMBIENCE', 'INTERIOR', 'FOOD', 'TEAM', 'EVENT');

-- AlterTable
ALTER TABLE "OfferReview" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "ownerRepliedAt" TIMESTAMP(3),
ADD COLUMN     "ownerReply" TEXT,
ADD COLUMN     "profileId" TEXT,
ADD COLUMN     "status" "OfferReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
ALTER COLUMN "productId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "legacyGroupKey" TEXT,
    "number" INTEGER NOT NULL,
    "businessDate" DATE NOT NULL,
    "channel" "OrderChannel" NOT NULL DEFAULT 'DINE_IN',
    "tableId" TEXT,
    "tableLabel" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "note" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "payMethod" "OrderPayMethod",
    "payStatus" "OrderPayStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "paymentRef" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "titleSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "unitModifierCents" INTEGER NOT NULL DEFAULT 0,
    "modifiers" JSONB,
    "modifiersLabel" TEXT,
    "lineTotalCents" INTEGER NOT NULL,
    "status" "OrderLineStatus" NOT NULL DEFAULT 'QUEUED',
    "legacyPurchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "seq" BIGSERIAL NOT NULL,
    "kind" "OrderEventKind" NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actor" "OrderEventActor" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER,
    "zone" TEXT,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "scans" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCounter" (
    "profileId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("profileId","businessDate")
);

-- CreateTable
CREATE TABLE "ProfileImage" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "category" "ProfileImageCategory" NOT NULL DEFAULT 'AMBIENCE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_legacyGroupKey_key" ON "Order"("legacyGroupKey");

-- CreateIndex
CREATE INDEX "Order_profileId_status_idx" ON "Order"("profileId", "status");

-- CreateIndex
CREATE INDEX "Order_profileId_placedAt_idx" ON "Order"("profileId", "placedAt");

-- CreateIndex
CREATE INDEX "Order_publicToken_status_idx" ON "Order"("publicToken", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_profileId_businessDate_number_key" ON "Order"("profileId", "businessDate", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_profileId_idempotencyKey_key" ON "Order"("profileId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_legacyPurchaseId_key" ON "OrderLine"("legacyPurchaseId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_productId_idx" ON "OrderLine"("productId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_seq_idx" ON "OrderEvent"("orderId", "seq");

-- CreateIndex
CREATE INDEX "OrderEvent_orderLineId_seq_idx" ON "OrderEvent"("orderLineId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_code_key" ON "RestaurantTable"("code");

-- CreateIndex
CREATE INDEX "RestaurantTable_profileId_isActive_sortOrder_idx" ON "RestaurantTable"("profileId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_profileId_label_key" ON "RestaurantTable"("profileId", "label");

-- CreateIndex
CREATE INDEX "ProfileImage_profileId_sortOrder_idx" ON "ProfileImage"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "OfferReview_productId_status_createdAt_idx" ON "OfferReview"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OfferReview_profileId_status_createdAt_idx" ON "OfferReview"("profileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OfferReview_orderId_idx" ON "OfferReview"("orderId");

-- AddForeignKey
ALTER TABLE "OfferReview" ADD CONSTRAINT "OfferReview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferReview" ADD CONSTRAINT "OfferReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCounter" ADD CONSTRAINT "OrderCounter_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileImage" ADD CONSTRAINT "ProfileImage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity constraints Prisma cannot express in the schema file.
ALTER TABLE "OfferReview" ADD CONSTRAINT "OfferReview_target_xor_check"
  CHECK (num_nonnulls("productId", "profileId") = 1);
ALTER TABLE "OfferReview" ADD CONSTRAINT "OfferReview_rating_check"
  CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Order" ADD CONSTRAINT "Order_number_check"
  CHECK ("number" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totals_check"
  CHECK ("subtotalCents" >= 0 AND "taxCents" >= 0 AND "totalCents" = "subtotalCents" + "taxCents");
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_amounts_check"
  CHECK (
    "qty" > 0
    AND "unitPriceCents" >= 0
    AND "unitModifierCents" >= 0
    AND "lineTotalCents" = ("unitPriceCents" + "unitModifierCents") * "qty"
  );
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_capacity_check"
  CHECK (("seats" IS NULL OR "seats" > 0) AND "scans" >= 0);
ALTER TABLE "OrderCounter" ADD CONSTRAINT "OrderCounter_value_check"
  CHECK ("value" >= 0);
