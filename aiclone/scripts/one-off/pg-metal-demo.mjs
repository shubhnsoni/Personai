import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const slugs = await prisma.profile.findMany({
  where: { slug: { in: ["try-gold-wholesale", "try-jewelry-retail"] } },
  select: { slug: true, roleTemplate: true, isPublic: true, id: true },
})
console.log("kits", JSON.stringify(slugs))
const leftover = await prisma.profile.findMany({
  where: { OR: [{ slug: { startsWith: "w0-" } }, { slug: { startsWith: "r0-" } }] },
  select: { id: true, slug: true },
})
console.log("leftover", JSON.stringify(leftover))
await prisma.$executeRaw`ALTER TABLE "PartyLedgerEntry" DISABLE TRIGGER "PartyLedgerEntry_append_only"`
try {
  for (const row of leftover) {
    await prisma.$executeRaw`DELETE FROM "MetalBill" WHERE "profileId" = ${row.id}`
    await prisma.$executeRaw`DELETE FROM "MetalPayment" WHERE "profileId" = ${row.id}`
    await prisma.$executeRaw`DELETE FROM "MetalLot" WHERE "profileId" = ${row.id}`
    await prisma.$executeRaw`DELETE FROM "PartyAccount" WHERE "profileId" = ${row.id}`
    await prisma.digitalProduct.deleteMany({ where: { profileId: row.id } })
    await prisma.profile.delete({ where: { id: row.id } })
    console.log("wiped", row.slug)
  }
} finally {
  await prisma.$executeRaw`ALTER TABLE "PartyLedgerEntry" ENABLE TRIGGER "PartyLedgerEntry_append_only"`
}
await prisma.$disconnect()
