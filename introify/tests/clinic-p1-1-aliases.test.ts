import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    CLINIC_DISCOVERY_ALIAS_MAP,
    CLINIC_DISCOVERY_ALIASES,
    CLINIC_DISCOVERY_REQUIRED_ALIASES,
    CLINIC_SHOWCASE,
    clinicDiscoveryDestinationForPath,
    clinicDiscoveryDestinationSlug,
    clinicDiscoveryRedirects,
    isClinicDiscoveryAlias,
    isClinicDiscoveryShowcaseSlug,
} from "@/lib/clinic/discovery-aliases"

const root = join(__dirname, "..")

describe("CLINIC P1-1 discovery aliases", () => {
    it("maps required try-* aliases to JK Sharma showcase", () => {
        expect(CLINIC_SHOWCASE.clinic).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_SHOWCASE.dental).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_SHOWCASE.doctor).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_DISCOVERY_ALIAS_MAP["try-clinic"]).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_DISCOVERY_ALIAS_MAP["try-dental"]).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_DISCOVERY_ALIAS_MAP["try-doctor"]).toBe("jk-sharma-clinic-harmu")
        expect([...CLINIC_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-clinic",
            "try-doctor",
            "try-dental",
        ])
    })

    it("includes preferred short roles /clinic /dental /doctor", () => {
        expect(CLINIC_DISCOVERY_ALIAS_MAP.clinic).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_DISCOVERY_ALIAS_MAP.dental).toBe("jk-sharma-clinic-harmu")
        expect(CLINIC_DISCOVERY_ALIAS_MAP.doctor).toBe("jk-sharma-clinic-harmu")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isClinicDiscoveryAlias("try-clinic")).toBe(true)
        expect(isClinicDiscoveryAlias("try-dental")).toBe(true)
        expect(isClinicDiscoveryAlias("try-doctor")).toBe(true)
        expect(isClinicDiscoveryAlias("clinic")).toBe(true)
        expect(isClinicDiscoveryAlias("dental")).toBe(true)
        expect(isClinicDiscoveryAlias("doctor")).toBe(true)
        expect(isClinicDiscoveryAlias("jk-sharma-clinic-harmu")).toBe(false)
        expect(isClinicDiscoveryAlias("try-gym")).toBe(false)
        expect(isClinicDiscoveryAlias("try-salon")).toBe(false)
        expect(isClinicDiscoveryAlias(null)).toBe(false)
        expect(isClinicDiscoveryShowcaseSlug("jk-sharma-clinic-harmu")).toBe(true)
        expect(isClinicDiscoveryShowcaseSlug("try-clinic")).toBe(false)
        expect(clinicDiscoveryDestinationSlug("try-clinic")).toBe("jk-sharma-clinic-harmu")
        expect(clinicDiscoveryDestinationSlug("try-gym")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(clinicDiscoveryDestinationForPath("/try-clinic")).toBe(
            "/jk-sharma-clinic-harmu",
        )
        expect(clinicDiscoveryDestinationForPath("/try-clinic/")).toBe(
            "/jk-sharma-clinic-harmu",
        )
        expect(clinicDiscoveryDestinationForPath("/try-clinic/book")).toBe(
            "/jk-sharma-clinic-harmu/book",
        )
        expect(clinicDiscoveryDestinationForPath("/try-dental")).toBe(
            "/jk-sharma-clinic-harmu",
        )
        expect(clinicDiscoveryDestinationForPath("/try-dental/menu")).toBe(
            "/jk-sharma-clinic-harmu/menu",
        )
        expect(clinicDiscoveryDestinationForPath("/try-doctor")).toBe(
            "/jk-sharma-clinic-harmu",
        )
        expect(clinicDiscoveryDestinationForPath("/doctor/book")).toBe(
            "/jk-sharma-clinic-harmu/book",
        )
        expect(clinicDiscoveryDestinationForPath("/clinic")).toBe(
            "/jk-sharma-clinic-harmu",
        )
        expect(clinicDiscoveryDestinationForPath("/dental")).toBe(
            "/jk-sharma-clinic-harmu",
        )
        expect(clinicDiscoveryDestinationForPath("/jk-sharma-clinic-harmu")).toBeNull()
        expect(clinicDiscoveryDestinationForPath("/try-gym")).toBeNull()
        expect(clinicDiscoveryDestinationForPath("/try-salon")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = clinicDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(CLINIC_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-clinic",
                    destination: "/jk-sharma-clinic-harmu",
                    permanent: false,
                },
                {
                    source: "/try-clinic/:path*",
                    destination: "/jk-sharma-clinic-harmu/:path*",
                    permanent: false,
                },
                {
                    source: "/try-dental",
                    destination: "/jk-sharma-clinic-harmu",
                    permanent: false,
                },
                {
                    source: "/try-doctor",
                    destination: "/jk-sharma-clinic-harmu",
                    permanent: false,
                },
                {
                    source: "/clinic",
                    destination: "/jk-sharma-clinic-harmu",
                    permanent: false,
                },
                {
                    source: "/dental",
                    destination: "/jk-sharma-clinic-harmu",
                    permanent: false,
                },
                {
                    source: "/doctor",
                    destination: "/jk-sharma-clinic-harmu",
                    permanent: false,
                },
            ]),
        )
        for (const alias of CLINIC_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/")),
            ).toBe(true)
        }
    })

    it("next.config.mjs ships the clinic discovery redirects and keeps gym/salon", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/CLINIC P1-1 discovery aliases/)
        for (const row of clinicDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        expect(src).toContain('source: "/try-gym"')
        expect(src).toContain('destination: "/aura-fitness-ranchi"')
        expect(src).toContain('source: "/try-salon"')
        expect(src).toContain('destination: "/h-square-salon-harmu"')
        expect(src).toContain('source: "/try-yoga"')
        expect(src).toContain('destination: "/natraj-yoga-kutchery"')
        expect(src).not.toMatch(/destination: "\/try-clinic"/)
    })

    it("discovery module stays redirect-only (no P0-1 copy or pharmacy P1 edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/clinic/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book an appointment|Book a session|sanjivani|shop-product-imagery|kit-copy/,
        )
        expect(discovery).toMatch(/CLINIC P1-1/)
        expect(discovery).toMatch(/jk-sharma-clinic-harmu/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("GYM P1-1")
        expect(cfg).toContain("SALON P1-1")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("HOTEL P1-3")
    })
})