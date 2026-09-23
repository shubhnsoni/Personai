import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    CREATOR_DISCOVERY_ALIAS_MAP,
    CREATOR_DISCOVERY_ALIASES,
    CREATOR_DISCOVERY_REQUIRED_ALIASES,
    CREATOR_SHOWCASE,
    creatorDiscoveryDestinationForPath,
    creatorDiscoveryDestinationSlug,
    creatorDiscoveryRedirects,
    isCreatorDiscoveryAlias,
    isCreatorDiscoveryShowcaseSlug,
} from "@/lib/creator/discovery-aliases"

const root = join(__dirname, "..")

describe("CREATOR P1-1 discovery aliases", () => {
    it("maps required try-* aliases to Tagore / Riley / Leela showcases", () => {
        expect(CREATOR_SHOWCASE.creator).toBe("tagore-hill-press")
        expect(CREATOR_SHOWCASE.consultant).toBe("demo")
        expect(CREATOR_SHOWCASE.coach).toBe("leela-path-lalpur")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-creator"]).toBe("tagore-hill-press")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-consultant"]).toBe("demo")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-coach"]).toBe("leela-path-lalpur")
        expect([...CREATOR_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-creator",
            "try-consultant",
            "try-coach",
        ])
    })

    it("includes preferred short roles + try-professional / try-arjun + studio tries", () => {
        expect(CREATOR_DISCOVERY_ALIAS_MAP.creator).toBe("tagore-hill-press")
        expect(CREATOR_DISCOVERY_ALIAS_MAP.coach).toBe("leela-path-lalpur")
        expect(CREATOR_DISCOVERY_ALIAS_MAP.consultant).toBe("demo")
        expect(CREATOR_DISCOVERY_ALIAS_MAP.professional).toBe("demo")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-professional"]).toBe("demo")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-arjun"]).toBe("tagore-hill-press")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-designer"]).toBe("maya")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-developer"]).toBe("kadru-lab")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-editor"]).toBe("swaroop-production-doranda")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-photographer"]).toBe("lets-click-ratu-road")
        expect(CREATOR_DISCOVERY_ALIAS_MAP["try-ca"]).toBe("singh-raushan-doranda")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isCreatorDiscoveryAlias("try-creator")).toBe(true)
        expect(isCreatorDiscoveryAlias("try-coach")).toBe(true)
        expect(isCreatorDiscoveryAlias("consultant")).toBe(true)
        expect(isCreatorDiscoveryAlias("tagore-hill-press")).toBe(false)
        expect(isCreatorDiscoveryAlias("demo")).toBe(false)
        expect(isCreatorDiscoveryAlias("try-hotel")).toBe(false)
        expect(isCreatorDiscoveryAlias(null)).toBe(false)
        expect(isCreatorDiscoveryShowcaseSlug("tagore-hill-press")).toBe(true)
        expect(isCreatorDiscoveryShowcaseSlug("demo")).toBe(true)
        expect(isCreatorDiscoveryShowcaseSlug("leela-path-lalpur")).toBe(true)
        expect(isCreatorDiscoveryShowcaseSlug("try-creator")).toBe(false)
        expect(creatorDiscoveryDestinationSlug("try-creator")).toBe("tagore-hill-press")
        expect(creatorDiscoveryDestinationSlug("try-hotel")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(creatorDiscoveryDestinationForPath("/try-creator")).toBe("/tagore-hill-press")
        expect(creatorDiscoveryDestinationForPath("/try-creator/")).toBe("/tagore-hill-press")
        expect(creatorDiscoveryDestinationForPath("/try-creator/menu")).toBe(
            "/tagore-hill-press/menu",
        )
        expect(creatorDiscoveryDestinationForPath("/try-consultant")).toBe("/demo")
        expect(creatorDiscoveryDestinationForPath("/try-consultant/book")).toBe("/demo/book")
        expect(creatorDiscoveryDestinationForPath("/try-coach")).toBe("/leela-path-lalpur")
        expect(creatorDiscoveryDestinationForPath("/coach/menu")).toBe("/leela-path-lalpur/menu")
        expect(creatorDiscoveryDestinationForPath("/professional")).toBe("/demo")
        expect(creatorDiscoveryDestinationForPath("/try-arjun/share")).toBe(
            "/tagore-hill-press/share",
        )
        expect(creatorDiscoveryDestinationForPath("/tagore-hill-press")).toBeNull()
        expect(creatorDiscoveryDestinationForPath("/demo")).toBeNull()
        expect(creatorDiscoveryDestinationForPath("/try-hotel")).toBeNull()
        expect(creatorDiscoveryDestinationForPath("/try-shop")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = creatorDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(CREATOR_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                { source: "/try-creator", destination: "/tagore-hill-press", permanent: false },
                {
                    source: "/try-creator/:path*",
                    destination: "/tagore-hill-press/:path*",
                    permanent: false,
                },
                { source: "/try-consultant", destination: "/demo", permanent: false },
                { source: "/try-coach", destination: "/leela-path-lalpur", permanent: false },
                { source: "/creator", destination: "/tagore-hill-press", permanent: false },
                { source: "/coach", destination: "/leela-path-lalpur", permanent: false },
                { source: "/consultant", destination: "/demo", permanent: false },
                { source: "/professional", destination: "/demo", permanent: false },
                { source: "/try-professional", destination: "/demo", permanent: false },
                { source: "/try-arjun", destination: "/tagore-hill-press", permanent: false },
            ]),
        )
        // No soft-404 route: every required alias has a redirect destination
        for (const alias of CREATOR_DISCOVERY_REQUIRED_ALIASES) {
            expect(rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/"))).toBe(
                true,
            )
        }
    })

    it("next.config.mjs ships the creator discovery redirects and keeps shop/hotel", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/CREATOR P1-1 discovery aliases/)
        for (const row of creatorDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        // Preserve prior role loops
        expect(src).toContain('source: "/try-grocery"')
        expect(src).toContain('destination: "/try-shop"')
        expect(src).toContain('source: "/hotel"')
        expect(src).toContain('destination: "/try-hotel"')
        // Do not claim soft-404 destinations as aliases
        expect(src).not.toMatch(/destination: "\/try-creator"/)
    })

    it("discovery module stays redirect-only (no P0-1/P0-2 menu or PDF/currency edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/creator/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(/Import a catalog|shop-product-imagery|catalog-display-currency|digital-cover/)
        expect(discovery).toMatch(/CREATOR P1-1/)
        expect(discovery).toMatch(/tagore-hill-press/)
        expect(discovery).toMatch(/leela-path-lalpur/)
        // next.config must not drop hotel/shop while adding creator
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("HOTEL P1-3")
        expect(cfg).toContain("P1-2 SHOP marketing aliases")
    })
})
