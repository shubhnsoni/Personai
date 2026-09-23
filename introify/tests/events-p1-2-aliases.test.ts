import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
    EVENTS_DISCOVERY_ALIAS_MAP,
    EVENTS_DISCOVERY_ALIASES,
    EVENTS_DISCOVERY_NEW_ALIASES,
    EVENTS_DISCOVERY_REQUIRED_ALIASES,
    EVENTS_SHOWCASE,
    eventsDiscoveryDestinationForPath,
    eventsDiscoveryDestinationSlug,
    eventsDiscoveryNewRedirects,
    eventsDiscoveryRedirects,
    isEventsDiscoveryAlias,
    isEventsDiscoveryShowcaseSlug,
} from "@/lib/events/discovery-aliases"

const root = join(__dirname, "..")

describe("EVENTS P1-2 discovery aliases", () => {
    it("maps required try-* aliases to Next Level / Let's Click showcases", () => {
        expect(EVENTS_SHOWCASE.events).toBe("next-level-events-kanke")
        expect(EVENTS_SHOWCASE.studio).toBe("next-level-events-kanke")
        expect(EVENTS_SHOWCASE.photo).toBe("lets-click-ratu-road")
        expect(EVENTS_SHOWCASE.photographer).toBe("lets-click-ratu-road")
        expect(EVENTS_DISCOVERY_ALIAS_MAP["try-events"]).toBe("next-level-events-kanke")
        expect(EVENTS_DISCOVERY_ALIAS_MAP["try-studio"]).toBe("next-level-events-kanke")
        expect(EVENTS_DISCOVERY_ALIAS_MAP["try-photo"]).toBe("lets-click-ratu-road")
        expect(EVENTS_DISCOVERY_ALIAS_MAP["try-photographer"]).toBe("lets-click-ratu-road")
        expect([...EVENTS_DISCOVERY_REQUIRED_ALIASES]).toEqual([
            "try-events",
            "try-studio",
            "try-photo",
        ])
    })

    it("includes try-event + preferred shorts /events /photo /photographer", () => {
        expect(EVENTS_DISCOVERY_ALIAS_MAP["try-event"]).toBe("next-level-events-kanke")
        expect(EVENTS_DISCOVERY_ALIAS_MAP.events).toBe("next-level-events-kanke")
        expect(EVENTS_DISCOVERY_ALIAS_MAP.photo).toBe("lets-click-ratu-road")
        expect(EVENTS_DISCOVERY_ALIAS_MAP.photographer).toBe("lets-click-ratu-road")
        expect(EVENTS_DISCOVERY_ALIAS_MAP).not.toHaveProperty("studio")
    })

    it("recognizes aliases vs showcase destinations", () => {
        expect(isEventsDiscoveryAlias("try-events")).toBe(true)
        expect(isEventsDiscoveryAlias("try-event")).toBe(true)
        expect(isEventsDiscoveryAlias("try-studio")).toBe(true)
        expect(isEventsDiscoveryAlias("try-photo")).toBe(true)
        expect(isEventsDiscoveryAlias("try-photographer")).toBe(true)
        expect(isEventsDiscoveryAlias("events")).toBe(true)
        expect(isEventsDiscoveryAlias("photo")).toBe(true)
        expect(isEventsDiscoveryAlias("photographer")).toBe(true)
        expect(isEventsDiscoveryAlias("next-level-events-kanke")).toBe(false)
        expect(isEventsDiscoveryAlias("lets-click-ratu-road")).toBe(false)
        expect(isEventsDiscoveryAlias("try-gym")).toBe(false)
        expect(isEventsDiscoveryAlias("try-clinic")).toBe(false)
        expect(isEventsDiscoveryAlias(null)).toBe(false)
        expect(isEventsDiscoveryShowcaseSlug("next-level-events-kanke")).toBe(true)
        expect(isEventsDiscoveryShowcaseSlug("lets-click-ratu-road")).toBe(true)
        expect(isEventsDiscoveryShowcaseSlug("try-events")).toBe(false)
        expect(eventsDiscoveryDestinationSlug("try-events")).toBe("next-level-events-kanke")
        expect(eventsDiscoveryDestinationSlug("try-photo")).toBe("lets-click-ratu-road")
        expect(eventsDiscoveryDestinationSlug("try-gym")).toBeNull()
    })

    it("maps alias paths to showcase destinations (exact + nested)", () => {
        expect(eventsDiscoveryDestinationForPath("/try-events")).toBe(
            "/next-level-events-kanke",
        )
        expect(eventsDiscoveryDestinationForPath("/try-events/")).toBe(
            "/next-level-events-kanke",
        )
        expect(eventsDiscoveryDestinationForPath("/try-events/book")).toBe(
            "/next-level-events-kanke/book",
        )
        expect(eventsDiscoveryDestinationForPath("/try-event")).toBe(
            "/next-level-events-kanke",
        )
        expect(eventsDiscoveryDestinationForPath("/try-studio")).toBe(
            "/next-level-events-kanke",
        )
        expect(eventsDiscoveryDestinationForPath("/try-studio/menu")).toBe(
            "/next-level-events-kanke/menu",
        )
        expect(eventsDiscoveryDestinationForPath("/try-photo")).toBe(
            "/lets-click-ratu-road",
        )
        expect(eventsDiscoveryDestinationForPath("/try-photo/book")).toBe(
            "/lets-click-ratu-road/book",
        )
        expect(eventsDiscoveryDestinationForPath("/try-photographer")).toBe(
            "/lets-click-ratu-road",
        )
        expect(eventsDiscoveryDestinationForPath("/events")).toBe(
            "/next-level-events-kanke",
        )
        expect(eventsDiscoveryDestinationForPath("/photo")).toBe(
            "/lets-click-ratu-road",
        )
        expect(eventsDiscoveryDestinationForPath("/photographer")).toBe(
            "/lets-click-ratu-road",
        )
        expect(eventsDiscoveryDestinationForPath("/next-level-events-kanke")).toBeNull()
        expect(eventsDiscoveryDestinationForPath("/lets-click-ratu-road")).toBeNull()
        expect(eventsDiscoveryDestinationForPath("/try-gym")).toBeNull()
        expect(eventsDiscoveryDestinationForPath("/try-clinic")).toBeNull()
    })

    it("emits Next redirect rows (non-permanent) for every alias", () => {
        const rows = eventsDiscoveryRedirects()
        expect(rows.every((row) => row.permanent === false)).toBe(true)
        expect(rows).toHaveLength(EVENTS_DISCOVERY_ALIASES.length * 2)
        expect(rows).toEqual(
            expect.arrayContaining([
                {
                    source: "/try-events",
                    destination: "/next-level-events-kanke",
                    permanent: false,
                },
                {
                    source: "/try-events/:path*",
                    destination: "/next-level-events-kanke/:path*",
                    permanent: false,
                },
                {
                    source: "/try-event",
                    destination: "/next-level-events-kanke",
                    permanent: false,
                },
                {
                    source: "/try-studio",
                    destination: "/next-level-events-kanke",
                    permanent: false,
                },
                {
                    source: "/try-photo",
                    destination: "/lets-click-ratu-road",
                    permanent: false,
                },
                {
                    source: "/try-photographer",
                    destination: "/lets-click-ratu-road",
                    permanent: false,
                },
                {
                    source: "/events",
                    destination: "/next-level-events-kanke",
                    permanent: false,
                },
                {
                    source: "/photo",
                    destination: "/lets-click-ratu-road",
                    permanent: false,
                },
                {
                    source: "/photographer",
                    destination: "/lets-click-ratu-road",
                    permanent: false,
                },
            ]),
        )
        for (const alias of EVENTS_DISCOVERY_REQUIRED_ALIASES) {
            expect(
                rows.some((r) => r.source === `/${alias}` && r.destination.startsWith("/")),
            ).toBe(true)
        }
    })

    it("new-alias redirect helper skips try-photographer (already CREATOR P1-1)", () => {
        const newRows = eventsDiscoveryNewRedirects()
        expect(newRows.every((row) => row.permanent === false)).toBe(true)
        expect(newRows).toHaveLength(EVENTS_DISCOVERY_NEW_ALIASES.length * 2)
        expect(newRows.some((r) => r.source === "/try-photographer")).toBe(false)
        expect(newRows.some((r) => r.source === "/try-events")).toBe(true)
        expect(newRows.some((r) => r.source === "/try-studio")).toBe(true)
        expect(newRows.some((r) => r.source === "/try-photo")).toBe(true)
        expect(newRows.some((r) => r.source === "/events")).toBe(true)
        expect(newRows.some((r) => r.source === "/photo")).toBe(true)
        expect(newRows.some((r) => r.source === "/photographer")).toBe(true)
    })

    it("next.config.mjs ships EVENTS P1-2 redirects and keeps try-photographer + clinic/gym", () => {
        const src = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(src).toMatch(/EVENTS P1-2 discovery aliases/)
        for (const row of eventsDiscoveryNewRedirects()) {
            expect(src).toContain(`source: "${row.source}"`)
            expect(src).toContain(`destination: "${row.destination}"`)
        }
        // try-photographer regress (CREATOR P1-1 block)
        expect(src).toContain('source: "/try-photographer"')
        expect(src).toContain('destination: "/lets-click-ratu-road"')
        expect(src).toContain('source: "/try-clinic"')
        expect(src).toContain('destination: "/jk-sharma-clinic-harmu"')
        expect(src).toContain('source: "/try-gym"')
        expect(src).toContain('destination: "/aura-fitness-ranchi"')
        expect(src).not.toMatch(/destination: "\/try-events"/)
        expect(src).not.toMatch(/destination: "\/try-studio"/)
        expect(src).not.toMatch(/destination: "\/try-photo"/)
    })

    it("discovery module stays redirect-only (no P1-3 menu or P1-4 imagery edits)", () => {
        const discovery = readFileSync(
            join(root, "src/lib/events/discovery-aliases.ts"),
            "utf8",
        )
        expect(discovery).not.toMatch(
            /Book a session|shop-product-imagery|kit-copy|menu-chrome|Founder/,
        )
        expect(discovery).toMatch(/EVENTS \/ PHOTOGRAPHER P1-2/)
        expect(discovery).toMatch(/next-level-events-kanke/)
        expect(discovery).toMatch(/lets-click-ratu-road/)
        const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
        expect(cfg).toContain("CLINIC P1-1")
        expect(cfg).toContain("GYM P1-1")
        expect(cfg).toContain("SALON P1-1")
        expect(cfg).toContain("CREATOR P1-1")
        expect(cfg).toContain("EVENTS P1-2")
    })
})
