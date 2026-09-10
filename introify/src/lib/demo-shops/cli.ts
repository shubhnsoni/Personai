import { prisma } from "@/lib/prisma"
import { DEMO_SHOPS } from "./index"
import { applyDemoShop } from "./apply"

function databaseTarget() {
    const raw = process.env.DATABASE_URL || ""
    let host = ""
    let name = ""
    try {
        const url = new URL(raw.replace(/^postgresql:/, "http:"))
        host = url.hostname
        name = url.pathname.replace(/^\//, "").split("?")[0]
    } catch {
        host = ""
    }
    const local = host === "127.0.0.1" || host === "localhost"
    if (local && process.env.INTROIFY_SEED_LOCAL !== "1") {
        throw new Error("Refusing to seed loopback Postgres. Set INTROIFY_SEED_LOCAL=1 for a local copy, or run this on Hostinger with production DATABASE_URL.")
    }
    return { host, name, local }
}

async function ownerUserId() {
    const sky = await prisma.profile.findUnique({ where: { slug: "skydine-cafe" }, select: { userId: true } })
    if (sky?.userId) return sky.userId
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
    if (admin?.id) return admin.id
    const any = await prisma.user.findFirst({ select: { id: true } })
    if (!any) throw new Error("No user to own demo shops")
    return any.id
}

async function main() {
    const target = databaseTarget()
    console.log(`Demo shop seed: ${DEMO_SHOPS.length} catalogs → ${target.host}/${target.name}`)
    const userId = await ownerUserId()
    for (const shop of DEMO_SHOPS) {
        let profile = await prisma.profile.findUnique({ where: { slug: shop.slug } })
        if (!profile) {
            const clash = await prisma.profile.findFirst({ where: { userId, slug: shop.slug } })
            profile = clash || await prisma.profile.create({
                data: {
                    userId,
                    slug: shop.slug,
                    displayName: shop.name,
                    roleTemplate: shop.flavor,
                    primaryGoal: shop.goal,
                    language: "en",
                    timezone: "Asia/Kolkata",
                    isPublic: true,
                },
            })
        }
        await applyDemoShop(prisma, profile.id, shop, { replaceCatalog: true })
        console.log("filled", shop.flavor, shop.slug)
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
