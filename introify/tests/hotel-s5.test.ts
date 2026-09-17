import { describe, expect, it } from "vitest"
import { visibleNavItems } from "@/components/dashboard/sidebar"
import {
    HOTEL_STAFF_ROLES,
    hotelCanOpen,
    hotelCanWrite,
    hotelDesksForRole,
    hotelHidesIntroifyChrome,
    hotelNotifyPlan,
    hotelSetupChecklist,
    hotelConciergeIsLive,
    hotelWebhookReady,
    listHotelGroupMembers,
    mapWorkspaceRoleToHotel,
    parseHotelGroupJson,
    parseHotelIntegrations,
    parseHotelStaffJson,
    resolveHotelStaffRole,
    filterHotelNotices,
    hotelGuestPathsUnchanged,
    HOTEL_INTEGRATION_ADAPTERS,
} from "@/lib/hotels"
import { hotelQrPath, hotelRoomPath } from "@/lib/hotels"
import { TRY_HOTEL, TRY_HOTEL_S5 } from "@/lib/hotels/try-hotel-seed"

describe("hotel S5 staff roles", () => {
    it("lists the twelve hotel department roles", () => {
        expect([...HOTEL_STAFF_ROLES]).toEqual([
            "OWNER",
            "GM",
            "FRONT_OFFICE",
            "RECEPTION",
            "HOUSEKEEPING",
            "MAINTENANCE",
            "FNB",
            "SPA",
            "CONCIERGE",
            "TRANSPORT",
            "SECURITY",
            "ANALYST",
        ])
    })

    it("maps existing workspace access onto hotel desks", () => {
        expect(mapWorkspaceRoleToHotel({ workspaceRole: "OWNER", owner: true })).toBe("OWNER")
        expect(mapWorkspaceRoleToHotel({ workspaceRole: "ADMIN" })).toBe("GM")
        expect(mapWorkspaceRoleToHotel({ workspaceRole: "MANAGER" })).toBe("FRONT_OFFICE")
        expect(mapWorkspaceRoleToHotel({ workspaceRole: "STAFF" })).toBe("RECEPTION")
        expect(mapWorkspaceRoleToHotel({ workspaceRole: "STAFF", assigned: "HOUSEKEEPING" })).toBe("HOUSEKEEPING")
        expect(mapWorkspaceRoleToHotel({ workspaceRole: "VIEWER" })).toBe("ANALYST")
        expect(resolveHotelStaffRole({
            userId: "owner-1",
            profileUserId: "owner-1",
            workspaceRole: "STAFF",
            owner: true,
            assignments: [{ userId: "owner-1", role: "HOUSEKEEPING" }],
        })).toBe("OWNER")
        expect(resolveHotelStaffRole({
            userId: "hk-1",
            profileUserId: "owner-1",
            workspaceRole: "STAFF",
            owner: false,
            assignments: [{ userId: "hk-1", role: "HOUSEKEEPING" }],
        })).toBe("HOUSEKEEPING")
        expect(parseHotelStaffJson('[{"userId":"hk-1","role":"HOUSEKEEPING"}]')).toEqual([
            { userId: "hk-1", role: "HOUSEKEEPING" },
        ])
        expect(parseHotelStaffJson("not-json")).toEqual([])
    })

    it("gates Requests, Knowledge, QR, Analytics, and edit by role", () => {
        expect(hotelCanOpen("OWNER", "requests")).toBe(true)
        expect(hotelCanOpen("OWNER", "knowledge")).toBe(true)
        expect(hotelCanOpen("OWNER", "qr")).toBe(true)
        expect(hotelCanOpen("OWNER", "analytics")).toBe(true)
        expect(hotelCanWrite("OWNER", "edit")).toBe(true)
        expect(hotelCanOpen("HOUSEKEEPING", "requests")).toBe(true)
        expect(hotelCanOpen("HOUSEKEEPING", "qr")).toBe(false)
        expect(hotelCanOpen("HOUSEKEEPING", "knowledge")).toBe(false)
        expect(hotelCanOpen("HOUSEKEEPING", "analytics")).toBe(false)
        expect(hotelCanWrite("HOUSEKEEPING", "edit")).toBe(false)
        expect(hotelCanOpen("ANALYST", "analytics")).toBe(true)
        expect(hotelCanOpen("ANALYST", "knowledge")).toBe(true)
        expect(hotelCanWrite("ANALYST", "knowledge")).toBe(false)
        expect(hotelCanOpen("ANALYST", "requests")).toBe(false)
        expect(hotelCanOpen("GM", "billing")).toBe(false)
        expect(hotelCanOpen("OWNER", "billing")).toBe(true)
        expect(hotelCanOpen("SPA", "requests")).toBe(true)
        expect(hotelCanOpen("FNB", "restaurants")).toBe(true)
        expect(hotelCanOpen("FNB", "requests")).toBe(false)
        expect(hotelDesksForRole("HOUSEKEEPING")).toEqual(["HOUSEKEEPING"])
        expect(hotelDesksForRole("SECURITY")).toEqual(["SECURITY"])
        expect(hotelDesksForRole("OWNER")).toBeNull()
        expect(hotelDesksForRole("GM")).toBeNull()
        expect(hotelDesksForRole("FRONT_OFFICE")).toBeNull()
        expect(hotelDesksForRole("CONCIERGE")).toBeNull()
    })

    it("hides QR, Analytics, Group, and Billing from housekeeping nav", () => {
        const owner = visibleNavItems("HOTEL").map((item) => item.name)
        expect(owner).toEqual(expect.arrayContaining(["Requests", "Knowledge", "QR & Print", "Analytics", "Group", "Integrations", "Billing"]))
        const hk = visibleNavItems("HOTEL", null, "HOUSEKEEPING").map((item) => item.name)
        expect(hk).toContain("Requests")
        expect(hk).toContain("Home")
        expect(hk).not.toContain("QR & Print")
        expect(hk).not.toContain("Analytics")
        expect(hk).not.toContain("Group")
        expect(hk).not.toContain("Integrations")
        expect(hk).not.toContain("Billing")
        expect(hk).not.toContain("Knowledge")
        const analyst = visibleNavItems("HOTEL", null, "ANALYST").map((item) => item.name)
        expect(analyst).toEqual(expect.arrayContaining(["Home", "Knowledge", "Analytics"]))
        expect(analyst).not.toContain("Requests")
        expect(analyst).not.toContain("QR & Print")
    })
})

