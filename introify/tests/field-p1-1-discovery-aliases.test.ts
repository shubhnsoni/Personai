import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    FIELD_DISCOVERY_ALIAS_MAP,
    FIELD_DISCOVERY_ALIASES,
    FIELD_DISCOVERY_REQUIRED_ALIASES,
    FIELD_SHOWCASE,
    fieldDiscoveryDestinationForPath,
    fieldDiscoveryDestinationSlug,
    fieldDiscoveryRedirects,
    isFieldDiscoveryAlias,
    isFieldDiscoveryShowcaseSlug,
} from "@/lib/fieldjobs/discovery-aliases"

const root = join(__dirname, "..")

describe("FIELD P1-1 discovery aliases", () => {
    it("maps required try-* aliases to Goodwill Plumbing showcase", () => {
        expect(FIELD_SHOWCASE.plumber).toBe("goodwill-plumbing")
        expect(FIELD_SHOWCASE.electrician).toBe("goodwill-plumbing")
        expect(FIELD_SHOWCASE.field).toBe("goodwill-plumbing")
        expect(FIELD_SHOWCASE.garage).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP["try-plumber"]).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP["try-electrician"]).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP["try-field"]).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP["try-garage"]).toBe("goodwill-plumbing")
        expect([...FIELD_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-plumber",
            "try-electrician",
            "try-field",
            "try-garage",
        ])
    })

    it("includes prefer try-ac-repair / try-repair + shorts /plumber /electrician /garage", () => {
        expect(FIELD_DISCOVERY_ALIAS_MAP["try-ac-repair"]).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP["try-repair"]).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP.plumber).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP.electrician).toBe("goodwill-plumbing")
        expect(FIELD_DISCOVERY_ALIAS_MAP.garage).toBe("goodwill-plumbing")
        // do not ship short /field /repair /ac-repair (too generic)
        expect(FIELD_DISCOVERY_ALIAS_MAP).not.toHaveProperty("field")
        expect(FIELD_DISCOVERY_ALIAS_MAP).not.toHaveProperty("repair")
        expect(FIELD_DISCOVERY_ALIAS_MAP).not.toHaveProperty("ac-repair")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isFieldDiscoveryAlias("try-plumber")).toBe(true)
        expect(isFieldDiscoveryAlias("try-electrician")).toBe(true)
        expect(isFieldDiscoveryAlias("try-field")).toBe(true)
        expect(isFieldDiscoveryAlias("try-garage")).toBe(true)
        expect(isFieldDiscoveryAlias("try-ac-repair")).toBe(true)
        expect(isFieldDiscoveryAlias("try-repair")).toBe(true)
        expect(isFieldDiscoveryAlias("plumber")).toBe(true)
        expect(isFieldDiscoveryAlias("electrician")).toBe(true)
        expect(isFieldDiscoveryAlias("garage")).toBe(true)
        expect(isFieldDiscoveryAlias("goodwill-plumbing")).toBe(false)
        expect(isFieldDiscoveryAlias("try-gym")).toBe(false)
        expect(isFieldDiscoveryAlias("try-events")).toBe(false)
        expect(isFieldDiscoveryAlias("try-real-estate")).toBe(false)
        expect(isFieldDiscoveryAlias(null)).toBe(false)
        expect(isFieldDiscoveryShowcaseSlug("goodwill-plumbing")).toBe(true)
        expect(isFieldDiscoveryShowcaseSlug("try-plumber")).toBe(false)
        expect(fieldDiscoveryDestinationSlug("try-plumber")).toBe("goodwill-plumbing")
        expect(fieldDiscoveryDestinationSlug("try-electrician")).toBe("goodwill-plumbing")
        expect(fieldDiscoveryDestinationSlug("try-gym")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(fieldDiscoveryDestinationForPath("/try-plumber")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/try-plumber/")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/try-plumber/book")).toBe(
            "/goodwill-plumbing/book",
        )
        expect(fieldDiscoveryDestinationForPath("/try-electrician")).toBe(
            "/goodwill-plumbing",
        )
        expect(fieldDiscoveryDestinationForPath("/try-field")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/try-field/menu")).toBe(
            "/goodwill-plumbing/menu",
        )
        expect(fieldDiscoveryDestinationForPath("/try-garage")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/try-ac-repair")).toBe(
            "/goodwill-plumbing",
        )
        expect(fieldDiscoveryDestinationForPath("/try-repair")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/plumber")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/electrician")).toBe(
            "/goodwill-plumbing",
        )
        expect(fieldDiscoveryDestinationForPath("/garage")).toBe("/goodwill-plumbing")
        expect(fieldDiscoveryDestinationForPath("/goodwill-plumbing")).toBeNull()
        expect(fieldDiscoveryDestinationForPath("/try-gym")).toBeNull()
        expect(fieldDiscoveryDestinationForPath("/try-events")).toBeNull()
        expect(fieldDiscoveryDestinationForPath("/try-real-estate")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = fieldDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(FIELD_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-plumber",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/try-plumber/:path*",
                    destination: "/goodwill-plumbing/:path*",
                    permanent: false,
                },
                {
                    source: "/try-electrician",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/try-field",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/try-garage",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/try-ac-repair",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/try-repair",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/plumber",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/electrician",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
                {
                    source: "/garage",
                    destination: "/goodwill-plumbing",
                    permanent: false,
                },
            ]),
        )
        for (const alias of FIELD_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/")),
            ).toBe(true)
        }
    })

    it("next.config.mjs ships FIELD P1-1 redirects and keeps existing try-*", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/FIELD P1-1 discovery aliases/)
        for (const row of fieldDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        expect(src).toContain('source: "/try-events"')
        expect(src).toContain('destination: "/next-level-events-kanke"')
        expect(src).toContain('source: "/try-real-estate"')
        expect(src).toContain('destination: "/shakti-property-lalpur"')
        expect(src).toContain('source: "/try-gym"')
        expect(src).toContain('destination: "/aura-fitness-ranchi"')
        expect(src).toContain('source: "/try-clinic"')
        expect(src).toContain('destination: "/jk-sharma-clinic-harmu"')
        expect(src).toContain('source: "/try-salon"')
        expect(src).toContain('destination: "/h-square-salon-harmu"')
        expect(src).toContain('source: "/try-creator"')
        expect(src).toContain('destination: "/tagore-hill-press"')
        expect(src).toContain('source: "/try-stay"')
        expect(src).toContain('destination: "/try-hotel"')
        expect(src).not.toMatch(/destination: "\/try-plumber"/)
        expect(src).not.toMatch(/destination: "\/try-electrician"/)
        expect(src).not.toMatch(/destination: "\/try-field"/)
        expect(src).not.toMatch(/destination: "\/try-garage"/)
    })

    it("discovery module stays redirect-only (no P1-2 menu or P1-3 imagery edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/fieldjobs/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book a session|shop-product-imagery|kit-copy|menu-chrome|Founder/,
        )
        expect(discovery).toMatch(/FIELD_SERVICE P1-1/)
        expect(discovery).toMatch(/goodwill-plumbing/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("CLINIC P1-1")
        expect(cfg).toContain("GYM P1-1")
        expect(cfg).toContain("SALON P1-1")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("EVENTS P1-2")
        expect(cfg).toContain("REALESTATE P1-2")
        expect(cfg).toContain("FIELD P1-1")
    })
})
