import { describe, expect, it } from "vitest"
import {
    browserNotificationOptions,
    nextStaffAlertState,
    shouldPromptBrowserPermission,
    staffAlertsFromFeeds,
} from "@/lib/staff-browser-alerts"

describe("staff browser notification permission", () => {
    it("prompts once on the dashboard when the API is supported and permission is still default", () => {
        expect(shouldPromptBrowserPermission({ supported: true, permission: "default", dismissed: false })).toBe(true)
        expect(shouldPromptBrowserPermission({ supported: true, permission: "default", dismissed: true })).toBe(false)
        expect(shouldPromptBrowserPermission({ supported: true, permission: "granted", dismissed: false })).toBe(false)
        expect(shouldPromptBrowserPermission({ supported: true, permission: "denied", dismissed: false })).toBe(false)
        expect(shouldPromptBrowserPermission({ supported: false, permission: "default", dismissed: false })).toBe(false)
    })
})

describe("staffAlertsFromFeeds", () => {
    it("keeps live chat requests for inbox desks and scopes hotel notices by department", () => {
        const alerts = staffAlertsFromFeeds({
            liveRequests: [
                { id: "c1", visitorName: "Priya", message: "Talk to reception", requestedAt: "2026-09-18T00:00:00.000Z" },
            ],
            hotelNotices: [
                { id: "n-hk", kind: "REQUEST", title: "HOUSEKEEPING · Room 101", body: "Two towels", department: "HOUSEKEEPING", readAt: null, createdAt: "2026-09-18T00:01:00.000Z" },
                { id: "n-fix", kind: "REQUEST", title: "MAINTENANCE · Room 101", body: "AC is broken", department: "MAINTENANCE", readAt: null, createdAt: "2026-09-18T00:02:00.000Z" },
                { id: "n-em", kind: "EMERGENCY", title: "Emergency · Room 101", body: "Help", department: "SECURITY", readAt: null, createdAt: "2026-09-18T00:03:00.000Z" },
            ],
            inboxNotifications: [
                { id: "u1", type: "LIVE_REQUEST", title: "A visitor wants to talk live", body: "Hi", href: "/dashboard/inbox?c=c2", readAt: null, createdAt: "2026-09-18T00:04:00.000Z" },
                { id: "u2", type: "BILLING", title: "Invoice", body: "skip", href: "/dashboard/billing", readAt: null, createdAt: "2026-09-18T00:05:00.000Z" },
            ],
            hotelRole: "HOUSEKEEPING",
            canInbox: false,
        })
        expect(alerts.map((row) => row.id)).toEqual(["notice:n-hk"])
        expect(alerts[0]).toMatchObject({
            kind: "HOTEL_REQUEST",
            href: "/dashboard/requests",
            title: "HOUSEKEEPING · Room 101",
        })
    })

    it("notifies inbox staff about LIVE_REQUEST and skips hotel handoff live duplicates", () => {
        const alerts = staffAlertsFromFeeds({
            liveRequests: [
                { id: "c-hand", visitorName: "Priya", message: "Talk to reception", requestedAt: "2026-09-18T00:00:00.000Z" },
                { id: "c-live", visitorName: "Arun", message: "Need the owner", requestedAt: "2026-09-18T00:01:00.000Z" },
            ],
            hotelNotices: [
                {
                    id: "n-hand",
                    kind: "REQUEST",
                    title: "HANDOFF · Room 101",
                    body: "Talk to reception",
                    department: "RECEPTION",
                    readAt: null,
                    createdAt: "2026-09-18T00:00:00.000Z",
                    conversationId: "c-hand",
                },
            ],
            inboxNotifications: [
                { id: "dup", type: "LIVE_REQUEST", title: "Arun wants to talk live", body: "Need the owner", href: "/dashboard/inbox?c=c-live", readAt: null, createdAt: "2026-09-18T00:01:00.000Z" },
            ],
            hotelRole: "RECEPTION",
            canInbox: true,
        })
        expect(alerts.map((row) => row.id)).toEqual(["notice:n-hand", "live:c-live"])
        expect(alerts.find((row) => row.id === "live:c-live")).toMatchObject({
            kind: "LIVE_REQUEST",
            href: "/dashboard/inbox?c=c-live",
            title: "Arun wants to talk live",
        })
    })

    it("does not emit guest-facing alerts and ignores already-read rows", () => {
        const alerts = staffAlertsFromFeeds({
            liveRequests: [],
            hotelNotices: [
                { id: "read", kind: "EMERGENCY", title: "Emergency · Room 102", body: "old", department: "SECURITY", readAt: "2026-09-18T00:00:00.000Z", createdAt: "2026-09-17T00:00:00.000Z" },
            ],
            inboxNotifications: [
                { id: "read-n", type: "LIVE_REQUEST", title: "old live", body: "x", href: "/dashboard/inbox?c=old", readAt: "2026-09-18T00:00:00.000Z", createdAt: "2026-09-17T00:00:00.000Z" },
            ],
            hotelRole: "OWNER",
            canInbox: true,
        })
        expect(alerts).toEqual([])
    })
})

describe("nextStaffAlertState", () => {
    it("baselines the first poll so opening the dashboard does not replay old alerts", () => {
        const first = nextStaffAlertState({ primed: false, seenIds: [] }, [
            { id: "notice:n1", kind: "HOTEL_REQUEST", title: "Towels", body: "two", href: "/dashboard/requests", tag: "notice:n1", createdAt: "t0" },
        ])
        expect(first.toNotify).toEqual([])
        expect(first.primed).toBe(true)
        const second = nextStaffAlertState(first, [
            { id: "notice:n1", kind: "HOTEL_REQUEST", title: "Towels", body: "two", href: "/dashboard/requests", tag: "notice:n1", createdAt: "t0" },
            { id: "live:c1", kind: "LIVE_REQUEST", title: "Priya wants to talk live", body: "Hi", href: "/dashboard/inbox?c=c1", tag: "live:c1", createdAt: "t1" },
        ])
        expect(second.toNotify.map((row) => row.id)).toEqual(["live:c1"])
    })
})

describe("browserNotificationOptions", () => {
    it("uses a stable tag and holds emergency alerts on screen", () => {
        expect(browserNotificationOptions({
            id: "notice:n-em",
            kind: "HOTEL_EMERGENCY",
            title: "Emergency · Room 101",
            body: "Help",
            href: "/dashboard/requests",
            tag: "notice:n-em",
            createdAt: "t",
        })).toEqual({
            title: "Emergency · Room 101",
            body: "Help",
            tag: "notice:n-em",
            requireInteraction: true,
        })
        expect(browserNotificationOptions({
            id: "live:c1",
            kind: "LIVE_REQUEST",
            title: "Arun wants to talk live",
            body: "Need the owner",
            href: "/dashboard/inbox?c=c1",
            tag: "live:c1",
            createdAt: "t",
        }).requireInteraction).toBe(false)
    })
})
