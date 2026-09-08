const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
    const p = await prisma.profile.findFirst({ where: { slug: "sylvie" } })
    if (!p) throw new Error("no sylvie")

    const extras = [
        {
            title: "Office hours replay",
            subtitle: "Last live session, no slides.",
            description: "A recording of the last Founder Lab office hours. No PDF — just the session.",
            type: "VIDEO",
            priceCents: 0,
            isActive: true,
        },
        {
            title: "Weekly stack voice note",
            subtitle: "12 minutes on cadence.",
            description: "Sylvie walks the weekly stack out loud. Audio only.",
            type: "AUDIO",
            priceCents: 900,
            isActive: true,
        },
    ]

    for (const item of extras) {
        const existing = await prisma.digitalProduct.findFirst({
            where: { profileId: p.id, title: item.title },
        })
        if (existing) {
            console.log("exists", item.title)
            continue
        }
        await prisma.digitalProduct.create({
            data: { profileId: p.id, ...item, currency: "USD" },
        })
        console.log("added", item.title)
    }
}

main().finally(() => prisma.$disconnect())
