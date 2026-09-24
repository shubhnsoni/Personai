import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    JEWELRY_DISCOVERY_ALIAS_MAP,
    JEWELRY_DISCOVERY_ALIASES,
    JEWELRY_DISCOVERY_REQUIRED_ALIASES,
    JEWELRY_SHOWCASE,
    isJewelryDiscoveryAlias,
    isJewelryDiscoveryShowcaseSlug,
    jewelryDiscoveryDestinationForPath,
    jewelryDiscoveryDestinationSlug,
    jewelryDiscoveryRedirects,
} from "@/lib/metal/discovery-aliases"

const root = join(__dirname, "..")

describe("JEWELRY P0-1 discovery aliases", () => {
    it("maps required try-jewellery / try-jewelry to MK Jewellers showcase", () => {
        expect(JEWELRY_SHOWCASE.jewellery).toBe("mk-jewellers")
        expect(JEWELRY_SHOWCASE.jewelry).toBe("mk-jewellers")
        expect(JEWELRY_SHOWCASE.gold).toBe("mk-jewellers")
        expect(JEWELRY_SHOWCASE.jeweller).toBe("mk-jewellers")
        expect(JEWELRY_SHOWCASE.jeweler).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP["try-jewellery"]).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP["try-jewelry"]).toBe("mk-jewellers")
        expect([...JEWELRY_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-jewellery",
            "try-jewelry",
        ])
    })

    it("includes prefer try-gold / try-jeweller / try-jeweler + shorts /jewellery /jewelry /jeweller", () => {
        expect(JEWELRY_DISCOVERY_ALIAS_MAP["try-gold"]).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP["try-jeweller"]).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP["try-jeweler"]).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP.jewellery).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP.jewelry).toBe("mk-jewellers")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP.jeweller).toBe("mk-jewellers")
        // do not ship short /gold (too generic)
        expect(JEWELRY_DISCOVERY_ALIAS_MAP).not.toHaveProperty("gold")
        // TRY_KITS create slugs stay with kit ensure - do not claim them
        expect(JEWELRY_DISCOVERY_ALIAS_MAP).not.toHaveProperty("try-jewelry-retail")
        expect(JEWELRY_DISCOVERY_ALIAS_MAP).not.toHaveProperty("try-gold-wholesale")
        // SHOP / Armonia décor owns try-shop
        expect(JEWELRY_DISCOVERY_ALIAS_MAP).not.toHaveProperty("try-shop")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isJewelryDiscoveryAlias("try-jewellery")).toBe(true)
        expect(isJewelryDiscoveryAlias("try-jewelry")).toBe(true)
        expect(isJewelryDiscoveryAlias("try-gold")).toBe(true)
        expect(isJewelryDiscoveryAlias("try-jeweller")).toBe(true)
        expect(isJewelryDiscoveryAlias("try-jeweler")).toBe(true)
        expect(isJewelryDiscoveryAlias("jewellery")).toBe(true)
        expect(isJewelryDiscoveryAlias("jewelry")).toBe(true)
        expect(isJewelryDiscoveryAlias("jeweller")).toBe(true)
        expect(isJewelryDiscoveryAlias("mk-jewellers")).toBe(false)
        expect(isJewelryDiscoveryAlias("try-shop")).toBe(false)
        expect(isJewelryDiscoveryAlias("try-grocery")).toBe(false)
        expect(isJewelryDiscoveryAlias("try-recruit")).toBe(false)
        expect(isJewelryDiscoveryAlias("try-jewelry-retail")).toBe(false)
        expect(isJewelryDiscoveryAlias(null)).toBe(false)
        expect(isJewelryDiscoveryShowcaseSlug("mk-jewellers")).toBe(true)
        expect(isJewelryDiscoveryShowcaseSlug("try-jewellery")).toBe(false)
        expect(jewelryDiscoveryDestinationSlug("try-jewellery")).toBe(
            "mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationSlug("try-jewelry")).toBe(
            "mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationSlug("try-shop")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(jewelryDiscoveryDestinationForPath("/try-jewellery")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/try-jewellery/")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/try-jewellery/menu")).toBe(
            "/mk-jewellers/menu",
        )
        expect(jewelryDiscoveryDestinationForPath("/try-jewelry")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/try-gold")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/try-jeweller")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/try-jeweler")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/jewellery")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/jewelry")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/jeweller")).toBe(
            "/mk-jewellers",
        )
        expect(jewelryDiscoveryDestinationForPath("/mk-jewellers")).toBeNull()
        expect(jewelryDiscoveryDestinationForPath("/try-shop")).toBeNull()
        expect(jewelryDiscoveryDestinationForPath("/try-grocery")).toBeNull()
        expect(
            jewelryDiscoveryDestinationForPath("/try-jewelry-retail"),
        ).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = jewelryDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(JEWELRY_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-jewellery",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/try-jewellery/:path*",
                    destination: "/mk-jewellers/:path*",
                    permanent: false,
                },
                {
                    source: "/try-jewelry",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/try-gold",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/try-jeweller",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/try-jeweler",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/jewellery",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/jewelry",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
                {
                    source: "/jeweller",
                    destination: "/mk-jewellers",
                    permanent: false,
                },
            ]),
        )
        for (const alias of JEWELRY_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some(
                    (r) =>
                        r.source === `/${alias}` &&
                        r.destination === "/mk-jewellers",
                ),
            ).toBe(true)
        }
    })

    it("next.config.mjs ships JEWELRY P0-1 redirects and keeps try-shop as Armonia", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/JEWELRY P0-1 discovery aliases/)
        for (const row of jewelryDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        // try-jewellery must NOT soft-route to try-shop / Armonia
        expect(src).not.toMatch(
            /source:\s*"\/try-jewellery"[^}]*destination:\s*"\/try-shop"/,
        )
        expect(src).toContain('source: "/try-jewellery"')
        expect(src).toContain('destination: "/mk-jewellers"')
        // try-shop stays SHOP / décor showcase
        expect(src).toContain('source: "/try-grocery"')
        expect(src).toContain('destination: "/try-shop"')
        expect(src).toContain('source: "/try-retail"')
        expect(src).toContain('destination: "/try-shop"')
        // other verticals intact
        expect(src).toContain('source: "/try-recruit"')
        expect(src).toContain('destination: "/nita-recruiters-ashok-nagar"')
        expect(src).toContain('source: "/try-plumber"')
        expect(src).toContain('destination: "/goodwill-plumbing"')
        // kit create slugs not claimed
        expect(src).not.toMatch(/source: "\/try-jewelry-retail"/)
        expect(src).not.toMatch(/source: "\/try-gold-wholesale"/)
    })

    it("discovery module stays redirect-only (no menu / imagery / chat)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/metal/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book a session|shop-product-imagery|kit-copy|menu-chrome|Founder/,
        )
        expect(discovery).toMatch(/JEWELRY_RETAIL P0-1/)
        expect(discovery).toMatch(/mk-jewellers/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("JEWELRY P0-1")
        expect(cfg).toContain("RECRUIT P1-1")
        expect(cfg).toContain("FIELD P1-1")
        expect(cfg).toContain("P1-2 SHOP marketing aliases")
    })
})
