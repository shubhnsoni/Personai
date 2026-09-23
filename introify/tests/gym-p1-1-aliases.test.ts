import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    GYM_DISCOVERY_ALIAS_MAP,
    GYM_DISCOVERY_ALIASES,
    GYM_DISCOVERY_REQUIRED_ALIASES,
    GYM_SHOWCASE,
    gymDiscoveryDestinationForPath,
    gymDiscoveryDestinationSlug,
    gymDiscoveryRedirects,
    isGymDiscoveryAlias,
    isGymDiscoveryShowcaseSlug,
} from "@/lib/gym/discovery-aliases"

const root = join(__dirname, "..")

describe("GYM P1-1 discovery aliases", () => {
    it("maps required try-* aliases to Aura / Natraj showcases", () => {
        expect(GYM_SHOWCASE.gym).toBe("aura-fitness-ranchi")
        expect(GYM_SHOWCASE.fitness).toBe("aura-fitness-ranchi")
        expect(GYM_SHOWCASE.yoga).toBe("natraj-yoga-kutchery")
        expect(GYM_DISCOVERY_ALIAS_MAP["try-gym"]).toBe("aura-fitness-ranchi")
        expect(GYM_DISCOVERY_ALIAS_MAP["try-fitness"]).toBe("aura-fitness-ranchi")
        expect(GYM_DISCOVERY_ALIAS_MAP["try-yoga"]).toBe("natraj-yoga-kutchery")
        expect([...GYM_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-gym",
            "try-yoga",
            "try-fitness",
        ])
    })

    it("includes preferred short roles /gym /yoga", () => {
        expect(GYM_DISCOVERY_ALIAS_MAP.gym).toBe("aura-fitness-ranchi")
        expect(GYM_DISCOVERY_ALIAS_MAP.yoga).toBe("natraj-yoga-kutchery")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isGymDiscoveryAlias("try-gym")).toBe(true)
        expect(isGymDiscoveryAlias("try-yoga")).toBe(true)
        expect(isGymDiscoveryAlias("try-fitness")).toBe(true)
        expect(isGymDiscoveryAlias("gym")).toBe(true)
        expect(isGymDiscoveryAlias("yoga")).toBe(true)
        expect(isGymDiscoveryAlias("aura-fitness-ranchi")).toBe(false)
        expect(isGymDiscoveryAlias("natraj-yoga-kutchery")).toBe(false)
        expect(isGymDiscoveryAlias("try-salon")).toBe(false)
        expect(isGymDiscoveryAlias("try-creator")).toBe(false)
        expect(isGymDiscoveryAlias(null)).toBe(false)
        expect(isGymDiscoveryShowcaseSlug("aura-fitness-ranchi")).toBe(true)
        expect(isGymDiscoveryShowcaseSlug("natraj-yoga-kutchery")).toBe(true)
        expect(isGymDiscoveryShowcaseSlug("try-gym")).toBe(false)
        expect(gymDiscoveryDestinationSlug("try-gym")).toBe("aura-fitness-ranchi")
        expect(gymDiscoveryDestinationSlug("try-salon")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(gymDiscoveryDestinationForPath("/try-gym")).toBe("/aura-fitness-ranchi")
        expect(gymDiscoveryDestinationForPath("/try-gym/")).toBe("/aura-fitness-ranchi")
        expect(gymDiscoveryDestinationForPath("/try-gym/book")).toBe(
            "/aura-fitness-ranchi/book",
        )
        expect(gymDiscoveryDestinationForPath("/try-fitness")).toBe("/aura-fitness-ranchi")
        expect(gymDiscoveryDestinationForPath("/try-fitness/menu")).toBe(
            "/aura-fitness-ranchi/menu",
        )
        expect(gymDiscoveryDestinationForPath("/try-yoga")).toBe("/natraj-yoga-kutchery")
        expect(gymDiscoveryDestinationForPath("/yoga/book")).toBe(
            "/natraj-yoga-kutchery/book",
        )
        expect(gymDiscoveryDestinationForPath("/gym")).toBe("/aura-fitness-ranchi")
        expect(gymDiscoveryDestinationForPath("/yoga")).toBe("/natraj-yoga-kutchery")
        expect(gymDiscoveryDestinationForPath("/aura-fitness-ranchi")).toBeNull()
        expect(gymDiscoveryDestinationForPath("/natraj-yoga-kutchery")).toBeNull()
        expect(gymDiscoveryDestinationForPath("/try-salon")).toBeNull()
        expect(gymDiscoveryDestinationForPath("/try-creator")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = gymDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(GYM_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                { source: "/try-gym", destination: "/aura-fitness-ranchi", permanent: false },
                {
                    source: "/try-gym/:path*",
                    destination: "/aura-fitness-ranchi/:path*",
                    permanent: false,
                },
                { source: "/try-yoga", destination: "/natraj-yoga-kutchery", permanent: false },
                {
                    source: "/try-yoga/:path*",
                    destination: "/natraj-yoga-kutchery/:path*",
                    permanent: false,
                },
                { source: "/try-fitness", destination: "/aura-fitness-ranchi", permanent: false },
                { source: "/gym", destination: "/aura-fitness-ranchi", permanent: false },
                { source: "/yoga", destination: "/natraj-yoga-kutchery", permanent: false },
            ]),
        )
        for (const alias of GYM_DISCOVERY_REQUIRED_ALIASES) {
            expect(rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/"))).toBe(
                true,
            )
        }
    })

    it("next.config.mjs ships the gym discovery redirects and keeps salon/creator/shop/hotel", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/GYM P1-1 discovery aliases/)
        for (const row of gymDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        expect(src).toContain('source: "/try-salon"')
        expect(src).toContain('destination: "/h-square-salon-harmu"')
        expect(src).toContain('source: "/try-creator"')
        expect(src).toContain('destination: "/tagore-hill-press"')
        expect(src).toContain('source: "/try-grocery"')
        expect(src).toContain('destination: "/try-shop"')
        expect(src).toContain('source: "/hotel"')
        expect(src).toContain('destination: "/try-hotel"')
        expect(src).not.toMatch(/destination: "\/try-gym"/)
    })

    it("discovery module stays redirect-only (no P0-1 copy or P1-2 imagery edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/gym/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(/Book a treatment|Book a session|shop-product-imagery|kit-copy/)
        expect(discovery).toMatch(/GYM P1-1/)
        expect(discovery).toMatch(/aura-fitness-ranchi/)
        expect(discovery).toMatch(/natraj-yoga-kutchery/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("HOTEL P1-3")
        expect(cfg).toContain("P1-2 SHOP marketing aliases")
        expect(cfg).toContain("SALON P1-1")
    })
})
