import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function about(name: string) {
    return {
        headline: "Neighbourhood pharmacy",
        bio: `${name} is a neighbourhood pharmacy for everyday fever, cold, and prescription medicines.\n\nEverything on the shelf is a physical item — tablets, syrups, and other OTC or Rx stock with batch and expiry. Nothing here is a digital download.\n\nAsk about a medicine, check what’s in stock, or order for pickup at the counter.`,
        welcomeMessageOverride: "Ask about a medicine, stock, or pickup.",
    }
}

async function main() {
    const pharmacies = await prisma.profile.findMany({
        where: {
            OR: [{ roleTemplate: "PHARMACY" }, { slug: { contains: "pharmacy" } }],
        },
        select: { id: true, slug: true, displayName: true, headline: true, bio: true, roleTemplate: true },
    })
    console.log(
        "profiles",
        pharmacies.map((p) => ({ slug: p.slug, role: p.roleTemplate, hasBio: Boolean(p.bio) })),
    )
    for (const row of pharmacies) {
        const copy = about(row.displayName)
        await prisma.profile.update({
            where: { id: row.id },
            data: {
                roleTemplate: "PHARMACY",
                headline: row.headline?.trim() || copy.headline,
                bio: row.bio?.trim() || copy.bio,
                welcomeMessageOverride: copy.welcomeMessageOverride,
            },
        })
        const products = await prisma.digitalProduct.updateMany({
            where: { profileId: row.id },
            data: { fulfillment: "PHYSICAL", type: "PHYSICAL" },
        })
        const after = await prisma.profile.findUnique({
            where: { id: row.id },
            select: { slug: true, headline: true, bio: true },
        })
        console.log("updated", after?.slug, after?.headline, "products", products.count)
    }
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
