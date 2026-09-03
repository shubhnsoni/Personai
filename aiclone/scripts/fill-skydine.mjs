import { randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const SLUG = "skydine-cafe"

function code() {
    return randomBytes(18).toString("base64url")
}
function id() {
    return `c${randomBytes(12).toString("hex")}`
}

const BIO = `SkyDine Cafe sits on Hinoo Main Road, Hindpiri, Ranchi 834002 — a rooftop hangout with a direct view of Birsa Munda Airport’s runway. Planes take off while you eat.

Chinese and North Indian plates, burgers, pasta, momos, coffee, and mocktails. Open every day from noon to 11pm. About ₹700–1,000 for two. Family, students, and date nights all fit. Reservations recommended; pets are welcome; outdoor and rooftop seating.

Call 092622 68837. Find us near Paintwala, North Ranchi.`

const HEADLINE = "Rooftop cafe on Hinoo Main Road — Chinese, North Indian, and the airport runway view."

const FRAMES = [
    { url: "/uploads/skydine-cafe/terrace-dusk.jpg", title: "SkyDine Cafe, Hinoo", body: "A rooftop cafe on Hinoo Main Road where the Birsa Munda runway sits in the background. Come for Chinese and North Indian plates, stay for the planes.", category: "AMBIENCE" },
    { url: "/uploads/skydine-cafe/terrace-night.jpg", title: "Lights over the terrace", body: "Evening on the terrace. Teal sofas, umbrellas, open sky, and the airport lights in the distance.", category: "AMBIENCE" },
    { url: "/uploads/skydine-cafe/storefront.jpg", title: "Hinoo Main Road", body: "Hinoo Main Road, Hindpiri, near Paintwala. Ranchi 834002. Open noon to 11pm, every day.", category: "INTERIOR" },
    { url: "/uploads/skydine-cafe/interior.jpg", title: "Inside", body: "Teal chairs, the geometric counter, and a window onto Hinoo. Indoor seating when the terrace is full.", category: "INTERIOR" },
    { url: "/uploads/skydine-cafe/plates.jpg", title: "The plate", body: "Pasta, chilli chicken, garlic bread, momos, and North Indian thalis. Veg and non-veg. Customisable, pocket-friendly.", category: "FOOD" },
    { url: "/uploads/skydine-cafe/table.jpg", title: "For the table", body: "Known for family crowds, students, good music, and an elaborate menu. Book ahead for groups.", category: "TEAM" },
    { url: "/uploads/skydine-cafe/counter.jpg", title: "The counter", body: "Blue faceted bar, yellow walls, teal velvet. The indoor floor for lunch, birthdays, and rainy evenings.", category: "INTERIOR" },
    { url: "/uploads/skydine-cafe/chilli.jpg", title: "Chinese plates", body: "Chilli chicken, momos, noodles, and the rest of the Chinese board. Best eaten on the terrace with a plane going over.", category: "FOOD" },
]

const LAYOUT = [
    { zone: "Ground", prefix: "Hall", count: 12, seats: 4 },
    { zone: "1st floor", prefix: "Indoor", count: 16, seats: 4 },
    { zone: "Terrace", prefix: "Terrace", count: 20, seats: 6 },
]

async function main() {
    const profile = await prisma.profile.findUnique({ where: { slug: SLUG } })
    if (!profile) throw new Error("SkyDine profile not found")

    let bag = {}
    try { bag = JSON.parse(profile.personalityConfig || "{}") } catch { bag = {} }
    bag.socials = {
        instagram: "https://www.instagram.com/skydine.ranchi/",
        maps: "https://www.google.com/maps/place/SkyDine+Cafe/@23.3252515,85.3102119,17z/data=!3m1!4b1!4m6!3m5!1s0x39f4e1673a323df5:0xdeb0ef0e3c74a9a5!8m2!3d23.3252515!4d85.3102119",
        zomato: "https://www.zomato.com/ranchi/skydine-cafe-doranda",
    }
    bag.googlePlaceId = "ChIJ9T0yOmfh9DkRpal0PA7vsN4"

    await prisma.profile.update({
        where: { id: profile.id },
        data: {
            displayName: "SkyDine Cafe",
            headline: HEADLINE,
            bio: BIO,
            whatsapp: profile.whatsapp || "919262268837",
            language: "English",
            timezone: "Asia/Kolkata",
            personalityConfig: JSON.stringify(bag),
        },
    })

    const existingFrames = await prisma.$queryRaw`SELECT id FROM "ProfileImage" WHERE "profileId" = ${profile.id} ORDER BY "sortOrder" ASC`
    for (let i = 0; i < FRAMES.length; i++) {
        const frame = FRAMES[i]
        const order = i + 1
        const row = existingFrames[i]
        if (row) {
            await prisma.$executeRaw`
                UPDATE "ProfileImage"
                SET url = ${frame.url},
                    title = ${frame.title},
                    body = ${frame.body},
                    category = CAST(${frame.category} AS "ProfileImageCategory"),
                    "sortOrder" = ${order},
                    "isPublished" = true
                WHERE id = ${row.id} AND "profileId" = ${profile.id}
            `
        } else {
            await prisma.$executeRaw`
                INSERT INTO "ProfileImage" (id, "profileId", url, title, caption, body, category, "sortOrder", "isPublished", "createdAt")
                VALUES (
                    ${id()},
                    ${profile.id},
                    ${frame.url},
                    ${frame.title},
                    ${null},
                    ${frame.body},
                    CAST(${frame.category} AS "ProfileImageCategory"),
                    ${order},
                    true,
                    CURRENT_TIMESTAMP
                )
            `
        }
    }
    if (existingFrames.length > FRAMES.length) {
        const extra = existingFrames.slice(FRAMES.length).map((row) => row.id)
        for (const extraId of extra) {
            await prisma.$executeRaw`DELETE FROM "ProfileImage" WHERE id = ${extraId} AND "profileId" = ${profile.id}`
        }
    }
    console.log("story frames", FRAMES.length)

    const tables = await prisma.restaurantTable.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    })
    const wanted = LAYOUT.flatMap((floor, fi) =>
        Array.from({ length: floor.count }, (_, i) => ({
            label: `${floor.prefix} ${i + 1}`,
            seats: floor.seats,
            zone: floor.zone,
            sortOrder: fi * 50 + i + 1,
        })),
    )

    for (let i = 0; i < wanted.length; i++) {
        const spec = wanted[i]
        const row = tables[i]
        if (row) {
            await prisma.restaurantTable.update({
                where: { id: row.id },
                data: { label: spec.label, seats: spec.seats, zone: spec.zone, sortOrder: spec.sortOrder, isActive: true },
            })
        } else {
            await prisma.restaurantTable.create({
                data: {
                    profileId: profile.id,
                    label: spec.label,
                    seats: spec.seats,
                    zone: spec.zone,
                    sortOrder: spec.sortOrder,
                    isActive: true,
                    code: code(),
                },
            })
        }
    }
    if (tables.length > wanted.length) {
        const extra = tables.slice(wanted.length).map((row) => row.id)
        await prisma.restaurantTable.updateMany({
            where: { id: { in: extra }, profileId: profile.id },
            data: { isActive: false },
        })
    }

    await prisma.serviceOffering.updateMany({
        where: { profileId: profile.id, kind: "TABLE" },
        data: { covers: wanted.length },
    })

    console.log("profile, about, and", wanted.length, "tables ready")
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
}).finally(() => prisma.$disconnect())
