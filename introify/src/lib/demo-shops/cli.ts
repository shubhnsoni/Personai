import { prisma } from "@/lib/prisma"
import { DEMO_SHOPS } from "./index"
import { applyDemoShop } from "./apply"
import { orderedDemoShops, runPool, seedBudgetMs, shouldSkipPopulated } from "./seed-order"

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
    const shops = orderedDemoShops(DEMO_SHOPS)
    const budgetMs = seedBudgetMs()
    const deadline = Date.now() + budgetMs
    console.log(`Demo shop seed: ${shops.length} catalogs → ${target.host}/${target.name} (${Math.round(budgetMs / 1000)}s budget)`)
    const userId = await ownerUserId()
    let filled = 0
    let skipped = 0
    const pending: { shop: (typeof shops)[number]; profileId: string; fresh: boolean }[] = []
    for (const shop of shops) {
        let profile = await prisma.profile.findUnique({ where: { slug: shop.slug } })
        let fresh = false
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
            fresh = !clash
        }
        const productCount = await prisma.digitalProduct.count({ where: { profileId: profile.id } })
        const serviceCount = await prisma.serviceOffering.count({ where: { profileId: profile.id } })
        if (shouldSkipPopulated(shop, productCount, serviceCount, process.env.INTROIFY_SEED_REPLACE === "1")) {
            console.log("skip existing", shop.flavor, shop.slug)
            skipped++
            continue
        }
        pending.push({ shop, profileId: profile.id, fresh: fresh || productCount + serviceCount === 0 })
    }
    await runPool(pending, 3, async (row) => {
        if (Date.now() >= deadline) return
        await applyDemoShop(prisma, row.profileId, row.shop, { replaceCatalog: true, fresh: row.fresh })
        console.log("filled", row.shop.flavor, row.shop.slug)
        filled++
    })
    if (filled + skipped < shops.length) {
        console.log(`seed budget reached after ${filled} filled, ${skipped} skipped; remaining shops wait for the next deploy`)
    }
    console.log(`Demo shop seed done: ${filled} filled, ${skipped} skipped`)
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
