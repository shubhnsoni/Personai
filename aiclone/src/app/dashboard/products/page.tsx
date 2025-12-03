import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ProductsList } from "@/components/dashboard/products-list"

export default async function DashboardProductsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const products = await prisma.digitalProduct.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <ProductsList profileId={profile.id} products={products} />
        </div>
    )
}
