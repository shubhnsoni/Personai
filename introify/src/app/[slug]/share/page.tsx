import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { catalogPath, isRestaurant } from "@/lib/menu"
import { GuestSharePanel } from "@/components/profile/guest-qr-share"
import { isHotelRole, resolveGuestWhatsapp } from "@/lib/hotels"
import { ensureTryHotelShowcase, isTryHotelShowcaseSlug } from "@/lib/hotels/ensure-try-hotel"

export const dynamic = "force-dynamic"

export default async function GuestSharePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    // Tiny seed hook: visiting /share must backfill Haven Profile.whatsapp when null.
    if (isTryHotelShowcaseSlug(slug)) {
        await ensureTryHotelShowcase(prisma, slug)
    }

    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: {
            id: true,
            displayName: true,
            isPublic: true,
            roleTemplate: true,
            slug: true,
            whatsapp: true,
        },
    })
    if (!profile || !profile.isPublic) notFound()

    const hotel = isHotelRole(profile.roleTemplate)
    let receptionWhatsapp: string | null = null
    if (hotel) {
        const property = await prisma.hotelProperty.findUnique({
            where: { profileId: profile.id },
            select: { receptionWhatsapp: true },
        })
        receptionWhatsapp = property?.receptionWhatsapp || null
    }
    const whatsapp = resolveGuestWhatsapp(profile.whatsapp, receptionWhatsapp)

    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "introify.com"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${proto}://${host}`
    const food = isRestaurant(profile.roleTemplate)
    const pageUrl = `${origin}/${profile.slug}`
    const menuUrl = food ? `${origin}${catalogPath(profile.slug, profile.roleTemplate)}` : null

    return (
        <GuestSharePanel
            slug={profile.slug}
            name={profile.displayName}
            pageUrl={pageUrl}
            menuUrl={menuUrl}
            whatsapp={whatsapp}
            isFood={food}
            isHotel={hotel}
        />
    )
}
