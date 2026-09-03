import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const rows = await prisma.$queryRaw`
  SELECT c.relname AS name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('PartyAccount','MetalLot','MetalBill','MetalBillLine','MetalPayment','MetalAllocation','PartyLedgerEntry')
  ORDER BY 1`
console.log(rows.map((r) => r.name).join(","))
await prisma.$disconnect()