describe("hotel S5 notifications", () => {
    it("scopes in-app notices to the request department and stubs email/SMS/WhatsApp", () => {
        const plan = hotelNotifyPlan({
            department: "HOUSEKEEPING",
            type: "HOUSEKEEPING",
            ownerEmail: "gm@haven.test",
            emailConfigured: false,
        })
        expect(plan.map((step) => step.channel)).toEqual(["in_app", "email", "sms", "whatsapp"])
        expect(plan.find((step) => step.channel === "in_app")).toMatchObject({
            department: "HOUSEKEEPING",
            stub: false,
        })
        expect(plan.find((step) => step.channel === "email")).toMatchObject({
            to: "gm@haven.test",
            stub: true,
            reason: "EMAIL_NOT_CONFIGURED",
        })
        expect(plan.find((step) => step.channel === "sms")).toMatchObject({ stub: true, reason: "interface-only" })
        expect(plan.find((step) => step.channel === "whatsapp")).toMatchObject({ stub: true, reason: "interface-only" })
        const liveEmail = hotelNotifyPlan({
            department: "MAINTENANCE",
            type: "MAINTENANCE",
            ownerEmail: "gm@haven.test",
            emailConfigured: true,
        })
        expect(liveEmail.find((step) => step.channel === "email")).toMatchObject({ stub: false, to: "gm@haven.test" })
        expect(filterHotelNotices([
            { id: "1", department: "HOUSEKEEPING", kind: "REQUEST" },
            { id: "2", department: "MAINTENANCE", kind: "REQUEST" },
            { id: "3", department: "SECURITY", kind: "EMERGENCY" },
        ], "HOUSEKEEPING").map((row) => row.id)).toEqual(["1"])
        expect(filterHotelNotices([
            { id: "1", department: "HOUSEKEEPING", kind: "REQUEST" },
            { id: "3", department: "SECURITY", kind: "EMERGENCY" },
        ], "GM").map((row) => row.id)).toEqual(["1", "3"])
    })
})

