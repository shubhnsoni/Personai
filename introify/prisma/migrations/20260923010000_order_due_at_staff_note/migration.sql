-- Order.dueAt / staffNote were in schema.prisma but never migrated.
-- Guest place-order wrote dueAt via raw UPDATE and failed on LIVE with a
-- column-missing Prisma error mapped to the generic toast.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffNote" TEXT;
