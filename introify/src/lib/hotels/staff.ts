export const HOTEL_STAFF_ROLES = [
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
] as const

export type HotelStaffRole = (typeof HOTEL_STAFF_ROLES)[number]

export const HOTEL_DESK_SURFACES = [
    "home",
    "requests",
    "rooms",
    "qr",
    "restaurants",
    "services",
    "staff",
    "knowledge",
    "analytics",
    "inbox",
    "profile",
    "billing",
    "group",
    "integrations",
    "edit",
] as const

export type HotelDeskSurface = (typeof HOTEL_DESK_SURFACES)[number]

export type HotelStaffAssignment = { userId: string; role: HotelStaffRole }

const ROLE_SET = new Set<string>(HOTEL_STAFF_ROLES)

export function isHotelStaffRole(value: unknown): value is HotelStaffRole {
    return typeof value === "string" && ROLE_SET.has(value)
}

const OPEN: Record<HotelStaffRole, readonly HotelDeskSurface[]> = {
    OWNER: HOTEL_DESK_SURFACES,
    GM: HOTEL_DESK_SURFACES.filter((surface) => surface !== "billing"),
    FRONT_OFFICE: ["home", "requests", "rooms", "qr", "restaurants", "services", "knowledge", "analytics", "inbox"],
    RECEPTION: ["home", "requests", "rooms", "inbox"],
    HOUSEKEEPING: ["home", "requests"],
    MAINTENANCE: ["home", "requests"],
    FNB: ["home", "restaurants"],
    SPA: ["home", "requests"],
    CONCIERGE: ["home", "requests", "restaurants", "knowledge", "inbox"],
    TRANSPORT: ["home", "requests"],
    SECURITY: ["home", "requests"],
    ANALYST: ["home", "knowledge", "analytics"],
}

const WRITE: Record<HotelStaffRole, readonly HotelDeskSurface[]> = {
    OWNER: ["home", "requests", "rooms", "qr", "restaurants", "services", "staff", "knowledge", "inbox", "profile", "billing", "group", "integrations", "edit"],
    GM: ["home", "requests", "rooms", "qr", "restaurants", "services", "staff", "knowledge", "inbox", "profile", "group", "integrations", "edit"],
    FRONT_OFFICE: ["requests", "rooms", "qr", "knowledge", "inbox"],
    RECEPTION: ["requests", "rooms", "inbox"],
    HOUSEKEEPING: ["requests"],
    MAINTENANCE: ["requests"],
    FNB: ["restaurants"],
    SPA: ["requests"],
    CONCIERGE: ["requests", "inbox"],
    TRANSPORT: ["requests"],
    SECURITY: ["requests"],
    ANALYST: [],
}

const DESKS: Record<HotelStaffRole, readonly string[] | null> = {
    OWNER: null,
    GM: null,
    FRONT_OFFICE: null,
    CONCIERGE: null,
    RECEPTION: ["RECEPTION"],
    HOUSEKEEPING: ["HOUSEKEEPING"],
    MAINTENANCE: ["MAINTENANCE"],
    SPA: ["SPA"],
    TRANSPORT: ["TRANSPORT"],
    SECURITY: ["SECURITY"],
    FNB: [],
    ANALYST: [],
}

export function hotelCanOpen(role: HotelStaffRole, surface: HotelDeskSurface): boolean {
    return OPEN[role].includes(surface)
}

export function hotelCanWrite(role: HotelStaffRole, surface: HotelDeskSurface): boolean {
    return WRITE[role].includes(surface)
}

export function hotelDesksForRole(role: HotelStaffRole): readonly string[] | null {
    return DESKS[role]
}

export function mapWorkspaceRoleToHotel(input: {
    workspaceRole?: string | null
    owner?: boolean
    assigned?: HotelStaffRole | null
}): HotelStaffRole {
    if (input.owner || input.workspaceRole === "OWNER") return "OWNER"
    if (input.assigned && isHotelStaffRole(input.assigned) && input.assigned !== "OWNER") return input.assigned
    if (input.workspaceRole === "ADMIN") return "GM"
    if (input.workspaceRole === "MANAGER") return "FRONT_OFFICE"
    if (input.workspaceRole === "VIEWER") return "ANALYST"
    return "RECEPTION"
}

export function parseHotelStaffJson(raw?: string | null): HotelStaffAssignment[] {
    try {
        const value = JSON.parse(raw || "[]")
        if (!Array.isArray(value)) return []
        const seen = new Set<string>()
        const rows: HotelStaffAssignment[] = []
        for (const item of value) {
            if (!item || typeof item !== "object") continue
            const userId = typeof item.userId === "string" ? item.userId.trim() : ""
            const role = item.role
            if (!userId || !isHotelStaffRole(role) || seen.has(userId)) continue
            seen.add(userId)
            rows.push({ userId, role })
        }
        return rows
    } catch {
        return []
    }
}

export function resolveHotelStaffRole(input: {
    userId: string
    profileUserId: string
    workspaceRole?: string | null
    owner?: boolean
    assignments?: HotelStaffAssignment[]
}): HotelStaffRole {
    const assigned = input.assignments?.find((row) => row.userId === input.userId)?.role || null
    return mapWorkspaceRoleToHotel({
        workspaceRole: input.workspaceRole,
        owner: Boolean(input.owner) || input.userId === input.profileUserId,
        assigned,
    })
}

const HREF_SURFACES: Array<[string, HotelDeskSurface]> = [
    ["/dashboard/requests", "requests"],
    ["/dashboard/rooms", "rooms"],
    ["/dashboard/qr", "qr"],
    ["/dashboard/restaurants", "restaurants"],
    ["/dashboard/services", "services"],
    ["/dashboard/team", "staff"],
    ["/dashboard/knowledge", "knowledge"],
    ["/dashboard/analytics", "analytics"],
    ["/dashboard/inbox", "inbox"],
    ["/dashboard/conversations", "inbox"],
    ["/dashboard/profile", "profile"],
    ["/dashboard/content", "profile"],
    ["/dashboard/import", "profile"],
    ["/dashboard/links", "profile"],
    ["/dashboard/billing", "billing"],
    ["/dashboard/group", "group"],
    ["/dashboard/integrations", "integrations"],
]

export function hotelHrefSurface(pathname: string): HotelDeskSurface | null {
    if (pathname === "/dashboard") return "home"
    for (const [prefix, surface] of HREF_SURFACES) {
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return surface
    }
    return null
}

export function hotelPathAllowed(pathname: string, role: HotelStaffRole): boolean {
    // Billing team stays reachable from the mobile drawer even when the Hotel
    // "Staff" nav item (same path) is hidden for a department desk.
    if (pathname === "/dashboard/team" || pathname.startsWith("/dashboard/team/")) return true
    const surface = hotelHrefSurface(pathname)
    if (!surface) return true
    return hotelCanOpen(role, surface)
}

export function hotelStaffLabel(role: HotelStaffRole): string {
    if (role === "FNB") return "F&B"
    if (role === "FRONT_OFFICE") return "Front Office"
    if (role === "GM") return "GM"
    return role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ")
}
