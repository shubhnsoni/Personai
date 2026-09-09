import { describe, expect, it, vi } from "vitest"
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match"
import nextConfig from "../next.config.mjs"
import { isIndexableProfileSlug, MARKETING_ROUTES, marketingMetadata, marketingOrigin, marketingStructuredData } from "@/lib/marketing-seo"
import { isReservedSlug } from "@/lib/slugs"
import { usernameError } from "@/lib/username"
import { subdomainRoute } from "@/lib/subdomain-host"
import robots from "@/app/robots"

const db = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { findMany: db.findMany } } }))
import sitemap from "@/app/sitemap"

describe("marketing metadata and indexing", () => {
    it("uses a clean configured origin and falls back to the real site without credentials", () => {
        expect(marketingOrigin("https://example.test/nested?utm_source=test#section")).toBe("https://example.test")
        expect(marketingOrigin("http://localhost:3000/")).toBe("http://localhost:3000")
        expect(marketingOrigin("not-a-url")).toBe("https://introify.com")
        expect(marketingOrigin("https://fake:secret@example.test")).toBe("https://introify.com")
    })

    it("gives pages their own canonical and sharing URL, with no indexing for drafts", () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test/")
        for (const route of MARKETING_ROUTES) {
            const metadata = marketingMetadata({ title: "Page", description: "Page description", path: route.path })
            const expectedUrl = new URL(route.path, "https://example.test").href
            expect(metadata.alternates?.canonical).toBe(expectedUrl)
            expect(metadata.openGraph?.url).toBe(expectedUrl)
            expect(metadata.robots).toEqual({ index: route.index, follow: true })
        }
        expect(MARKETING_ROUTES.filter((route) => route.index).map((route) => route.path)).toEqual(["/", "/pricing"])
        expect(MARKETING_ROUTES.filter((route) => !route.index)).toHaveLength(9)
        expect(() => marketingMetadata({ title: "Unsafe", description: "", path: "//foreign.example.test" })).toThrow()
    })

    it("reserves each new marketing route in both slug validation paths", () => {
        for (const route of MARKETING_ROUTES.filter((route) => route.path !== "/")) {
            const slug = route.path.slice(1)
            expect(isReservedSlug(slug)).toBe(true)
            expect(usernameError(slug)).toMatch(/reserved/)
            expect(isIndexableProfileSlug(slug)).toBe(false)
        }
        expect(usernameError("ada-lovelace")).toBeNull()
        expect(isIndexableProfileSlug("ada-lovelace")).toBe(true)
    })

    it("publishes only the brand and website identity in structured data", () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test")
        expect(marketingStructuredData()).toEqual({
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "Organization", "@id": "https://example.test/#organization", name: "Introify", url: "https://example.test" },
                { "@type": "WebSite", "@id": "https://example.test/#website", name: "Introify", url: "https://example.test", publisher: { "@id": "https://example.test/#organization" } },
            ],
        })
    })

    it("serves global marketing and SEO routes on profile subdomains without rewriting tenant pages", () => {
        const paths = [...MARKETING_ROUTES.filter((route) => route.path !== "/").map((route) => route.path), "/robots.txt", "/sitemap.xml", "/opengraph-image", "/twitter-image"]
        for (const path of paths) {
            expect(subdomainRoute(path, "ada"), path).toEqual({ type: "skip" })
            expect(subdomainRoute(`${path}/`, "ada"), path).toEqual({ type: "skip" })
        }
        expect(subdomainRoute("/", "ada")).toEqual({ type: "rewrite", pathname: "/ada" })
        expect(subdomainRoute("/courses", "ada")).toEqual({ type: "rewrite", pathname: "/ada/courses" })
        expect(subdomainRoute("/shop/product", "ada")).toEqual({ type: "rewrite", pathname: "/ada/shop/product" })
        expect(subdomainRoute("/about-coaching", "ada")).toEqual({ type: "rewrite", pathname: "/ada/about-coaching" })
    })

    it("includes only indexable marketing pages and published profile URLs in the sitemap", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test")
        const updatedAt = new Date("2026-09-01T10:00:00Z")
        db.findMany.mockResolvedValue([
            { slug: "ada-lovelace", updatedAt },
            { slug: "try-consultant", updatedAt },
            { slug: "demo", updatedAt },
            { slug: "privacy", updatedAt },
            { slug: "admin", updatedAt },
        ])
        expect(await sitemap()).toEqual([
            { url: "https://example.test/" },
            { url: "https://example.test/pricing" },
            { url: "https://example.test/ada-lovelace", lastModified: updatedAt },
        ])
        expect(db.findMany).toHaveBeenCalledWith({ where: { isPublic: true }, select: { slug: true, updatedAt: true } })
    })

    it("applies noindex to private route roots and descendants without matching public lookalikes", async () => {
        const rules = (await nextConfig.headers!()).filter((rule) => rule.headers.some((header) => header.key === "X-Robots-Tag"))
        const noindex = (path: string) => rules.some((rule) => getPathMatch(rule.source)(path))
        for (const path of ["/dashboard", "/dashboard/profile", "/admin", "/qa", "/onboarding", "/library", "/library/login", "/sign-in", "/sign-up", "/api/chat", "/o/order-token", "/l/tracking-token", "/ada/lift/parcel-token"]) {
            expect(noindex(path), path).toBe(true)
        }
        for (const path of ["/", "/about", "/privacy", "/ada", "/dashboard-coach", "/admin-assistant", "/library-books"]) {
            expect(noindex(path), path).toBe(false)
        }
        expect(rules.every((rule) => rule.headers.some((header) => header.value === "noindex, nofollow"))).toBe(true)
        // Crawlable HTML lets Google consume noindex. Auth still protects data.
        expect(robots().rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api$", "/api/"] }])
    })
})
