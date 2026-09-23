import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"
import { resolveThemedOrb } from "@/lib/bloub/catalog"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { BookList } from "./book-list"
import { isRestaurant, needsGuestTableOffering, hoursToday } from "@/lib/menu"
import { ensureTableService } from "@/app/actions/bookings"
import { Tracker } from "@/components/profile/tracker"
import { SessionProbe } from "@/components/profile/session-probe"
import { isHotelRole } from "@/lib/hotels"
import { resolveHotelBrandLogo } from "@/lib/hotels/guest-menu"
import { hotelStayOfferingsFromServices } from "@/lib/hotels/guest-book"
import { HotelGuestBook } from "@/components/hotel/hotel-guest-book"
import { shouldUseCreatorLeadBookEmpty } from "@/lib/creator/guest-book"
import { guestBookEmptyCopy } from "@/lib/kit-copy"
import { CreatorGuestBook } from "@/components/creator/creator-guest-book"

export const dynamic = "force-dynamic"

async function HotelBookPage({ slug }: { slug: string }) {
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            availability: true,
            profileImages: { select: { id: true }, take: 1 },
            hotelProperty: true,
            serviceOfferings: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
        },
    })
    if (!profile || !profile.isPublic || !isHotelRole(profile.roleTemplate)) notFound()

    const rooms = await prisma.hotelRoom.findMany({
        where: { profileId: profile.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
        select: { number: true, floor: true, category: true },
    })

    const property = profile.hotelProperty
    const logo = resolveHotelBrandLogo(
        (profile as { shopLogoUrl?: string | null }).shopLogoUrl,
        profile.imageUrl,
    )
    const aboutHref = profile.profileImages.length ? `/${slug}/story` : undefined
    const hours = profile.availability.length
        ? hoursToday(profile.availability)
        : property?.propertyHours || null
    const offerings = hotelStayOfferingsFromServices(profile.serviceOfferings)
    const whatsapp = profile.whatsapp || property?.receptionWhatsapp || null

    return (
        <>
            <Tracker slug={slug} name="hotel_book_view" />
            <SessionProbe slug={slug} />
            <HotelGuestBook
                slug={slug}
                name={profile.displayName}
                logoUrl={logo}
                whatsapp={whatsapp}
                aboutHref={aboutHref}
                hours={hours}
                checkInTime={property?.checkInTime || null}
                checkOutTime={property?.checkOutTime || null}
                roomCountHint={property?.roomCount ?? null}
                rooms={rooms}
                offerings={offerings}
                receptionPhone={property?.receptionPhone || null}
            />
        </>
    )
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    const roleRow = await prisma.profile.findUnique({
        where: { slug },
        select: { roleTemplate: true, isPublic: true },
    })
    if (!roleRow || !roleRow.isPublic) notFound()
    if (isHotelRole(roleRow.roleTemplate)) {
        return HotelBookPage({ slug })
    }

    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            animationStyle: true,
            serviceOfferings: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
        },
    })
    if (!profile || !profile.isPublic) notFound()

    const restaurant = isRestaurant(profile.roleTemplate)
    if (
        needsGuestTableOffering(profile.roleTemplate, profile.primaryGoal) &&
        !profile.serviceOfferings.some((s) => (s as { kind?: string }).kind === "TABLE")
    ) {
        try {
            await ensureTableService(profile.id)
            const again = await prisma.serviceOffering.findMany({
                where: { profileId: profile.id, isActive: true },
                orderBy: { createdAt: "desc" },
            })
            profile.serviceOfferings = again
        } catch {
            // Guest /book must still render when offerings are at plan limit.
        }
    }

    // CREATOR / COLLECT_LEADS empty → lead Contact surface (never "No sessions to book.")
    // Populated offerings (e.g. CONSULTANT /demo/book) still use BookList below.
    if (
        shouldUseCreatorLeadBookEmpty({
            role: profile.roleTemplate,
            primaryGoal: profile.primaryGoal,
            offeringCount: profile.serviceOfferings.length,
        })
    ) {
        const logo = (profile as { shopLogoUrl?: string | null }).shopLogoUrl
        return (
            <>
                <Tracker slug={slug} name="book_view" />
                <SessionProbe slug={slug} />
                <CreatorGuestBook
                    slug={slug}
                    name={profile.displayName}
                    logoUrl={logo}
                    whatsapp={profile.whatsapp}
                    role={profile.roleTemplate}
                    primaryGoal={profile.primaryGoal}
                />
            </>
        )
    }

    const config = await publicAnimationConfig(profile.id, configuredProfileAnimation(profile))
    const catalogTheme = resolveThemedOrb(config.theme)
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const logo = (profile as { shopLogoUrl?: string | null }).shopLogoUrl

    return (
        <div
            data-public-catalog-theme={catalogTheme ?? undefined}
            className={catalogTheme ? "min-h-dvh bg-background text-foreground" : "dark min-h-dvh bg-zinc-950 text-zinc-100"}
            style={
                catalogTheme
                    ? undefined
                    : {
                          ["--pl-aurora" as string]: theme.accent,
                          ["--pl-brand-foreground" as string]: theme.onAccent,
                      }
            }
        >
            <Tracker slug={slug} name={restaurant ? "reserve_open" : "visit"} />
            <CatalogHeader
                themeToggle={Boolean(catalogTheme)}
                slug={slug}
                name={profile.displayName}
                logoUrl={logo}
                label={restaurant ? "Reserve" : "Book"}
            />
            <main className="mx-auto max-w-2xl px-4 py-5 pb-10">
                {profile.serviceOfferings.length === 0 ? (
                    <p className="py-16 text-center text-sm text-zinc-500">
                        {guestBookEmptyCopy(profile.roleTemplate, profile.primaryGoal)}
                    </p>
                ) : (
                    <BookList
                        profile={{
                            id: profile.id,
                            displayName: profile.displayName,
                            whatsapp: profile.whatsapp,
                            roleTemplate: profile.roleTemplate,
                        }}
                        services={profile.serviceOfferings}
                        restaurant={restaurant}
                    />
                )}
            </main>
        </div>
    )
}
