import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    REALESTATE_DISCOVERY_ALIAS_MAP,
    REALESTATE_DISCOVERY_ALIASES,
    REALESTATE_DISCOVERY_REQUIRED_ALIASES,
    REALESTATE_SHOWCASE,
    isRealestateDiscoveryAlias,
    isRealestateDiscoveryShowcaseSlug,
    realestateDiscoveryDestinationForPath,
    realestateDiscoveryDestinationSlug,
    realestateDiscoveryRedirects,
} from "@/lib/realestate/discovery-aliases"

const root = join(__dirname, "..")

describe("REALESTATE P1-2 discovery aliases", () => {
    it("maps required try-* aliases to Shakti Property Lalpur showcase", () => {
        expect(REALESTATE_SHOWCASE.brokerage).toBe("shakti-property-lalpur")
        expect(REALESTATE_SHOWCASE.realtor).toBe("shakti-property-lalpur")
        expect(REALESTATE_SHOWCASE.property).toBe("shakti-property-lalpur")
        expect(REALESTATE_DISCOVERY_ALIAS_MAP["try-real-estate"]).toBe(
            "shakti-property-lalpur",
        )
        expect(REALESTATE_DISCOVERY_ALIAS_MAP["try-realtor"]).toBe(
            "shakti-property-lalpur",
        )
        expect(REALESTATE_DISCOVERY_ALIAS_MAP["try-property"]).toBe(
            "shakti-property-lalpur",
        )
        expect([...REALESTATE_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-real-estate",
            "try-realtor",
            "try-property",
        ])
    })

    it("includes prefer try-broker / try-homes + shorts /realtor /property /broker /realestate", () => {
        expect(REALESTATE_DISCOVERY_ALIAS_MAP["try-broker"]).toBe(
            "shakti-property-lalpur",
        )
        expect(REALESTATE_DISCOVERY_ALIAS_MAP["try-homes"]).toBe(
            "shakti-property-lalpur",
        )
        expect(REALESTATE_DISCOVERY_ALIAS_MAP.realtor).toBe("shakti-property-lalpur")
        expect(REALESTATE_DISCOVERY_ALIAS_MAP.property).toBe("shakti-property-lalpur")
        expect(REALESTATE_DISCOVERY_ALIAS_MAP.broker).toBe("shakti-property-lalpur")
        expect(REALESTATE_DISCOVERY_ALIAS_MAP.realestate).toBe(
            "shakti-property-lalpur",
        )
        // do not ship short /homes (too generic; try-homes is enough)
        expect(REALESTATE_DISCOVERY_ALIAS_MAP).not.toHaveProperty("homes")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isRealestateDiscoveryAlias("try-real-estate")).toBe(true)
        expect(isRealestateDiscoveryAlias("try-realtor")).toBe(true)
        expect(isRealestateDiscoveryAlias("try-property")).toBe(true)
        expect(isRealestateDiscoveryAlias("try-broker")).toBe(true)
        expect(isRealestateDiscoveryAlias("try-homes")).toBe(true)
        expect(isRealestateDiscoveryAlias("realtor")).toBe(true)
        expect(isRealestateDiscoveryAlias("property")).toBe(true)
        expect(isRealestateDiscoveryAlias("broker")).toBe(true)
        expect(isRealestateDiscoveryAlias("realestate")).toBe(true)
        expect(isRealestateDiscoveryAlias("shakti-property-lalpur")).toBe(false)
        expect(isRealestateDiscoveryAlias("try-gym")).toBe(false)
        expect(isRealestateDiscoveryAlias("try-events")).toBe(false)
        expect(isRealestateDiscoveryAlias(null)).toBe(false)
        expect(isRealestateDiscoveryShowcaseSlug("shakti-property-lalpur")).toBe(true)
        expect(isRealestateDiscoveryShowcaseSlug("try-real-estate")).toBe(false)
        expect(realestateDiscoveryDestinationSlug("try-real-estate")).toBe(
            "shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationSlug("try-realtor")).toBe(
            "shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationSlug("try-gym")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(realestateDiscoveryDestinationForPath("/try-real-estate")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/try-real-estate/")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/try-real-estate/book")).toBe(
            "/shakti-property-lalpur/book",
        )
        expect(realestateDiscoveryDestinationForPath("/try-realtor")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/try-property")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/try-property/menu")).toBe(
            "/shakti-property-lalpur/menu",
        )
        expect(realestateDiscoveryDestinationForPath("/try-broker")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/try-homes")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/realtor")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/property")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/broker")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/realestate")).toBe(
            "/shakti-property-lalpur",
        )
        expect(realestateDiscoveryDestinationForPath("/shakti-property-lalpur")).toBeNull()
        expect(realestateDiscoveryDestinationForPath("/try-gym")).toBeNull()
        expect(realestateDiscoveryDestinationForPath("/try-events")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = realestateDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(REALESTATE_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-real-estate",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/try-real-estate/:path*",
                    destination: "/shakti-property-lalpur/:path*",
                    permanent: false,
                },
                {
                    source: "/try-realtor",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/try-property",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/try-broker",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/try-homes",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/realtor",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/property",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/broker",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
                {
                    source: "/realestate",
                    destination: "/shakti-property-lalpur",
                    permanent: false,
                },
            ]),
        )
        for (const alias of REALESTATE_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/")),
            ).toBe(true)
        }
    })

    it("next.config.mjs ships REALESTATE P1-2 redirects and keeps events/gym/clinic", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/REALESTATE P1-2 discovery aliases/)
        for (const row of realestateDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        expect(src).toContain('source: "/try-events"')
        expect(src).toContain('destination: "/next-level-events-kanke"')
        expect(src).toContain('source: "/try-gym"')
        expect(src).toContain('destination: "/aura-fitness-ranchi"')
        expect(src).toContain('source: "/try-clinic"')
        expect(src).toContain('destination: "/jk-sharma-clinic-harmu"')
        expect(src).not.toMatch(/destination: "\/try-real-estate"/)
        expect(src).not.toMatch(/destination: "\/try-realtor"/)
        expect(src).not.toMatch(/destination: "\/try-property"/)
    })

    it("discovery module stays redirect-only (no P1-3 menu or P1-4 imagery edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/realestate/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book a session|shop-product-imagery|kit-copy|menu-chrome|Founder/,
        )
        expect(discovery).toMatch(/REAL_ESTATE_BROKERAGE P1-2/)
        expect(discovery).toMatch(/shakti-property-lalpur/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("CLINIC P1-1")
        expect(cfg).toContain("GYM P1-1")
        expect(cfg).toContain("SALON P1-1")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("EVENTS P1-2")
        expect(cfg).toContain("REALESTATE P1-2")
    })
})
