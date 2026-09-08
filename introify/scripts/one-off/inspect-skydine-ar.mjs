import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

const profile = await p.profile.findFirst({ where: { slug: "skydine-cafe" } })
if (!profile) throw new Error("SkyDine profile missing")
console.log("profile", profile.id, profile.slug, profile.roleTemplate, "public:", profile.isPublic)

const items = await p.digitalProduct.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" },
    select: {
        id: true,
        title: true,
        category: true,
        isActive: true,
        priceCents: true,
        currency: true,
        arModelUrl: true,
        thumbnailUrl: true,
    },
})
console.log("items", items.length)
for (const it of items) {
    console.log(
        [
            it.id,
            it.isActive ? "on " : "off",
            (it.priceCents / 100).toFixed(2),
            it.currency,
            (it.category || "-").padEnd(18),
            it.title.padEnd(28),
            it.arModelUrl || "(no ar)",
        ].join(" | "),
    )
}
await p.$disconnect()
