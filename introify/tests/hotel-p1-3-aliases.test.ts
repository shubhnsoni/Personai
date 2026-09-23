import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    isStayDiscoveryAlias,
    isTryHotelShowcaseSlug,
    planTryHotelEnsure,
    stayDiscoveryDestinationForPath,
    stayDiscoveryRedirects,
    STAY_DISCOVERY_ALIASES,
    STAY_DISCOVERY_DESTINATION,
    TRY_HOTEL_CANONICAL_SLUG,
} from "@/lib/hotels/ensure-try-hotel"
import { TRY_HOTEL } from "@/lib/hotels/try-hotel-seed"

const root = join(__dirname, "..")

describe("HOTEL P1-3 stay discovery aliases", () => {
    it("canonical showcase is try-hotel / Haven Hinoo", () => {
        expect(TRY_HOTEL_CANONICAL_SLUG).toBe("try-hotel")
        expect(TRY_HOTEL.slug).toBe("try-hotel")
        expect(TRY_HOTEL.displayName).toBe("Haven Hinoo")
        expect(STAY_DISCOVERY_DESTINATION).toBe("/try-hotel")
        expect([...STAY_DISCOVERY_ALIASES]).toEqual(["hotel", "try-stay", "try-bnb"])
    })

    it("recognizes discovery aliases and the canonical try-hotel slug", () => {
        expect(isStayDiscoveryAlias("hotel")).toBe(true)
        expect(isStayDiscoveryAlias("try-stay")).toBe(true)
        expect(isStayDiscoveryAlias("try-bnb")).toBe(true)
        expect(isStayDiscoveryAlias("try-hotel")).toBe(false)
        expect(isStayDiscoveryAlias("haven-hinoo")).toBe(false)
        expect(isStayDiscoveryAlias("try-shop")).toBe(false)
        expect(isTryHotelShowcaseSlug("try-hotel")).toBe(true)
        expect(isTryHotelShowcaseSlug("hotel")).toBe(false)
        expect(isTryHotelShowcaseSlug("try-stay")).toBe(false)
        expect(isTryHotelShowcaseSlug(null)).toBe(false)
    })

    it("maps alias paths to /try-hotel (exact + nested)", () => {
        expect(stayDiscoveryDestinationForPath("/hotel")).toBe("/try-hotel")
        expect(stayDiscoveryDestinationForPath("/hotel/")).toBe("/try-hotel")
        expect(stayDiscoveryDestinationForPath("/try-stay")).toBe("/try-hotel")
        expect(stayDiscoveryDestinationForPath("/try-bnb")).toBe("/try-hotel")
        expect(stayDiscoveryDestinationForPath("/hotel/menu")).toBe("/try-hotel/menu")
        expect(stayDiscoveryDestinationForPath("/try-stay/book")).toBe("/try-hotel/book")
        expect(stayDiscoveryDestinationForPath("/try-bnb/r/101")).toBe("/try-hotel/r/101")
        expect(stayDiscoveryDestinationForPath("/try-hotel")).toBeNull()
        expect(stayDiscoveryDestinationForPath("/haven-hinoo")).toBeNull()
        expect(stayDiscoveryDestinationForPath("/try-shop")).toBeNull()
        expect(stayDiscoveryDestinationForPath("/rooms")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for each alias", () => {
        const rows = stayDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toEqual(
            expect.arrayContaining([
                { source: "/hotel", destination: "/try-hotel", permanent: false },
                { source: "/hotel/:path*", destination: "/try-hotel/:path*", permanent: false },
                { source: "/try-stay", destination: "/try-hotel", permanent: false },
                { source: "/try-stay/:path*", destination: "/try-hotel/:path*", permanent: false },
                { source: "/try-bnb", destination: "/try-hotel", permanent: false },
                { source: "/try-bnb/:path*", destination: "/try-hotel/:path*", permanent: false },
            ]),
        )
        expect(rows).toHaveLength(6)
    })

    it("plans ensure only for the canonical try-hotel slug", () => {
        expect(planTryHotelEnsure("try-hotel").action).toBe("ensure-canonical")
        expect(planTryHotelEnsure("hotel").action).toBe("noop-unrelated")
        expect(planTryHotelEnsure("try-stay").action).toBe("noop-unrelated")
        expect(planTryHotelEnsure("try-bnb").action).toBe("noop-unrelated")
        expect(planTryHotelEnsure("haven-hinoo").action).toBe("noop-unrelated")
        expect(planTryHotelEnsure("try-shop").action).toBe("noop-unrelated")
    })

    it("next.config.mjs ships the stay discovery redirects", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/HOTEL P1-3 stay discovery/)
        for (const row of stayDiscoveryRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        // Shop aliases stay intact
        expect(src).toContain('source: "/try-grocery"')
        expect(src).toContain('destination: "/try-shop"')
    })

    it("profile + menu pages ensure try-hotel on visit", () => {
        const page = readFileSync(join(root, "src/app/[slug]/page.tsx"), "utf8")
        const menu = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        for (const src of [page, menu]) {
            expect(src).toMatch(/ensureTryHotelShowcase/)
            expect(src).toMatch(/isTryHotelShowcaseSlug/)
            expect(src).toMatch(/@\/lib\/hotels\/ensure-try-hotel/)
        }
        // Do not regress print/book (P1-1 / P1-2)
        expect(page).not.toMatch(/guest-print-copy|hotel-guest-book/)
        expect(menu).not.toMatch(/guest-print-copy|hotel-guest-book/)
    })
})
