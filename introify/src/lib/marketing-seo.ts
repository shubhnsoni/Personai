import type { Metadata } from "next"
import { isReservedSlug } from "./slugs"

export const BRAND_NAME = "Introify"
export const BRAND_DESCRIPTION = "Create one page for your profile, services, products and bookings. Start free with Introify and explore plans with AI credits, 3D generations and room for your team."

// Draft pages stay out of search and the sitemap until their public details
// and policies are ready. Page metadata and the sitemap use the same registry.
export const MARKETING_ROUTES = [
    { path: "/", index: true },
    { path: "/about", index: false },
    { path: "/contact", index: false },
    { path: "/pricing", index: true },
    { path: "/privacy", index: false },
    { path: "/terms", index: false },
    { path: "/refund-policy", index: false },
    { path: "/delivery-policy", index: false },
    { path: "/cookie-policy", index: false },
    { path: "/acceptable-use", index: false },
    { path: "/sms-policy", index: false },
] as const

export function marketingOrigin(value = process.env.NEXT_PUBLIC_APP_URL): string {
    try {
        const url = new URL(value || "https://introify.com")
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error()
        return url.origin
    } catch {
        return "https://introify.com"
    }
}

export function marketingMetadata({ title, description, path, index }: {
    title: string
    description: string
    path: string
    index?: boolean
}): Metadata {
    const origin = marketingOrigin()
    if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path)) {
        throw new Error("Marketing metadata requires an absolute site path without query parameters.")
    }
    const canonical = new URL(path, origin).href
    const canIndex = index ?? MARKETING_ROUTES.find((route) => route.path === path)?.index ?? false
    const pageTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`
    return {
        title: { absolute: pageTitle },
        description,
        alternates: { canonical },
        robots: { index: canIndex, follow: true },
        openGraph: {
            type: "website",
            siteName: BRAND_NAME,
            title: pageTitle,
            description,
            url: canonical,
            images: [{ url: `${origin}/opengraph-image`, width: 1200, height: 630, alt: `${BRAND_NAME} — your work in one link` }],
        },
        twitter: {
            card: "summary_large_image",
            title: pageTitle,
            description,
            images: [`${origin}/opengraph-image`],
        },
    }
}

export function marketingStructuredData() {
    const origin = marketingOrigin()
    return {
        "@context": "https://schema.org",
        "@graph": [
            { "@type": "Organization", "@id": `${origin}/#organization`, name: BRAND_NAME, url: origin },
            {
                "@type": "WebSite",
                "@id": `${origin}/#website`,
                name: BRAND_NAME,
                url: origin,
                publisher: { "@id": `${origin}/#organization` },
            },
        ],
    }
}

export function isIndexableProfileSlug(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
        && !isReservedSlug(slug)
        && slug !== "demo"
        && !slug.startsWith("try-")
}
