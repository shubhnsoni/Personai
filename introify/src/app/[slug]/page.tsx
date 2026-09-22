import { PublicProfileScreen } from "./public-profile-screen"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { ensureHotelProperty } from "@/lib/hotels/store"
import { ensureTryFoodShowcase, isTryFoodShowcaseSlug } from "@/lib/demo-shops/ensure-try-food"

export const dynamic = "force-dynamic"

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    if (isTryFoodShowcaseSlug(slug)) {
        await ensureTryFoodShowcase(prisma, slug)
    }
    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, roleTemplate: true, isPublic: true } })
    if (profile?.isPublic && isHotelRole(profile.roleTemplate)) {
        await ensureHotelProperty(profile.id)
    }
    return <PublicProfileScreen slug={slug} />
}
