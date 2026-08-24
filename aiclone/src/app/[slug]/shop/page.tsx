import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { ShopCatalog } from "@/components/shop/shop-catalog"
import { getRequestCurrency } from "@/lib/request-currency"
import { parseGallery } from "@/lib/commerce"
import { catalogLabel, hoursToday, isRestaurant } from "@/lib/menu"
import { Tracker } from "@/components/profile/tracker"

export const dynamic = "force-dynamic"

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const currency = await getRequestCurrency()
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            animationStyle: true,
            digitalProducts: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
            availability: true,
        },
    })
    if (!profile || !profile.isPublic) notFound()

    let config: { colors?: string[]; variant?: string } = {}
    try {
        config = profile.animationStyle?.config ? JSON.parse(profile.animationStyle.config) : {}
    } catch { /* ignore */ }
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const logo = (profile as { shopLogoUrl?: string | null }).shopLogoUrl
    const restaurant = isRestaurant(profile.roleTemplate)

    return (
        <div
            className="dark min-h-dvh bg-zinc-950 text-zinc-100"
            style={{ ["--pl-aurora" as string]: theme.accent, ["--pl-brand-foreground" as string]: theme.onAccent }}
        >
            <Tracker slug={slug} name={restaurant ? "menu_view" : "shop_view"} />
            <CatalogHeader slug={slug} name={profile.displayName} logoUrl={logo} label={catalogLabel(profile.roleTemplate)} whatsapp={profile.whatsapp} />

            <main className="mx-auto max-w-2xl px-4 py-5 pb-10">
                <ShopCatalog
                    slug={slug}
                    shopName={profile.displayName}
                    currency={currency}
                    accent={theme.mid || theme.accent}
                    whatsapp={profile.whatsapp}
                    upiId={profile.upiId}
                    restaurant={restaurant}
                    hours={restaurant ? hoursToday(profile.availability) : null}
                    bookHref={restaurant ? `/${slug}/reserve` : null}
                    items={profile.digitalProducts.map((p) => ({
                        id: p.id,
                        title: p.title,
                        type: p.type,
                        thumbnailUrl: p.thumbnailUrl || parseGallery(p.galleryUrls)[0] || null,
                        priceCents: p.priceCents,
                        fulfillment: p.fulfillment,
                        stock: p.stock,
                        category: p.category,
                        diet: (p as { diet?: string | null }).diet,
                        spiceLevel: (p as { spiceLevel?: number | null }).spiceLevel,
                        ar: Boolean((p as { arModelUrl?: string | null }).arModelUrl),
                    }))}
                />
            </main>
        </div>
    )
}
