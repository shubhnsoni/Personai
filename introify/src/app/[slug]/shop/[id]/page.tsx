import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { parseGallery, parseVariants, whatsappHref } from "@/lib/commerce"
import { extraDetailPhotos, parsePdpDisplay } from "@/lib/shop/pdp-display"
import type { PdpRailItem } from "@/components/shop/pdp-light"
import { catalogLabel, dietLabel, isRestaurant, serveLabel } from "@/lib/menu"
import { formatStoredPrice } from "@/lib/pricing"
import { getRequestCurrency } from "@/lib/request-currency"
import { extrasOf } from "@/lib/surfaces"
import {
    bpsToKarat,
    formatInrPaise,
    isJewelryRetail,
    isJewelryWholesale,
    metalPaise,
    mgToGrams,
    ticketPaise,
} from "@/lib/metal/math"
import { touchPercent } from "@/lib/metal/touch"
import { goldBoardFromConfig } from "@/lib/metal/board"
import { parseProductMetal } from "@/lib/metal/product"
import { isExpiredMedicine, isPharmacy, isRxRequired } from "@/lib/pharmacy/batch"
import { GoldRateStrip } from "@/components/shop/gold-rate-strip"
import { PdpLight } from "@/components/shop/pdp-light"
import { Tracker } from "@/components/profile/tracker"
import { SessionProbe } from "@/components/profile/session-probe"
import { buildPdpContent, pdpQuotes, pdpRating } from "@/lib/shop/pdp-content"
import type { CheckoutItem } from "@/components/checkout/checkout-sheet"
import type { PdpBuyAction } from "@/components/shop/pdp-buy"

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
    if (isPharmacy(product.profile.roleTemplate) && isExpiredMedicine(product.variantsJson)) notFound()

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
    const pharmacy = isPharmacy(product.profile.roleTemplate)
    const photos = parseGallery(product.galleryUrls, product.thumbnailUrl)
    const variants = parseVariants(product.variantsJson)
    const extras = extrasOf(product.profile.personalityConfig)
    const menuOrder = restaurant || extras.packs?.includes("menuDish") === true
    const diet = (product as { diet?: string | null }).diet
    const spice = (product as { spiceLevel?: number | null }).spiceLevel
    const serve = serveLabel((product as { serveWindow?: string | null }).serveWindow)
    const arGlb = (product as { arModelUrl?: string | null }).arModelUrl
    const arUsdz = (product as { arUsdzUrl?: string | null }).arUsdzUrl
    const jewelry = isJewelryRetail(product.profile.roleTemplate)
    const wholesale = isJewelryWholesale(product.profile.roleTemplate)
    const board = goldBoardFromConfig(product.profile.personalityConfig)
    const metal = jewelry || wholesale ? parseProductMetal(product.variantsJson) : null
    const metalValue = metal && board ? metalPaise(metal.grossMg, metal.purityBps, board) : 0
    const ticket = metal && board ? ticketPaise(metal, board) : product.priceCents
    const soldOut = product.stock != null && product.stock <= 0
    const priceLabel = wholesale
        ? "On bill"
        : jewelry
            ? formatInrPaise(ticket)
            : formatStoredPrice(product.priceCents, product.currency, currency)
    const compareAtLabel =
        !jewelry && !wholesale && product.compareAtCents && product.compareAtCents > product.priceCents
            ? formatStoredPrice(product.compareAtCents, product.currency, currency)
            : null
    const stockLabel =
        product.stock == null
            ? null
            : soldOut
                ? "Sold out"
                : `${product.stock} in stock`
    const content = buildPdpContent({
        title: product.title,
        shopName: product.profile.displayName,
        category: product.category,
        fulfillment: product.fulfillment,
        type: product.type,
        body: product.body || product.description,
        highlights,
        pharmacy,
        sku: product.sku,
        diet: dietLabel(diet),
        serve,
    })
    const quotes = pdpQuotes(reviewRows, content.sampleQuotes)
    const rating = pdpRating(reviewRows, content.sampleQuotes.length ? 12 : null)
    const checkoutItem: CheckoutItem = {
        itemType: "product",
        itemId: product.id,
        title: product.title,
        priceCents: jewelry ? ticket : product.priceCents,
        currency: jewelry ? "INR" : product.currency,
        description: product.description,
        fulfillment: product.fulfillment,
        allowCod: product.allowCod,
        upiId: product.profile.upiId,
        whatsapp: product.profile.whatsapp,
        shipMode: product.shipMode,
        shipFeeCents: product.shipFeeCents,
        gstin: product.profile.gstin,
        soldOut,
        variants: variants.map((v) => v.name),
        requiresRx: isRxRequired(product.variantsJson),
    }
    const wa = whatsappHref(product.profile.whatsapp, `Hi ${product.profile.displayName}, asking about ${product.title}`)
    const buy: PdpBuyAction = menuOrder
        ? { label: "Add on the menu", href: `/${slug}/menu?item=${product.id}` }
        : wholesale
            ? { label: "Ask on WhatsApp", href: wa || `/${slug}`, external: Boolean(wa) }
            : {
                label: soldOut ? "Sold out" : product.priceCents === 0 && !jewelry ? "Get free" : `Order · ${priceLabel}`,
                item: checkoutItem,
            }
    const display = parsePdpDisplay(product.variantsJson)
    const extraPhotos = extraDetailPhotos(photos)
    const related = display.showRelated
        ? await loadRelated(product.profileId, product.id, product.category, slug, currency).catch(() => [])
        : []
    const bestsellers = display.showBestsellers
        ? await loadBestsellers(product.profileId, product.id, slug, currency).catch(() => [])
        : []
    const extraLine = metal && board
        ? wholesale
            ? `${mgToGrams(metal.grossMg)} g · ${touchPercent(metal.purityBps)} touch · billed on 24K`
            : `${mgToGrams(metal.grossMg)} g · ${bpsToKarat(metal.purityBps) || `${metal.purityBps / 100}%`} · metal ${formatInrPaise(metalValue)}${metal.makingPaise > 0 ? ` · making ${formatInrPaise(metal.makingPaise)}` : ""}`
        : spice
            ? `Spice ${"🌶".repeat(spice)}`
            : null

    return (
        <>
        <Tracker slug={slug} name="pdp_view" />
        <SessionProbe slug={slug} />
        <PdpLight
            slug={slug}
            shopName={product.profile.displayName}
            catalogLabel={catalogLabel(product.profile.roleTemplate)}
            logoUrl={logo}
            title={product.title}
            content={content}
            photos={photos}
            priceLabel={priceLabel}
            compareAtLabel={compareAtLabel}
            stockLabel={stockLabel}
            inStock={!soldOut}
            ratingAvg={rating?.avg ?? null}
            ratingCount={rating?.count ?? null}
            quotes={quotes}
            productId={product.id}
            buy={buy}
            extraLine={extraLine}
            extraHref={arGlb || arUsdz ? `/${slug}/ar?item=${product.id}` : restaurant ? `/${slug}/reserve` : null}
            extraHrefLabel={
                arGlb || arUsdz
                    ? restaurant
                        ? "View on table"
                        : "View in your space"
                    : restaurant
                        ? "Reserve a table"
                        : null
            }
            showMore={display.showMore && extraPhotos.length > 0}
            related={related}
            bestsellers={bestsellers}
            notice={
                jewelry || wholesale ? <GoldRateStrip board={board} wholesale={wholesale} tone="light" surface="pdp" /> : null
            }
        />
        </>
    )
}