describe("hotel S5 groups", () => {
    it("lists linked hotel profiles for a corporate group stub", () => {
        const group = parseHotelGroupJson(JSON.stringify({
            name: "Haven Collection",
            hotelProfileIds: ["hotel-a", "hotel-b"],
        }))
        expect(group).toEqual({ name: "Haven Collection", hotelProfileIds: ["hotel-a", "hotel-b"] })
        const hotels = [
            { id: "hotel-a", slug: "try-hotel", displayName: "Haven Hinoo", roleTemplate: "HOTEL" },
            { id: "hotel-b", slug: "haven-lake", displayName: "Haven Lake", roleTemplate: "HOTEL" },
            { id: "cafe", slug: "littlehours", displayName: "Little Hours", roleTemplate: "RESTAURANT" },
        ]
        expect(listHotelGroupMembers(group, hotels).map((row) => row.slug)).toEqual(["try-hotel", "haven-lake"])
        const empty = parseHotelGroupJson("{}")
        expect(listHotelGroupMembers(empty, hotels).map((row) => row.slug)).toEqual(["try-hotel", "haven-lake"])
        expect(listHotelGroupMembers(empty, hotels).every((row) => row.roleTemplate === "HOTEL")).toBe(true)
        expect(TRY_HOTEL_S5.groupName).toBe("Haven Collection")
    })
})

describe("hotel S5 white label", () => {
    it("hides Introify chrome on the guest concierge only when the paid flag is on", () => {
        expect(hotelHidesIntroifyChrome({ entitled: false, hotelWhiteLabel: true, personalityConfig: '{"hideIntroifyBrand":true}' })).toBe(false)
        expect(hotelHidesIntroifyChrome({ entitled: true, hotelWhiteLabel: false, personalityConfig: "{}" })).toBe(false)
        expect(hotelHidesIntroifyChrome({ entitled: true, hotelWhiteLabel: true, personalityConfig: "{}" })).toBe(true)
        expect(hotelHidesIntroifyChrome({ entitled: true, hotelWhiteLabel: false, personalityConfig: '{"hideIntroifyBrand":true}' })).toBe(true)
        expect(hotelGuestPathsUnchanged()).toEqual({
            room: hotelRoomPath("try-hotel", "101"),
            qr: hotelQrPath("hRoom101"),
        })
        expect(hotelRoomPath("try-hotel", "101")).toBe("/try-hotel/r/101")
        expect(hotelQrPath("hRoom101")).toBe("/q/hRoom101")
    })
})

describe("hotel S5 integrations", () => {
    it("exposes PMS, POS, WhatsApp, and webhook adapters without live keys", () => {
        expect(HOTEL_INTEGRATION_ADAPTERS.map((row) => row.id)).toEqual(["pms", "pos", "whatsapp", "webhook"])
        expect(HOTEL_INTEGRATION_ADAPTERS.every((row) => row.status === "stub" || row.status === "placeholder")).toBe(true)
        expect(parseHotelIntegrations("{}")).toEqual({ pms: "stub", pos: "stub", whatsapp: "stub", webhook: "placeholder" })
        expect(hotelWebhookReady(null)).toEqual({ ready: false, reason: "not_configured" })
        expect(hotelWebhookReady("https://example.test/hooks/hotel")).toEqual({ ready: true, reason: "placeholder" })
        expect(hotelWebhookReady("https://api.mews.com/secret-key")).toMatchObject({ ready: false })
        expect(JSON.stringify(HOTEL_INTEGRATION_ADAPTERS)).not.toMatch(/sk_live|Bearer |whatsapp.*token|pms_password/i)
    })
})

describe("hotel S5 setup win", () => {
    it("treats concierge as live only after rooms, restaurants, services, QRs, and a public page", () => {
        const partial = hotelSetupChecklist({
            rooms: 3,
            restaurants: 1,
            services: ["housekeeping"],
            qrs: 0,
            isPublic: true,
            liveHref: "/try-hotel",
        })
        expect(partial.map((row) => row.id)).toEqual(["rooms", "restaurants", "services", "qrs", "live"])
        expect(partial.find((row) => row.id === "qrs")?.ok).toBe(false)
        expect(partial.find((row) => row.id === "live")?.ok).toBe(false)
        expect(hotelConciergeIsLive(partial)).toBe(false)
        const ready = hotelSetupChecklist({
            rooms: 3,
            restaurants: 1,
            services: ["housekeeping", "spa"],
            qrs: 4,
            isPublic: true,
            liveHref: "/try-hotel",
        })
        expect(ready.every((row) => row.ok)).toBe(true)
        expect(hotelConciergeIsLive(ready)).toBe(true)
        expect(TRY_HOTEL.slug).toBe("try-hotel")
        expect(TRY_HOTEL_S5.staffRoles).toEqual(HOTEL_STAFF_ROLES)
    })
})
