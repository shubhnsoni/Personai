import { redirect, notFound } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ProductForm } from "@/components/dashboard/product-form"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = 'force-dynamic'

interface EditProductPageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "shop", profile)

    const { id } = await params

    const { prisma } = await import("@/lib/prisma")
    const product = await prisma.digitalProduct.findFirst({
        where: {
            id,
            profileId: profile.id,
        },
    })

    if (!product) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-4">
            <div className="max-w-2xl mx-auto">
                <ProductForm profileId={profile.id} product={product} />
            </div>
        </div>
    )
}