async function asRailItems(
    rows: { id: string; title: string; thumbnailUrl: string | null; galleryUrls: string | null; priceCents: number; currency: string }[],
    slug: string,
    displayCurrency: Awaited<ReturnType<typeof getRequestCurrency>>,
): Promise<PdpRailItem[]> {
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        href: `/${slug}/shop/${row.id}`,
        photo: parseGallery(row.galleryUrls, row.thumbnailUrl)[0] || null,
        priceLabel: formatStoredPrice(row.priceCents, row.currency, displayCurrency),
    }))
}

async function loadRelated(
    profileId: string,
    productId: string,
    category: string | null,
    slug: string,
    currency: Awaited<ReturnType<typeof getRequestCurrency>>,
) {
    const cat = category?.trim()
    if (!cat) return []
    const rows = await prisma.digitalProduct.findMany({
        where: { profileId, isActive: true, category: cat, id: { not: productId } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true, priceCents: true, currency: true },
    })
    return asRailItems(rows, slug, currency)
}

async function loadBestsellers(
    profileId: string,
    productId: string,
    slug: string,
    currency: Awaited<ReturnType<typeof getRequestCurrency>>,
) {
    const lines = await prisma.orderLine.groupBy({
        by: ["productId"],
        where: {
            productId: { not: null },
            product: { profileId, isActive: true, id: { not: productId } },
        },
        _sum: { qty: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 8,
    })
    const ids = lines.map((row) => row.productId).filter((id): id is string => Boolean(id))
    if (!ids.length) {
        const purchases = await prisma.productPurchase.groupBy({
            by: ["productId"],
            where: {
                status: "COMPLETED",
                product: { profileId, isActive: true, id: { not: productId } },
            },
            _count: { productId: true },
            orderBy: { _count: { productId: "desc" } },
            take: 8,
        })
        const bought = purchases.map((row) => row.productId)
        if (!bought.length) return []
        const rows = await prisma.digitalProduct.findMany({
            where: { id: { in: bought } },
            select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true, priceCents: true, currency: true },
        })
        const rank = new Map(bought.map((id, i) => [id, i]))
        rows.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
        return asRailItems(rows, slug, currency)
    }
    const rows = await prisma.digitalProduct.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true, priceCents: true, currency: true },
    })
    const rank = new Map(ids.map((id, i) => [id, i]))
    rows.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
    return asRailItems(rows, slug, currency)
}
