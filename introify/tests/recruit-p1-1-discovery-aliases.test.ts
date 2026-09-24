import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    RECRUIT_DISCOVERY_ALIAS_MAP,
    RECRUIT_DISCOVERY_ALIASES,
    RECRUIT_DISCOVERY_REQUIRED_ALIASES,
    RECRUIT_SHOWCASE,
    isRecruitDiscoveryAlias,
    isRecruitDiscoveryShowcaseSlug,
    recruitDiscoveryDestinationForPath,
    recruitDiscoveryDestinationSlug,
    recruitDiscoveryRedirects,
} from "@/lib/recruitment/discovery-aliases"

const root = join(__dirname, "..")

describe("RECRUIT P1-1 discovery aliases", () => {
    it("maps required try-* aliases to Nita Recruiters showcase", () => {
        expect(RECRUIT_SHOWCASE.recruit).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_SHOWCASE.recruitment).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_SHOWCASE.recruiter).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_SHOWCASE.hr).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_SHOWCASE.jobs).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_SHOWCASE.hiring).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-recruit"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-recruitment"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-recruiter"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-hr"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-jobs"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-hiring"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect([...RECRUIT_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-recruit",
            "try-recruitment",
            "try-recruiter",
            "try-hr",
            "try-jobs",
            "try-hiring",
        ])
    })

    it("includes prefer try-staffing / try-talent + shorts /recruiter /recruitment /hr /staffing /talent", () => {
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-staffing"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP["try-talent"]).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP.recruiter).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP.recruitment).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP.hr).toBe("nita-recruiters-ashok-nagar")
        expect(RECRUIT_DISCOVERY_ALIAS_MAP.staffing).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(RECRUIT_DISCOVERY_ALIAS_MAP.talent).toBe(
            "nita-recruiters-ashok-nagar",
        )
        // do not ship short /jobs /hiring /agency (too generic / kit conflict)
        expect(RECRUIT_DISCOVERY_ALIAS_MAP).not.toHaveProperty("jobs")
        expect(RECRUIT_DISCOVERY_ALIAS_MAP).not.toHaveProperty("hiring")
        expect(RECRUIT_DISCOVERY_ALIAS_MAP).not.toHaveProperty("agency")
        // AGENCY kit owns try-agency — do not claim it for recruitment
        expect(RECRUIT_DISCOVERY_ALIAS_MAP).not.toHaveProperty("try-agency")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isRecruitDiscoveryAlias("try-recruit")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-recruitment")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-recruiter")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-hr")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-jobs")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-hiring")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-staffing")).toBe(true)
        expect(isRecruitDiscoveryAlias("try-talent")).toBe(true)
        expect(isRecruitDiscoveryAlias("recruiter")).toBe(true)
        expect(isRecruitDiscoveryAlias("recruitment")).toBe(true)
        expect(isRecruitDiscoveryAlias("hr")).toBe(true)
        expect(isRecruitDiscoveryAlias("staffing")).toBe(true)
        expect(isRecruitDiscoveryAlias("talent")).toBe(true)
        expect(isRecruitDiscoveryAlias("nita-recruiters-ashok-nagar")).toBe(false)
        expect(isRecruitDiscoveryAlias("try-gym")).toBe(false)
        expect(isRecruitDiscoveryAlias("try-field")).toBe(false)
        expect(isRecruitDiscoveryAlias("try-agency")).toBe(false)
        expect(isRecruitDiscoveryAlias(null)).toBe(false)
        expect(isRecruitDiscoveryShowcaseSlug("nita-recruiters-ashok-nagar")).toBe(
            true,
        )
        expect(isRecruitDiscoveryShowcaseSlug("try-recruit")).toBe(false)
        expect(recruitDiscoveryDestinationSlug("try-recruit")).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationSlug("try-hr")).toBe(
            "nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationSlug("try-gym")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(recruitDiscoveryDestinationForPath("/try-recruit")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-recruit/")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-recruit/book")).toBe(
            "/nita-recruiters-ashok-nagar/book",
        )
        expect(recruitDiscoveryDestinationForPath("/try-recruitment")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-recruiter")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-hr")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-hr/menu")).toBe(
            "/nita-recruiters-ashok-nagar/menu",
        )
        expect(recruitDiscoveryDestinationForPath("/try-jobs")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-hiring")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-staffing")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/try-talent")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/recruiter")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/recruitment")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/hr")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/staffing")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(recruitDiscoveryDestinationForPath("/talent")).toBe(
            "/nita-recruiters-ashok-nagar",
        )
        expect(
            recruitDiscoveryDestinationForPath("/nita-recruiters-ashok-nagar"),
        ).toBeNull()
        expect(recruitDiscoveryDestinationForPath("/try-gym")).toBeNull()
        expect(recruitDiscoveryDestinationForPath("/try-field")).toBeNull()
        expect(recruitDiscoveryDestinationForPath("/try-agency")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = recruitDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(RECRUIT_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-recruit",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-recruit/:path*",
                    destination: "/nita-recruiters-ashok-nagar/:path*",
                    permanent: false,
                },
                {
                    source: "/try-recruitment",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-recruiter",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-hr",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-jobs",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-hiring",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-staffing",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/try-talent",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/recruiter",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/recruitment",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/hr",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/staffing",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
                {
                    source: "/talent",
                    destination: "/nita-recruiters-ashok-nagar",
                    permanent: false,
                },
            ]),
        )
        for (const alias of RECRUIT_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/")),
            ).toBe(true)
        }
    })

    it("next.config.mjs ships RECRUIT P1-1 redirects and keeps field/realestate/events", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/RECRUIT P1-1 discovery aliases/)
        for (const row of recruitDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        expect(src).toContain('source: "/try-plumber"')
        expect(src).toContain('destination: "/goodwill-plumbing"')
        expect(src).toContain('source: "/try-real-estate"')
        expect(src).toContain('destination: "/shakti-property-lalpur"')
        expect(src).toContain('source: "/try-events"')
        expect(src).toContain('destination: "/next-level-events-kanke"')
        expect(src).toContain('source: "/try-gym"')
        expect(src).toContain('destination: "/aura-fitness-ranchi"')
        expect(src).toContain('source: "/try-clinic"')
        expect(src).toContain('destination: "/jk-sharma-clinic-harmu"')
        expect(src).not.toMatch(/destination: "\/try-recruit"/)
        expect(src).not.toMatch(/destination: "\/try-hr"/)
        expect(src).not.toMatch(/destination: "\/try-jobs"/)
        expect(src).not.toMatch(/destination: "\/try-hiring"/)
        // AGENCY kit slug must not be redirected to Nita
        expect(src).not.toMatch(/source: "\/try-agency"/)
    })

    it("discovery module stays redirect-only (no P1-2 menu / P1-3 imagery / P1-4 chat)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/recruitment/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book a session|shop-product-imagery|kit-copy|menu-chrome|Founder/,
        )
        expect(discovery).toMatch(/RECRUITMENT_AGENCY P1-1/)
        expect(discovery).toMatch(/nita-recruiters-ashok-nagar/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("CLINIC P1-1")
        expect(cfg).toContain("GYM P1-1")
        expect(cfg).toContain("SALON P1-1")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("EVENTS P1-2")
        expect(cfg).toContain("REALESTATE P1-2")
        expect(cfg).toContain("FIELD P1-1")
        expect(cfg).toContain("RECRUIT P1-1")
    })
})
