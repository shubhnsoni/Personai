import { filterHotelNotices, hotelCanOpen, type HotelStaffRole } from "@/lib/hotels"

export const BROWSER_ALERTS_DISMISSED_KEY = "introify.staff-browser-alerts.dismissed"

export type StaffAlertKind = "LIVE_REQUEST" | "HOTEL_EMERGENCY" | "HOTEL_REQUEST"

export type StaffAlert = {
    id: string
    kind: StaffAlertKind
    title: string
    body: string
    href: string
    tag: string
    createdAt: string
}

export type StaffAlertCursor = {
    primed: boolean
    seenIds: readonly string[]
}

export type LiveRequestFeedRow = {
    id: string
    visitorName: string
    message: string
    requestedAt: string | null
}

export type HotelNoticeFeedRow = {
    id: string
    kind: string
    title: string
    body: string
    department?: string | null
    readAt: string | null
    createdAt: string
    conversationId?: string | null
}

export type InboxNotificationFeedRow = {
    id: string
    type: string
    title: string
    body: string | null
    href: string | null
    readAt: string | null
    createdAt: string
}

const STAFF_NOTIFICATION_TYPES = new Set(["LIVE_REQUEST", "HOTEL_REQUEST", "HOTEL_EMERGENCY"])

export function shouldPromptBrowserPermission(input: {
    supported: boolean
    permission: NotificationPermission
    dismissed: boolean
}): boolean {
    return input.supported && input.permission === "default" && !input.dismissed
}

export function staffInboxAllowed(hotelRole: HotelStaffRole | null, workspaceInbox: boolean): boolean {
    if (hotelRole) return hotelCanOpen(hotelRole, "inbox")
    return workspaceInbox
}

function kindFromNotice(kind: string): StaffAlertKind {
    return kind === "EMERGENCY" ? "HOTEL_EMERGENCY" : "HOTEL_REQUEST"
}

function kindFromNotification(type: string): StaffAlertKind | null {
    if (type === "LIVE_REQUEST") return "LIVE_REQUEST"
    if (type === "HOTEL_EMERGENCY") return "HOTEL_EMERGENCY"
    if (type === "HOTEL_REQUEST") return "HOTEL_REQUEST"
    return null
}

export function staffAlertsFromFeeds(input: {
    liveRequests: readonly LiveRequestFeedRow[]
    hotelNotices: readonly HotelNoticeFeedRow[]
    inboxNotifications: readonly InboxNotificationFeedRow[]
    hotelRole: HotelStaffRole | null
    canInbox: boolean
}): StaffAlert[] {
    const alerts: StaffAlert[] = []
    const keys = new Set<string>()
    const add = (alert: StaffAlert, extraKeys: string[] = []) => {
        const all = [alert.id, ...extraKeys]
        if (all.some((key) => keys.has(key))) return
        for (const key of all) keys.add(key)
        alerts.push(alert)
    }

    const notices = input.hotelRole
        ? filterHotelNotices(input.hotelNotices, input.hotelRole)
        : []
    for (const row of notices) {
        if (row.readAt) continue
        const id = `notice:${row.id}`
        add({
            id,
            kind: kindFromNotice(row.kind),
            title: row.title,
            body: row.body,
            href: "/dashboard/requests",
            tag: id,
            createdAt: row.createdAt,
        }, row.conversationId ? [`live:${row.conversationId}`] : [])
    }

    if (input.canInbox) {
        for (const row of input.liveRequests) {
            const href = `/dashboard/inbox?c=${row.id}`
            const id = `live:${row.id}`
            add({
                id,
                kind: "LIVE_REQUEST",
                title: `${row.visitorName} wants to talk live`,
                body: row.message,
                href,
                tag: id,
                createdAt: row.requestedAt || "",
            }, [`href:${href}`])
        }
        for (const row of input.inboxNotifications) {
            if (row.readAt) continue
            if (!STAFF_NOTIFICATION_TYPES.has(row.type)) continue
            const kind = kindFromNotification(row.type)
            if (!kind) continue
            const href = row.href || "/dashboard/inbox"
            const id = `notif:${row.id}`
            add({
                id,
                kind,
                title: row.title,
                body: row.body || "",
                href,
                tag: id,
                createdAt: row.createdAt,
            }, [`href:${href}`])
        }
    }

    return alerts
}

export function nextStaffAlertState(prev: StaffAlertCursor, incoming: readonly StaffAlert[]): {
    primed: true
    seenIds: string[]
    toNotify: StaffAlert[]
} {
    if (!prev.primed) {
        return {
            primed: true,
            seenIds: incoming.map((row) => row.id),
            toNotify: [],
        }
    }
    const seen = new Set(prev.seenIds)
    const toNotify = incoming.filter((row) => !seen.has(row.id))
    for (const row of incoming) seen.add(row.id)
    return { primed: true, seenIds: [...seen], toNotify }
}

export function browserNotificationOptions(alert: StaffAlert): {
    title: string
    body: string
    tag: string
    requireInteraction: boolean
} {
    return {
        title: alert.title,
        body: alert.body,
        tag: alert.tag,
        requireInteraction: alert.kind === "HOTEL_EMERGENCY",
    }
}
