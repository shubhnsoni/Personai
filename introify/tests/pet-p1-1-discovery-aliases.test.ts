import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    PET_GROOMING_DISCOVERY_ALIAS_MAP,
    PET_GROOMING_DISCOVERY_ALIASES,
    PET_GROOMING_DISCOVERY_REQUIRED_ALIASES,
    PET_GROOMING_SHOWCASE,
    isPetGroomingDiscoveryAlias,
    isPetGroomingDiscoveryShowcaseSlug,
    petGroomingDiscoveryDestinationForPath,
    petGroomingDiscoveryDestinationSlug,
    petGroomingDiscoveryRedirects,
} from "@/lib/petgrooming/discovery-aliases"
import { TRY_KITS } from "@/lib/try-kits"

const root = join(__dirname, "..")
const PLUTO = "pluto-grooming-hinoo"
const PET_ALIASES = ["try-pet", "try-grooming", "try-pet-grooming", "try-dog-grooming", "try-pets"] as const

/** Regression: existing discovery aliases must keep their exact destinations. */
const REGRESSION: Record<string, string> = {
    "/try-salon": "/h-square-salon-harmu",
    "/try-gym": "/aura-fitness-ranchi",
    "/try-clinic": "/jk-sharma-clinic-harmu",
    "/try-auto-parts": "/paras-auto",
    "/try-jewelry": "/mk-jewellers",
    "/try-plumber": "/goodwill-plumbing",
}

describe("PET P1-1 discovery aliases", () => {
    it("maps all five required aliases to the Pluto grooming showcase", () => {
        expect(PET_GROOMING_SHOWCASE.grooming).toBe(PLUTO)
        expect([...PET_GROOMING_DISCOVERY_REQUIRED_ALIASES].sort()).toEqual([...PET_ALIASES].sort())
        for (const alias of PET_ALIASES) {
            expect(PET_GROOMING_DISCOVERY_ALIAS_MAP[alias]).toBe(PLUTO)
            expect(isPetGroomingDiscoveryAlias(alias)).toBe(true)
            expect(petGroomingDiscoveryDestinationSlug(alias)).toBe(PLUTO)
        }
        expect(PET_GROOMING_DISCOVERY_ALIASES).toHaveLength(5)
    })

    it("does not claim other verticals or the showcase itself", () => {
        for (const slug of ["try-vet", "try-dog", "try-salon", "try-gym", "try-shop", "try-restaurant", PLUTO, null]) {
            expect(isPetGroomingDiscoveryAlias(slug)).toBe(false)
        }
        expect(isPetGroomingDiscoveryShowcaseSlug(PLUTO)).toBe(true)
        expect(isPetGroomingDiscoveryShowcaseSlug("try-pet")).toBe(false)
        expect(petGroomingDiscoveryDestinationSlug("try-salon")).toBeNull()
    })

    it("maps alias paths exact, trailing slash, and nested", () => {
        for (const alias of PET_ALIASES) {
            expect(petGroomingDiscoveryDestinationForPath(`/${alias}`)).toBe(`/${PLUTO}`)
            expect(petGroomingDiscoveryDestinationForPath(`/${alias}/`)).toBe(`/${PLUTO}`)
            expect(petGroomingDiscoveryDestinationForPath(`/${alias}/book`)).toBe(`/${PLUTO}/book`)
        }
        expect(petGroomingDiscoveryDestinationForPath(`/${PLUTO}`)).toBeNull()
        expect(petGroomingDiscoveryDestinationForPath("/try-salon")).toBeNull()
        expect(petGroomingDiscoveryDestinationForPath("/try-petx")).toBeNull()
    })

    it("emits non-permanent Next redirect rows (exact + nested) for every alias", () => {
        const rows = petGroomingDiscoveryRedirects()
        expect(rows).toHaveLength(PET_GROOMING_DISCOVERY_ALIASES.length * 2)
        expect(rows.every((r) => r.permanent === false)).toBe(true)
        for (const alias of PET_ALIASES) {
            expect(rows).toContainEqual({ source: `/${alias}`, destination: `/${PLUTO}`, permanent: false })
            expect(rows).toContainEqual({ source: `/${alias}/:path*`, destination: `/${PLUTO}/:path*`, permanent: false })
        }
    })

    it("TRY_KITS keeps try-pet-grooming as the PET_GROOMING kit slug", () => {
        const kit = TRY_KITS.find((k) => k.role === "PET_GROOMING")
        expect(kit?.slug).toBe("try-pet-grooming")
    })
})

describe("PET P1-1 next.config.mjs wiring + no regression", () => {
    const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")

    it("ships every pet redirect row in next.config.mjs", () => {
        expect(cfg).toMatch(/PET P1-1 discovery aliases/)
        for (const row of petGroomingDiscoveryRedirects()) {
            expect(cfg).toContain(`{ source: "${row.source}", destination: "${row.destination}", permanent: false }`)
        }
    })

    it("each pet alias source appears exactly once (no duplicate/conflicting rows)", () => {
        for (const alias of PET_ALIASES) {
            const exact = cfg.split(`source: "/${alias}"`).length - 1
            const nested = cfg.split(`source: "/${alias}/:path*"`).length - 1
            expect(exact).toBe(1)
            expect(nested).toBe(1)
        }
    })

    it("keeps existing discovery aliases pointing where they did", () => {
        for (const [source, destination] of Object.entries(REGRESSION)) {
            expect(cfg).toContain(`{ source: "${source}", destination: "${destination}", permanent: false }`)
        }
        // try-shop / try-restaurant are real TRY_KITS profiles, never redirected.
        expect(cfg).not.toMatch(/source: "\/try-shop"/)
        expect(cfg).not.toMatch(/source: "\/try-restaurant"/)
        expect(cfg).not.toMatch(/destination: "\/try-pet/)
        for (const block of ["SALON P1-1", "GYM P1-1", "CLINIC P1-1", "AUTO_PARTS P0-1", "JEWELRY P0-1", "RECRUIT P1-1"]) {
            expect(cfg).toContain(block)
        }
    })

    it("discovery module stays redirect-only (no copy / imagery / chat edits)", () => {
        const src = readFileSync(join(root, "src/lib/petgrooming/discovery-aliases.ts"), "utf8")
        expect(src).toMatch(/PET P1-1/)
        expect(src).toContain(PLUTO)
        expect(src).not.toMatch(/kit-copy|Book a groom|shop-product-imagery/)
    })
})
