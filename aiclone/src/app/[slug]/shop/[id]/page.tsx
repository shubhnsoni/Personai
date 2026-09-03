import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CourseEnrollButton } from "@/components/catalog/enroll-button"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { parseVariants } from "@/lib/commerce"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { formatStoredPrice } from "@/lib/pricing"
import { getRequestCurrency } from "@/lib/request-currency"
import { ReviewForm } from "@/components/shop/review-form"
import { StoryGallery } from "@/components/shop/story-gallery"
import { collectItemPhotos } from "@/lib/item-photos"
import { catalogLabel, dietLabel, isRestaurant, serveLabel } from "@/lib/menu"
import { extrasOf } from "@/lib/surfaces"
import { Camera } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function ProductSalesPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>
}) {
    const { slug, id } = await params
    const currency = await getRequestCurrency()
    const product = await prisma.digitalProduct.findFirst({
        where: { id, isActive: true, profile: { slug, isPublic: true } },
        include: { profile: { include: { animationStyle: true } }, reviews: { orderBy: { createdAt: "desc" }, take: 8 } },
    })
    if (!product) notFound()

    let config: { colors?: string[]; variant?: string } = {}
    try {
        config = product.profile.animationStyle?.config ? JSON.parse(product.profile.animationStyle.config) : {}
    } catch { /* ignore */ }
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const highlights: string[] = (() => {
        try {
            const parsed = product.highlights ? JSON.parse(product.highlights) : []
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    })()
    const logo = (product.profile as { shopLogoUrl?: string | null }).shopLogoUrl
    const reviewRows = product.reviews
    const restaurant = isRestaurant(product.profile.roleTemplate)
    const photos = await collectItemPhotos({
        title: product.title,
        category: product.category,
        galleryUrls: product.galleryUrls,
        thumbnailUrl: product.thumbnailUrl,
        reviews: reviewRows,
        kind: restaurant ? "menu" : "product",
    })
    const variants = parseVariants(product.variantsJson)
    const extras = extrasOf(product.profile.personalityConfig)
    const menuOrder = restaurant || extras.packs?.includes("menuDish") === true
    const diet = (product as { diet?: string | null }).diet
    const spice = (product as { spiceLevel?: number | null }).spiceLevel
    const serve = serveLabel((product as { serveWindow?: string | null }).serveWindow)
    const arGlb = (product as { arModelUrl?: string | null }).arModelUrl
    const arUsdz = (product as { arUsdzUrl?: string | null }).arUsdzUrl

    return (
        <div
            className="dark min-h-dvh bg-zinc-950 text-zinc-100"
            style={{ ["--pl-aurora" as string]: theme.accent, ["--pl-brand-foreground" as string]: theme.onAccent }}
        >
            <CatalogHeader
                slug={slug}
                name={product.profile.displayName}
                logoUrl={logo}
                label={catalogLabel(product.profile.roleTemplate)}
                backHref={restaurant ? `/${slug}/menu` : `/${slug}/shop`}
                whatsapp={product.profile.whatsapp}
            />

            <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-28">
                <StoryGallery photos={photos} title={product.title} />
                {(arGlb || arUsdz) ? (
                    <Link
                        href={`/${slug}/ar?item=${product.id}`}
                        className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-cyan-400 text-sm font-medium text-zinc-950"
                    >
                        <Camera className="h-4 w-4" />
                        {restaurant ? "View on table" : "View in your space"}
                    </Link>
                ) : null}
                <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        {restaurant
                            ? [dietLabel(diet), product.category, serve].filter(Boolean).join(" · ") || "Dish"
                            : `${product.fulfillment === "PHYSICAL" ? "Physical" : product.fulfillment === "BOTH" ? "Physical + digital" : product.type}${product.category ? ` · ${product.category}` : ""}`}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">{product.title}</h1>
                    {product.subtitle && <p className="mt-1 text-zinc-400">{product.subtitle}</p>}
                </div>
                <div className="flex items-end gap-3">
                    <p className="text-3xl font-semibold tabular-nums">
                        {formatStoredPrice(product.priceCents, product.currency, currency)}
                    </p>
                    {product.compareAtCents && product.compareAtCents > product.priceCents && (
                        <p className="pb-1 text-zinc-500 line-through">{formatStoredPrice(product.compareAtCents, product.currency, currency)}</p>
                    )}
                </div>
                {spice ? <p className="text-sm text-zinc-400">Spice {"🌶".repeat(spice)}</p> : null}
                {restaurant ? (
                    <Link href={`/${slug}/reserve`} className="inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium">
                        Reserve a table
                    </Link>
                ) : null}
                {(product.body || product.description) && (
                    <p className="whitespace-pre-wrap text-zinc-300">{product.body || product.description}</p>
                )}
                {highlights.length > 0 && (
                    <ul className="space-y-2 text-sm text-zinc-300">
                        {highlights.map((h) => (
                            <li key={h} className="flex gap-2"><span className="text-emerald-400">✓</span>{h}</li>
                        ))}
                    </ul>
                )}
                {product.stock != null ? (
                    <p className="text-sm text-zinc-400">{product.stock <= 0 ? "Sold out" : product.stock <= 3 ? `${product.stock} left` : `${product.stock} in stock`}</p>
                ) : null}
                <ReviewForm productId={product.id} />
                {reviewRows.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Reviews</p>
                        {reviewRows.map((r) => (
                            <div key={r.id} className="flex gap-3 rounded-2xl border border-white/8 px-3 py-2">
                                {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : null}
                                <div className="min-w-0">
                                    <p className="text-xs text-zinc-400">{r.visitorName} · {"★".repeat(r.rating)}</p>
                                    {r.text ? <p className="mt-1 text-sm text-zinc-200">{r.text}</p> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </main>
            <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="mx-auto max-w-2xl">
                    {menuOrder ? (
                        <Link
                            href={`/${slug}/menu?item=${product.id}`}
                            className="flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-medium text-brand-foreground"
                        >
                            Add on the menu
                        </Link>
                    ) : (
                        <CourseEnrollButton
                            item={{
                                itemType: "product",
                                itemId: product.id,
                                title: product.title,
                                priceCents: product.priceCents,
                                currency: product.currency,
                                description: product.description,
                                fulfillment: product.fulfillment,
                                allowCod: product.allowCod,
                                upiId: product.profile.upiId,
                                whatsapp: product.profile.whatsapp,
                                shipMode: product.shipMode,
                                shipFeeCents: product.shipFeeCents,
                                gstin: product.profile.gstin,
                                soldOut: product.stock != null && product.stock <= 0,
                                variants: variants.map((v) => v.name),
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
