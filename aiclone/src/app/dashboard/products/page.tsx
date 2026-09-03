import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ProductsList } from "@/components/dashboard/products-list"
import { requireSurface } from "@/lib/require-surface"
import { extrasOf } from "@/lib/surfaces"

export const dynamic = 'force-dynamic'

export default async function DashboardProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ ar?: string }>
}) {
    const ar = (await searchParams).ar
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "shop", profile)

    const { prisma } = await import("@/lib/prisma")
    const products = await prisma.digitalProduct.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
    })
    const preps = await prisma.$queryRaw<Array<{ id: string; prepMinutes: number | null }>>`
        SELECT id, "prepMinutes" FROM "DigitalProduct" WHERE "profileId" = ${profile.id}
    `.catch(() => [] as Array<{ id: string; prepMinutes: number | null }>)
    const prepById = new Map(preps.map((row) => [row.id, row.prepMinutes]))
    const dishes = products.map((product) => ({ ...product, prepMinutes: prepById.get(product.id) ?? null }))

    return (
        <div className="flex-1 space-y-4">
            <ProductsList
                profileId={profile.id}
                slug={profile.slug}
                whatsapp={profile.whatsapp}
                restaurant={profile.roleTemplate === "RESTAURANT"}
                role={profile.roleTemplate}
                extras={extrasOf(profile)}
                products={dishes}
                arBatch={ar}
            />
        </div>
    )
}
