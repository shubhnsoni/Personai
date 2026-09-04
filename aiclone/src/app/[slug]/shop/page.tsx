import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { ShopCatalog } from "@/components/shop/shop-catalog"
import { RestaurantMenu } from "@/components/shop/restaurant-menu"
import { getRequestCurrency } from "@/lib/request-currency"
import { parseGallery } from "@/lib/commerce"
import { catalogLabel, hoursToday, isRestaurant } from "@/lib/menu"
import { payModeFromConfig } from "@/lib/payment-qr"
import { Tracker } from "@/components/profile/tracker"
import { isJewelryRetail, isJewelryWholesale } from "@/lib/metal/math"
import { goldBoardFromConfig } from "@/lib/metal/board"
import { catalogTicketPaise, metalLine } from "@/lib/metal/product"
import { isExpiredMedicine, isPharmacy, isRxRequired, shopExpiryLine } from "@/lib/pharmacy/batch"
import { fitmentLine, isAutoParts, parseFitment } from "@/lib/autoparts/fitment"
import { GoldRateStrip } from "@/components/shop/gold-rate-strip"

export const dynamic = "force-dynamic"

export default async function ShopPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>
    searchParams?: Promise<{ t?: string | string[] }>
}) {
    const { slug } = await params
    const query = searchParams ? await searchParams : {}
    const rawTableCode = Array.isArray(query.t) ? query.t[0] : query.t
    const requestedTableCode = rawTableCode?.trim().slice(0, 128) || null
    const currency = await getRequestCurrency()
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            animationStyle: true,
            digitalProducts: {
                where: { isActive: true },
                orderBy: { createdAt: "desc" },
                include: { reviews: { select: { rating: true } } },
            },
            availability: true,
            profileImages: { select: { id: true }, take: 1 },
        },
    })
    if (!profile || !profile.isPublic) notFound()

    let config: { colors?: string[]; variant?: string } = {}
    try {
        config = profile.animationStyle?.config ? JSON.parse(profile.animationStyle.config) : {}
    } catch { /* ignore */ }
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const logo = (profile as { shopLogoUrl?: string | null }).shopLogoUrl || profile.imageUrl
    const restaurant = isRestaurant(profile.roleTemplate)
    const aboutHref = profile.profileImages.length ? `/${slug}/story` : undefined
    const hours = profile.availability.length ? hoursToday(profile.availability) : null
    const goldBoard = goldBoardFromConfig(profile.personalityConfig)
    const jewelry = isJewelryRetail(profile.roleTemplate)
    const wholesale = isJewelryWholesale(profile.roleTemplate)
    const pharmacy = isPharmacy(profile.roleTemplate)
    const autoParts = isAutoParts(profile.roleTemplate)
    const restaurantTable = restaurant && requestedTableCode
        ? await prisma.restaurantTable.findFirst({
            where: { profileId: profile.id, code: requestedTableCode, isActive: true },
            select: { label: true },
        })
        : null

    if (restaurant) {
        return (
            <div className="min-h-dvh bg-background text-foreground">
                <Tracker slug={slug} name="menu_view" />
                <CatalogHeader
                    slug={slug}
                    name={profile.displayName}
                    logoUrl={logo}
                    label={catalogLabel(profile.roleTemplate)}
                    whatsapp={profile.whatsapp}
                    aboutHref={aboutHref}
                    hours={hours}
                    themeToggle
                    compact
                />
                <RestaurantMenu
                    slug={slug}
                    shopName={profile.displayName}
                    currency={profile.digitalProducts.some((p) => p.currency === "INR") ? "INR" : currency}
                    logoUrl={logo}
                    whatsapp={profile.whatsapp}
                    upiId={profile.upiId}
                    tableCode={requestedTableCode}
                    tableLabel={restaurantTable?.label || null}
                    prepaid={payModeFromConfig((profile as { personalityConfig?: string | null }).personalityConfig) === "PREPAID"}
                    items={profile.digitalProducts.map((p) => {
                        const reviews = p.reviews
                        return {
                            id: p.id,
                            title: p.title,
                            thumbnailUrl: p.thumbnailUrl || parseGallery(p.galleryUrls)[0] || null,
                            priceCents: p.priceCents,
                            currency: p.currency,
                            compareAtCents: p.compareAtCents,
                            category: p.category,
                            diet: (p as { diet?: string | null }).diet,
                            sold: p.downloadCount,
                            rating: reviews.length
                                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                                : null,
                            ar: Boolean((p as { arModelUrl?: string | null }).arModelUrl),
                        }
                    })}
                />
            </div>
        )
    }

    return (
        <div
            className="dark min-h-dvh bg-zinc-950 text-zinc-100"
            style={{ ["--pl-aurora" as string]: theme.accent, ["--pl-brand-foreground" as string]: theme.onAccent }}
        >
            <Tracker slug={slug} name="shop_view" />
            <CatalogHeader slug={slug} name={profile.displayName} logoUrl={logo} label={catalogLabel(profile.roleTemplate)} whatsapp={profile.whatsapp} aboutHref={aboutHref} hours={hours} />

            <main className="mx-auto max-w-2xl px-4 py-5 pb-10">
                {jewelry || wholesale ? (
                    <div className="mb-4">
                        <GoldRateStrip board={goldBoard} wholesale={wholesale} />
                    </div>
                ) : null}
                <ShopCatalog
                    slug={slug}
                    shopName={profile.displayName}
                    currency={jewelry || wholesale ? "INR" : currency}
                    accent={theme.mid || theme.accent}
                    whatsapp={profile.whatsapp}
                    upiId={profile.upiId}
                    restaurant={restaurant}
                    hours={restaurant ? hoursToday(profile.availability) : null}
                    bookHref={restaurant ? `/${slug}/reserve` : null}
                    items={profile.digitalProducts.filter((p) => !(pharmacy && isExpiredMedicine(p.variantsJson))).map((p) => {
                        const fitment = autoParts ? parseFitment(p.variantsJson) : null
                        return {
                        id: p.id,
                        title: p.title,
                        type: p.type,
                        thumbnailUrl: p.thumbnailUrl || parseGallery(p.galleryUrls)[0] || null,
                        priceCents: jewelry
                            ? catalogTicketPaise(p.variantsJson, goldBoard, p.priceCents)
                            : p.priceCents,
                        currency: jewelry ? "INR" : p.currency,
                        fulfillment: p.fulfillment,
                        stock: p.stock,
                        category: p.category,
                        diet: (p as { diet?: string | null }).diet,
                        spiceLevel: (p as { spiceLevel?: number | null }).spiceLevel,
                        ar: Boolean((p as { arModelUrl?: string | null }).arModelUrl),
                        metalLine: jewelry || wholesale ? metalLine(p.variantsJson) : null,
                        extraLine: pharmacy ? (shopExpiryLine(p.variantsJson)?.text || null) : fitment ? fitmentLine(p.variantsJson) : null,
                        extraWarn: pharmacy ? Boolean(shopExpiryLine(p.variantsJson)?.warn) : false,
                        rxRequired: pharmacy ? isRxRequired(p.variantsJson) : false,
                        fitmentMake: fitment?.make || null,
                        fitmentYearFrom: fitment?.yearFrom ?? null,
                        fitmentYearTo: fitment?.yearTo ?? null,
                        }
                    })}
                />
            </main>
        </div>
    )
}
