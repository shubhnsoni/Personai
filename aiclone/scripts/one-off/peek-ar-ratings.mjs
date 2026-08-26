import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

const prof = await p.profile.findFirst({ where: { slug: "skydine-cafe" } })
const items = await p.digitalProduct.findMany({
    where: { profileId: prof.id, arModelUrl: { not: null } },
    select: {
        title: true,
        diet: true,
        spiceLevel: true,
        downloadCount: true,
        reviews: { select: { rating: true } },
    },
    orderBy: { createdAt: "asc" },
})

for (const i of items) {
    const n = i.reviews.length
    const avg = n ? (i.reviews.reduce((a, r) => a + r.rating, 0) / n).toFixed(2) : "-"
    console.log(
        [
            i.title.padEnd(22),
            `diet=${(i.diet || "-").padEnd(7)}`,
            `spice=${i.spiceLevel ?? "-"}`,
            `sold=${i.downloadCount}`,
            `reviews=${n}`,
            `avg=${avg}`,
        ].join("  "),
    )
}

await p.$disconnect()
