import { existsSync } from "node:fs"
import path from "node:path"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getRequestCurrency } from "@/lib/request-currency"
import { formatStoredPrice } from "@/lib/pricing"
import { isRestaurant, readyLabel, serveLabel } from "@/lib/menu"
import { arSizeFor } from "@/lib/ar-scale"
import { ArMenu } from "@/components/shop/ar-menu"

export const dynamic = "force-dynamic"

/**
 * Scene Viewer and Quick Look fetch these files themselves and fail opaquely if
 * one is missing, so only advertise a native AR path when the asset is on disk.
 */
function publicFile(url?: string | null): string | null {
    if (!url || !url.startsWith("/")) return null
    const clean = url.split("?")[0]
    const onDisk = path.join(process.cwd(), "public", clean.replace(/^\//, "").split("/").join(path.sep))
    return existsSync(onDisk) ? clean : null
}

function servedAsset(url?: string | null): string | null {
    return publicFile(url)
}

/** Quick Look will not open a URL that does not end in `.usdz`. */
function servedUsdz(url?: string | null): string | null {
    const file = publicFile(url)
    if (!file || !/\.usdz$/i.test(file)) return null
    return file
}

export default async function ArMenuPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ item?: string }>
}) {
    const { slug } = await params
    const query = await searchParams
    const currency = await getRequestCurrency()
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            digitalProducts: {
                where: { isActive: true },
                orderBy: { createdAt: "asc" },
                // real ratings, rather than deriving a number from sales the way
                // the shop listing does
                include: { reviews: { select: { rating: true } } },
            },
        },
    })
    if (!profile || !profile.isPublic) notFound()

    const items = profile.digitalProducts
        .filter((p) => (p as { arModelUrl?: string | null }).arModelUrl)
        .map((p) => {
            const serve = serveLabel((p as { serveWindow?: string | null }).serveWindow)
            const glb = (p as { arModelUrl: string }).arModelUrl
            const reviews = (p as { reviews?: { rating: number }[] }).reviews || []
            const rating = reviews.length
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : null
            return {
                id: p.id,
                title: p.title,
                subtitle: p.subtitle,
                description: p.description,
                priceLabel: formatStoredPrice(p.priceCents, p.currency, currency),
                diet: (p as { diet?: string | null }).diet,
                spiceLevel: (p as { spiceLevel?: number | null }).spiceLevel,
                serve,
                ready: readyLabel(p.category, serve),
                glb,
                // real-scale, plain-glTF twin for Google Scene Viewer
                glbAr: servedAsset(glb.replace(/\.glb$/i, "-sv.glb"))
                    || servedAsset(glb.replace(/\.glb$/i, "-ar.glb")),
                usdz: servedUsdz(glb.replace(/\.glb$/i, ".ql.usdz"))
                    || servedUsdz(glb.replace(/\.glb$/i, ".ar.usdz"))
                    || servedUsdz((p as { arUsdzUrl?: string | null }).arUsdzUrl),
                sizeMeters: arSizeFor(glb),
                rating,
                reviewCount: reviews.length,
                thumbnail: p.thumbnailUrl,
            }
        })

    if (items.length === 0) notFound()

    return (
        <ArMenu
            items={items}
            startId={query.item}
            backHref={isRestaurant(profile.roleTemplate) ? `/${slug}/menu` : `/${slug}/shop`}
        />
    )
}
