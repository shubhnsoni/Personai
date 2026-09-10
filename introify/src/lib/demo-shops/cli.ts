import { prisma } from "@/lib/prisma"
import { DEMO_SHOPS } from "./index"
import { applyDemoShop } from "./apply"

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
