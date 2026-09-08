import {
    asPermissionId,
    asRoleId,
    KNOWN_ROLES,
    PERMISSION_KEYS,
    type KnownRole,
    type Permission,
    type PermissionKey,
    type Role,
} from "./types"

const ALL_PERMISSIONS = Object.freeze([...PERMISSION_KEYS]) as readonly PermissionKey[]
const NO_PERMISSIONS = Object.freeze([]) as readonly PermissionKey[]

function freezePermissions(permissions: readonly PermissionKey[]): readonly PermissionKey[] {
    return Object.freeze([...permissions])
}

export const ROLE_PERMISSION_MATRIX: Readonly<Record<KnownRole, readonly PermissionKey[]>> = Object.freeze({
    OWNER: ALL_PERMISSIONS,
    ADMIN: freezePermissions(ALL_PERMISSIONS.filter((permission) => permission !== "workspace.delete")),
    MANAGER: freezePermissions([
        "workspace.read",
        "location.read",
        "location.update",
        "membership.read",
        "membership.invite",
        "membership.update",
        "profile.read",
        "profile.update",
        "booking.read",
        "booking.manage",
        "order.read",
        "order.manage",
        "audit.read",
    ]),
    STAFF: freezePermissions([
        "workspace.read",
        "location.read",
        "membership.read",
        "profile.read",
        "booking.read",
        "booking.manage",
        "order.read",
        "order.manage",
    ]),
    VIEWER: freezePermissions([
        "workspace.read",
        "location.read",
        "profile.read",
        "booking.read",
        "order.read",
    ]),
})

const descriptions: Readonly<Record<PermissionKey, string>> = {
    "workspace.read": "Read workspace identity and settings",
    "workspace.update": "Update workspace identity and settings",
    "workspace.delete": "Delete the workspace",
    "location.read": "Read locations in the workspace",
    "location.create": "Create a location",
    "location.update": "Update a location",
    "location.delete": "Delete a location",
    "membership.read": "Read workspace memberships",
    "membership.invite": "Invite a workspace member",
    "membership.update": "Change membership role or location access",
    "membership.remove": "Remove a workspace member",
    "profile.read": "Read tenant-owned profiles",
    "profile.update": "Update tenant-owned profiles",
    "booking.read": "Read tenant-owned bookings",
    "booking.manage": "Create or change tenant-owned bookings",
    "order.read": "Read tenant-owned orders",
    "order.manage": "Create or change tenant-owned orders",
    "audit.read": "Read workspace audit events",
}

export const permissionCatalog: readonly Permission[] = Object.freeze(
    PERMISSION_KEYS.map((key) => Object.freeze({
        id: asPermissionId(`permission:${key}`),
        key,
        description: descriptions[key],
    })),
)

export type RoleResolution = Readonly<{
    input: string | null
    role: KnownRole | null
    permissions: readonly PermissionKey[]
    deniedByDefault: boolean
}>

export function isKnownRole(value: string): value is KnownRole {
    return (KNOWN_ROLES as readonly string[]).includes(value)
}

/** Total resolver: every input returns a concrete permission closure. */
export function resolveRolePermissions(input: unknown): RoleResolution {
    const raw = typeof input === "string" ? input.trim() : ""
    const normalized = raw.toUpperCase()
    if (!normalized || !isKnownRole(normalized)) {
        return Object.freeze({
            input: raw || null,
            role: null,
            permissions: NO_PERMISSIONS,
            deniedByDefault: true,
        })
    }

    return Object.freeze({
        input: raw,
        role: normalized,
        permissions: ROLE_PERMISSION_MATRIX[normalized],
        deniedByDefault: false,
    })
}

export function hasPermission(input: unknown, permission: PermissionKey): boolean {
    return resolveRolePermissions(input).permissions.includes(permission)
}

export function roleContract(input: unknown): Role | null {
    const resolution = resolveRolePermissions(input)
    if (!resolution.role) return null
    return Object.freeze({
        id: asRoleId(`role:${resolution.role.toLowerCase()}`),
        key: resolution.role,
        permissions: resolution.permissions,
    })
}
