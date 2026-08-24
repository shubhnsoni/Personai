import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
    const c = await prisma.course.findFirst({ where: { title: "Founder Lab" }, select: { id: true } })
    const p = await prisma.digitalProduct.findFirst({ where: { title: "First 90 days workbook" }, select: { id: true } })
    console.log(JSON.stringify({ course: c?.id, product: p?.id }))
}
main().finally(async () => { await prisma.$disconnect() })
