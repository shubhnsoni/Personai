import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const s = await p.profile.findUnique({ where: { slug: "sylvie" }, select: { roleTemplate: true, id: true } })
const rows = await p.digitalProduct.findMany({
    where: { profileId: s.id },
    select: { title: true, fulfillment: true, type: true, isActive: true, priceCents: true },
})
console.log(JSON.stringify({ role: s.roleTemplate, count: rows.length, rows }, null, 2))
await p.$disconnect()
