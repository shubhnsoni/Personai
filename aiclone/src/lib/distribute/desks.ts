/**
 * PersonaLink distributor desks — membership-gated seats.
 *
 * OWNER / ADMIN / MANAGER → admin desk (create + approve + dispatch + bill).
 * SALES / WAREHOUSE / ACCOUNTS → that desk only (MembershipRole enum).
 * STAFF → desk from personalityConfig staffDesk|distroDesk|desk, else denied.
 * VIEWER → same hint, else read-only.
 *
 * Invite/role assign: admin desk uses assignDistroDesk on Orders
 * (Membership.role SALES | WAREHOUSE | ACCOUNTS | ADMIN). OWNER stays
 * the workspace creator. Gate UI from the membership seat — never a
 * client preview / localStorage desk switcher.
 */

export type DistroDesk = "admin" | "sales" | "warehouse" | "accounts"

export type DistroDeskPermissions = {
    desk: DistroDesk | null
    canCreate: boolean
    canApprove: boolean
    canWarehouse: boolean
    canAccounts: boolean
    canInvite: boolean
    canRead: boolean
}

const BY_DESK: Record<DistroDesk, Omit<DistroDeskPermissions, "desk">> = {
    admin: { canCreate: true, canApprove: true, canWarehouse: true, canAccounts: true, canInvite: true, canRead: true },
    sales: { canCreate: true, canApprove: false, canWarehouse: false, canAccounts: false, canInvite: false, canRead: true },
    warehouse: { canCreate: false, canApprove: false, canWarehouse: true, canAccounts: false, canInvite: false, canRead: true },
    accounts: { canCreate: false, canApprove: false, canWarehouse: false, canAccounts: true, canInvite: false, canRead: true },
}

const READ_ONLY: DistroDeskPermissions = {
    desk: null,
    canCreate: false,
    canApprove: false,
    canWarehouse: false,
    canAccounts: false,
    canInvite: false,
    canRead: true,
}

const DENIED: DistroDeskPermissions = {
    desk: null,
    canCreate: false,
    canApprove: false,
    canWarehouse: false,
    canAccounts: false,
    canInvite: false,
    canRead: false,
}

function asDesk(value: string | null | undefined): DistroDesk | null {
    const d = (value || "").trim().toLowerCase()
    if (d === "admin" || d === "sales" || d === "warehouse" || d === "accounts") return d
    return null
}

/** Pull staff desk hint from Profile.personalityConfig JSON. */
export function parseStaffDeskFromPersonalityConfig(raw?: string | null): DistroDesk | null {
    if (!raw) return null
    try {
        const o = JSON.parse(raw) as Record<string, unknown>
        if (!o || typeof o !== "object") return null
        const candidate = o.staffDesk ?? o.distroDesk ?? o.desk
        return typeof candidate === "string" ? asDesk(candidate) : null
    } catch {
        return null
    }
}

function resolveStaffHint(staffDeskOrPersonality?: string | null): DistroDesk | null {
    if (!staffDeskOrPersonality) return null
    const direct = asDesk(staffDeskOrPersonality)
    if (direct) return direct
    if (staffDeskOrPersonality.trim().startsWith("{")) {
        return parseStaffDeskFromPersonalityConfig(staffDeskOrPersonality)
    }
    return null
}

/**
 * Map Membership.role (+ optional personalityConfig / desk hint) → DistroDesk.
 * Null = no mutation seat (viewer without desk, unknown role, unassigned staff).
 */
export function membershipRoleToDesk(
    role: string | null | undefined,
    staffDeskOrPersonality?: string | null,
): DistroDesk | null {
    const r = (role || "").trim().toUpperCase()
    if (r === "OWNER" || r === "ADMIN" || r === "MANAGER") return "admin"
    if (r === "SALES") return "sales"
    if (r === "WAREHOUSE") return "warehouse"
    if (r === "ACCOUNTS") return "accounts"
    if (r === "STAFF" || r === "VIEWER") return resolveStaffHint(staffDeskOrPersonality)
    return null
}

/** Resolve full permission flags for a membership role (+ optional staff desk hint). */
export function resolveDistroDeskPermissions(
    role: string | null | undefined,
    staffDeskOrPersonality?: string | null,
): DistroDeskPermissions {
    const r = (role || "").trim().toUpperCase()
    const hint = resolveStaffHint(staffDeskOrPersonality)
    const desk = membershipRoleToDesk(role, hint)

    if (!desk) {
        if (r === "VIEWER") return READ_ONLY
        return DENIED
    }
    return { desk, ...BY_DESK[desk] }
}


export const DISTRO_ASSIGNABLE_DESKS = ["admin", "sales", "warehouse", "accounts"] as const
export type DistroAssignableDesk = (typeof DISTRO_ASSIGNABLE_DESKS)[number]

/** MembershipRole written when an admin assigns a desk (OWNER is never assigned here). */
export function membershipRoleForDesk(desk: DistroAssignableDesk): "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS" {
    switch (desk) {
        case "admin":
            return "ADMIN"
        case "sales":
            return "SALES"
        case "warehouse":
            return "WAREHOUSE"
        case "accounts":
            return "ACCOUNTS"
    }
}

export function assertDistroPermission(
    perms: DistroDeskPermissions,
    action: "create" | "approve" | "warehouse" | "accounts" | "read",
) {
    const ok =
        action === "read" ? perms.canRead
            : action === "create" ? perms.canCreate
                : action === "approve" ? perms.canApprove
                    : action === "warehouse" ? perms.canWarehouse
                        : perms.canAccounts
    if (!ok) {
        throw new Error(
            action === "read" ? "No desk access"
                : action === "create" ? "Sales desk required to place orders"
                    : action === "approve" ? "Admin desk required to approve"
                        : action === "warehouse" ? "Warehouse desk required to dispatch"
                            : "Accounts desk required to bill",
        )
    }
}
