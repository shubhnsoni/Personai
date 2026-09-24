import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    AUTOPARTS_DISCOVERY_ALIAS_MAP,
    AUTOPARTS_DISCOVERY_ALIASES,
    AUTOPARTS_DISCOVERY_REQUIRED_ALIASES,
    AUTOPARTS_SHOWCASE,
    isAutopartsDiscoveryAlias,
    isAutopartsDiscoveryShowcaseSlug,
    autopartsDiscoveryDestinationForPath,
    autopartsDiscoveryDestinationSlug,
    autopartsDiscoveryRedirects,
} from "@/lib/autoparts/discovery-aliases"

const root = join(__dirname, "..")

describe("AUTO_PARTS P0-1 discovery aliases", () => {
    it("maps required try-auto-parts to Paras Auto showcase", () => {
        expect(AUTOPARTS_SHOWCASE["auto-parts"]).toBe("paras-auto")
        expect(AUTOPARTS_SHOWCASE.autoparts).toBe("paras-auto")
        expect(AUTOPARTS_SHOWCASE.parts).toBe("paras-auto")
        expect(AUTOPARTS_SHOWCASE.auto).toBe("paras-auto")
        expect(AUTOPARTS_SHOWCASE["spare-parts"]).toBe("paras-auto")
        expect(AUTOPARTS_SHOWCASE.spares).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["try-auto-parts"]).toBe("paras-auto")
        expect([...AUTOPARTS_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-auto-parts",
        ])
    })

    it("includes prefer try-autoparts / try-parts + Role Loop soft-404s + shorts", () => {
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["try-autoparts"]).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["try-parts"]).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["try-auto"]).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["try-spare-parts"]).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["try-spares"]).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP["auto-parts"]).toBe("paras-auto")
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP.parts).toBe("paras-auto")
        // SHOP / Armonia décor owns try-shop
        expect(AUTOPARTS_DISCOVERY_ALIAS_MAP).not.toHaveProperty("try-shop")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isAutopartsDiscoveryAlias("try-auto-parts")).toBe(true)
        expect(isAutopartsDiscoveryAlias("try-autoparts")).toBe(true)
        expect(isAutopartsDiscoveryAlias("try-parts")).toBe(true)
        expect(isAutopartsDiscoveryAlias("try-auto")).toBe(true)
        expect(isAutopartsDiscoveryAlias("try-spare-parts")).toBe(true)
        expect(isAutopartsDiscoveryAlias("try-spares")).toBe(true)
        expect(isAutopartsDiscoveryAlias("auto-parts")).toBe(true)
        expect(isAutopartsDiscoveryAlias("parts")).toBe(true)
        expect(isAutopartsDiscoveryAlias("paras-auto")).toBe(false)
        expect(isAutopartsDiscoveryAlias("try-shop")).toBe(false)
        expect(isAutopartsDiscoveryAlias("try-grocery")).toBe(false)
        expect(isAutopartsDiscoveryAlias("try-jewellery")).toBe(false)
        expect(isAutopartsDiscoveryAlias("try-recruit")).toBe(false)
        expect(isAutopartsDiscoveryAlias(null)).toBe(false)
        expect(isAutopartsDiscoveryShowcaseSlug("paras-auto")).toBe(true)
        expect(isAutopartsDiscoveryShowcaseSlug("try-auto-parts")).toBe(false)
        expect(autopartsDiscoveryDestinationSlug("try-auto-parts")).toBe(
            "paras-auto",
        )
        expect(autopartsDiscoveryDestinationSlug("try-parts")).toBe(
            "paras-auto",
        )
        expect(autopartsDiscoveryDestinationSlug("try-shop")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(autopartsDiscoveryDestinationForPath("/try-auto-parts")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-auto-parts/")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-auto-parts/menu")).toBe(
            "/paras-auto/menu",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-autoparts")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-parts")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-auto")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-spare-parts")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/try-spares")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/auto-parts")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/parts")).toBe(
            "/paras-auto",
        )
        expect(autopartsDiscoveryDestinationForPath("/paras-auto")).toBeNull()
        expect(autopartsDiscoveryDestinationForPath("/try-shop")).toBeNull()
        expect(autopartsDiscoveryDestinationForPath("/try-grocery")).toBeNull()
        expect(autopartsDiscoveryDestinationForPath("/try-jewellery")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = autopartsDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(AUTOPARTS_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-auto-parts",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/try-auto-parts/:path*",
                    destination: "/paras-auto/:path*",
                    permanent: false,
                },
                {
                    source: "/try-autoparts",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/try-parts",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/try-auto",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/try-spare-parts",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/try-spares",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/auto-parts",
                    destination: "/paras-auto",
                    permanent: false,
                },
                {
                    source: "/parts",
                    destination: "/paras-auto",
                    permanent: false,
                },
            ]),
        )
        for (const alias of AUTOPARTS_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some(
                    (r) =>
                        r.source === `/${alias}` &&
                        r.destination === "/paras-auto",
                ),
            ).toBe(true)
        }
    })

    it("next.config.mjs ships AUTO_PARTS P0-1 redirects and keeps try-shop as Armonia", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/AUTO_PARTS P0-1 discovery aliases/)
        for (const row of autopartsDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        // auto aliases must NOT soft-route to try-shop / Armonia
        expect(src).not.toMatch(
            /source:\s*"\/try-auto-parts"[^}]*destination:\s*"\/try-shop"/,
        )
        expect(src).not.toMatch(
            /source:\s*"\/try-parts"[^}]*destination:\s*"\/try-shop"/,
        )
        expect(src).toContain('source: "/try-auto-parts"')
        expect(src).toContain('destination: "/paras-auto"')
        // try-shop stays SHOP / décor showcase
        expect(src).toContain('source: "/try-grocery"')
        expect(src).toContain('destination: "/try-shop"')
        expect(src).toContain('source: "/try-retail"')
        expect(src).toContain('destination: "/try-shop"')
        // other verticals intact
        expect(src).toContain('source: "/try-jewellery"')
        expect(src).toContain('destination: "/mk-jewellers"')
        expect(src).toContain('source: "/try-recruit"')
        expect(src).toContain('destination: "/nita-recruiters-ashok-nagar"')
        expect(src).toContain('source: "/try-plumber"')
        expect(src).toContain('destination: "/goodwill-plumbing"')
    })

    it("discovery module stays redirect-only (no menu / imagery / chat)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/autoparts/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book a session|shop-product-imagery|kit-copy|menu-chrome|Founder/,
        )
        expect(discovery).toMatch(/AUTO_PARTS P0-1/)
        expect(discovery).toMatch(/paras-auto/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("AUTO_PARTS P0-1")
        expect(cfg).toContain("JEWELRY P0-1")
        expect(cfg).toContain("RECRUIT P1-1")
        expect(cfg).toContain("FIELD P1-1")
        expect(cfg).toContain("P1-2 SHOP marketing aliases")
    })
})
