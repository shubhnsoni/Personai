import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

const profile = await p.profile.findFirst({
    where: { OR: [{ slug: "blu-cafe" }, { slug: "skydine-cafe" }] },
})
if (!profile) throw new Error("cafe profile not found")

let personality = profile.personalityConfig || "{}"
personality = personality
    .replaceAll("Blu Cafe", "SkyDine Cafe")
    .replaceAll("Blu cafe", "SkyDine Cafe")
    .replaceAll("blu-cafe", "skydine-cafe")

await p.profile.update({
    where: { id: profile.id },
    data: {
        displayName: "SkyDine Cafe",
        slug: "skydine-cafe",
        headline: "All-day cafe on Hill Road, Bandra",
        bio: (profile.bio || "").replaceAll("Blu Cafe", "SkyDine Cafe").replaceAll("Blu cafe", "SkyDine Cafe"),
        welcomeMessageOverride: "Ask for the menu, a table tonight, or tap a dish to place it on the table.",
        personalityConfig: personality,
        upiId: "skydine@okaxis",
    },
})

const docs = await p.profileDocument.findMany({ where: { profileId: profile.id } })
for (const d of docs) {
    await p.profileDocument.update({
        where: { id: d.id },
        data: {
            rawText: (d.rawText || "").replaceAll("Blu Cafe", "SkyDine Cafe").replaceAll("blucafe", "skydine"),
        },
    })
}

await p.workExperience.updateMany({
    where: { profileId: profile.id, company: "Blu Cafe" },
    data: { company: "SkyDine Cafe" },
})
await p.project.updateMany({
    where: { profileId: profile.id, client: "Blu Cafe" },
    data: { client: "SkyDine Cafe" },
})
await p.event.updateMany({
    where: { profileId: profile.id },
    data: { location: "SkyDine Cafe, Hill Road, Bandra West" },
})
await p.shortLink.updateMany({
    where: { profileId: profile.id },
    data: { targetUrl: "/skydine-cafe", title: "SkyDine Cafe" },
})

const taken = await p.shortLink.findUnique({ where: { code: "sky" } })
if (!taken) {
    await p.shortLink.updateMany({
        where: { profileId: profile.id, code: "blu" },
        data: { code: "sky" },
    })
}

console.log(JSON.stringify({ id: profile.id, slug: "skydine-cafe", name: "SkyDine Cafe" }))
await p.$disconnect()
