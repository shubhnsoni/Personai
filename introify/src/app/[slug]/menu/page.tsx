import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ensureTryFoodShowcase, isTryFoodShowcaseSlug } from "@/lib/demo-shops/ensure-try-food"
import { ensureTryShopShowcase, isTryShopShowcaseSlug } from "@/lib/demo-shops/ensure-try-shop"
import { ensureLittleHoursShowcase, isLittleHoursSlug } from "@/lib/showcase-profiles"
import { isHotelRole } from "@/lib/hotels"
import { hotelServiceLabels, resolveHotelBrandLogo } from "@/lib/hotels/guest-menu"
import { listLinkedRestaurants } from "@/lib/hotels/store"
import { hoursToday } from "@/lib/menu"
import { HotelGuestMenu } from "@/components/hotel/hotel-guest-menu"
import { Tracker } from "@/components/profile/tracker"
import { SessionProbe } from "@/components/profile/session-probe"
import ShopPage from "../shop/page"

export const dynamic = "force-dynamic"

function parseStringArray(raw?: string | null): string[] {
    try {
        const value = JSON.parse(raw || "[]")
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
    } catch {
        return []
    }
}

async function HotelMenuPage({ slug }: { slug: string }) {
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            availability: true,
            profileImages: { select: { id: true }, take: 1 },
            hotelProperty: true,
        },
    })
    if (!profile || !profile.isPublic || !isHotelRole(profile.roleTemplate)) notFound()

    const [rooms, linked] = await Promise.all([
        prisma.hotelRoom.findMany({
            where: { profileId: profile.id, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
            select: { number: true, floor: true, category: true },
        }),
        listLinkedRestaurants(profile.id),
    ])

    const restaurants = linked
        .filter((row) => row.isPublic)
        .map((row) => ({
            name: row.name,
            slug: row.slug,
            label: row.label,
            headline: row.headline,
        }))

    const property = profile.hotelProperty
    const amenities = parseStringArray(property?.amenitiesJson)
    const services = hotelServiceLabels(parseStringArray(property?.servicesJson))
    const logo = resolveHotelBrandLogo(
        (profile as { shopLogoUrl?: string | null }).shopLogoUrl,
        profile.imageUrl,
    )
    const aboutHref = profile.profileImages.length ? `/${slug}/story` : undefined
    const hours = profile.availability.length ? hoursToday(profile.availability) : property?.propertyHours || null

    return (
        <>
            <Tracker slug={slug} name="hotel_menu_view" />
            <SessionProbe slug={slug} />
            <HotelGuestMenu
                slug={slug}
                name={profile.displayName}
                logoUrl={logo}
                whatsapp={profile.whatsapp || property?.receptionWhatsapp || null}
                aboutHref={aboutHref}
                hours={hours}
                checkInTime={property?.checkInTime || null}
                checkOutTime={property?.checkOutTime || null}
                roomCountHint={property?.roomCount ?? null}
                rooms={rooms}
                amenities={amenities}
                services={services}
                restaurants={restaurants}
            />
        </>
    )
}

export default async function MenuPage(props: {
    params: Promise<{ slug: string }>
    searchParams?: Promise<{ t?: string | string[] }>
}) {
    const { slug } = await props.params
    if (isTryFoodShowcaseSlug(slug)) {
        await ensureTryFoodShowcase(prisma, slug)
    }
    if (isTryShopShowcaseSlug(slug)) {
        await ensureTryShopShowcase(prisma, slug)
    }
    if (isLittleHoursSlug(slug)) {
        await ensureLittleHoursShowcase(prisma, slug)
    }

    const roleRow = await prisma.profile.findUnique({
        where: { slug },
        select: { roleTemplate: true, isPublic: true },
    })
    if (roleRow?.isPublic && isHotelRole(roleRow.roleTemplate)) {
        return HotelMenuPage({ slug })
    }

    return ShopPage(props)
}
