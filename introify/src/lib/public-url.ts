export type LinkStyle = "PATH" | "SUBDOMAIN"

export function parseLinkStyle(value: string | null | undefined): LinkStyle {
    return value === "SUBDOMAIN" ? "SUBDOMAIN" : "PATH"
}

export function appOrigin(appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") {
    try {
        const url = new URL(appUrl)
        return {
            protocol: url.protocol,
            hostname: url.hostname.replace(/^www\./, ""),
            port: url.port,
        }
    } catch {
        return { protocol: "http:", hostname: "localhost", port: "3000" }
    }
}

export function publicShopUrl(slug: string, style: LinkStyle = "PATH", origin = appOrigin()) {
    const host = origin.port ? `${origin.hostname}:${origin.port}` : origin.hostname
    if (style === "SUBDOMAIN") {
        const subHost = origin.port ? `${slug}.${origin.hostname}:${origin.port}` : `${slug}.${origin.hostname}`
        return `${origin.protocol}//${subHost}`
    }
    return `${origin.protocol}//${host}/${slug}`
}

export function formatShopLink(slug: string, style: LinkStyle = "PATH", origin = appOrigin()) {
    return publicShopUrl(slug, style, origin).replace(/^https?:\/\//, "")
}
