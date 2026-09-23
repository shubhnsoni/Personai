import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    SALON_DISCOVERY_ALIAS_MAP,
    SALON_DISCOVERY_ALIASES,
    SALON_DISCOVERY_REQUIRED_ALIASES,
    SALON_SHOWCASE,
    salonDiscoveryDestinationForPath,
    salonDiscoveryDestinationSlug,
    salonDiscoveryRedirects,
    isSalonDiscoveryAlias,
    isSalonDiscoveryShowcaseSlug,
} from "@/lib/salon/discovery-aliases"

const root = join(__dirname, "..")

describe("SALON P1-1 discovery aliases", () => {
    it("maps required try-* aliases to H Square / Prince showcases", () => {
        expect(SALON_SHOWCASE.salon).toBe("h-square-salon-harmu")
        expect(SALON_SHOWCASE.spa).toBe("h-square-salon-harmu")
        expect(SALON_SHOWCASE.barber).toBe("prince-barber-lalpur")
        expect(SALON_DISCOVERY_ALIAS_MAP["try-salon"]).toBe("h-square-salon-harmu")
        expect(SALON_DISCOVERY_ALIAS_MAP["try-spa"]).toBe("h-square-salon-harmu")
        expect(SALON_DISCOVERY_ALIAS_MAP["try-barber"]).toBe("prince-barber-lalpur")
        expect([...SALON_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-salon",
            "try-barber",
            "try-spa",
        ])
    })

    it("includes preferred short roles /salon /spa /barber", () => {
        expect(SALON_DISCOVERY_ALIAS_MAP.salon).toBe("h-square-salon-harmu")
        expect(SALON_DISCOVERY_ALIAS_MAP.spa).toBe("h-square-salon-harmu")
        expect(SALON_DISCOVERY_ALIAS_MAP.barber).toBe("prince-barber-lalpur")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isSalonDiscoveryAlias("try-salon")).toBe(true)
        expect(isSalonDiscoveryAlias("try-barber")).toBe(true)
        expect(isSalonDiscoveryAlias("try-spa")).toBe(true)
        expect(isSalonDiscoveryAlias("salon")).toBe(true)
        expect(isSalonDiscoveryAlias("h-square-salon-harmu")).toBe(false)
        expect(isSalonDiscoveryAlias("prince-barber-lalpur")).toBe(false)
        expect(isSalonDiscoveryAlias("try-creator")).toBe(false)
        expect(isSalonDiscoveryAlias(null)).toBe(false)
        expect(isSalonDiscoveryShowcaseSlug("h-square-salon-harmu")).toBe(true)
        expect(isSalonDiscoveryShowcaseSlug("prince-barber-lalpur")).toBe(true)
        expect(isSalonDiscoveryShowcaseSlug("try-salon")).toBe(false)
        expect(salonDiscoveryDestinationSlug("try-salon")).toBe("h-square-salon-harmu")
        expect(salonDiscoveryDestinationSlug("try-hotel")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(salonDiscoveryDestinationForPath("/try-salon")).toBe("/h-square-salon-harmu")
        expect(salonDiscoveryDestinationForPath("/try-salon/")).toBe("/h-square-salon-harmu")
        expect(salonDiscoveryDestinationForPath("/try-salon/book")).toBe(
            "/h-square-salon-harmu/book",
        )
        expect(salonDiscoveryDestinationForPath("/try-spa")).toBe("/h-square-salon-harmu")
        expect(salonDiscoveryDestinationForPath("/try-spa/menu")).toBe(
            "/h-square-salon-harmu/menu",
        )
        expect(salonDiscoveryDestinationForPath("/try-barber")).toBe("/prince-barber-lalpur")
        expect(salonDiscoveryDestinationForPath("/barber/book")).toBe(
            "/prince-barber-lalpur/book",
        )
        expect(salonDiscoveryDestinationForPath("/salon")).toBe("/h-square-salon-harmu")
        expect(salonDiscoveryDestinationForPath("/spa/share")).toBe(
            "/h-square-salon-harmu/share",
        )
        expect(salonDiscoveryDestinationForPath("/h-square-salon-harmu")).toBeNull()
        expect(salonDiscoveryDestinationForPath("/prince-barber-lalpur")).toBeNull()
        expect(salonDiscoveryDestinationForPath("/try-creator")).toBeNull()
        expect(salonDiscoveryDestinationForPath("/try-hotel")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = salonDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(SALON_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                { source: "/try-salon", destination: "/h-square-salon-harmu", permanent: false },
                {
                    source: "/try-salon/:path*",
                    destination: "/h-square-salon-harmu/:path*",
                    permanent: false,
                },
                { source: "/try-barber", destination: "/prince-barber-lalpur", permanent: false },
                {
                    source: "/try-barber/:path*",
                    destination: "/prince-barber-lalpur/:path*",
                    permanent: false,
                },
                { source: "/try-spa", destination: "/h-square-salon-harmu", permanent: false },
                { source: "/salon", destination: "/h-square-salon-harmu", permanent: false },
                { source: "/spa", destination: "/h-square-salon-harmu", permanent: false },
                { source: "/barber", destination: "/prince-barber-lalpur", permanent: false },
            ]),
        )
        for (const alias of SALON_DISCOVERY_REQUIRED_ALIASES) {
            expect(rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/"))).toBe(
                true,
            )
        }
    })

    it("next.config.mjs ships the salon discovery redirects and keeps creator/shop/hotel", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/SALON P1-1 discovery aliases/)
        for (const row of salonDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        expect(src).toContain('source: "/try-creator"')
        expect(src).toContain('destination: "/tagore-hill-press"')
        expect(src).toContain('source: "/try-grocery"')
        expect(src).toContain('destination: "/try-shop"')
        expect(src).toContain('source: "/hotel"')
        expect(src).toContain('destination: "/try-hotel"')
        expect(src).not.toMatch(/destination: "\/try-salon"/)
    })

    it("discovery module stays redirect-only (no P0-1 INR or P0-2 Book CTA edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/salon/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(/priceCents|USD|FX|Book a treatment|chat-interface|kit-copy/)
        expect(discovery).toMatch(/SALON P1-1/)
        expect(discovery).toMatch(/h-square-salon-harmu/)
        expect(discovery).toMatch(/prince-barber-lalpur/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("HOTEL P1-3")
        expect(cfg).toContain("P1-2 SHOP marketing aliases")
    })
})