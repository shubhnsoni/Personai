declare const tenancyBrand: unique symbol

export type Brand<Value, Name extends string> = Value & {
    readonly [tenancyBrand]: Name
}

export type WorkspaceId = Brand<string, "WorkspaceId">
export type LocationId = Brand<string, "LocationId">
export type MembershipId = Brand<string, "MembershipId">
export type RoleId = Brand<string, "RoleId">
export type PermissionId = Brand<string, "PermissionId">

export const KNOWN_ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"] as const
export type KnownRole = (typeof KNOWN_ROLES)[number]

export const PERMISSION_KEYS = [
    "workspace.read",
    "workspace.update",
    "workspace.delete",
    "location.read",
    "location.create",
    "location.update",
    "location.delete",
    "membership.read",
    "membership.invite",
    "membership.update",
    "membership.remove",
    "profile.read",
    "profile.update",
    "booking.read",
    "booking.manage",
    "order.read",
    "order.manage",
    "audit.read",
] as const
export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export type Workspace = Readonly<{
    id: WorkspaceId
    name: string
    legacyProfileId: string | null
}>

export type Location = Readonly<{
    id: LocationId
    workspaceId: WorkspaceId
    name: string
    legacyProfileId: string | null
}>

export type Membership = Readonly<{
    id: MembershipId
    workspaceId: WorkspaceId
    userId: string
    role: KnownRole
    locationIds: readonly LocationId[]
}>

export type Role = Readonly<{
    id: RoleId
    key: KnownRole
    permissions: readonly PermissionKey[]
}>

export type Permission = Readonly<{
    id: PermissionId
    key: PermissionKey
    description: string
}>

export type TenantScope = Readonly<{
    workspaceId: WorkspaceId
    locationId: LocationId | null
    actorMembershipId: MembershipId
}>

export type TenantOwned = Readonly<{
    workspaceId: WorkspaceId
    locationId: LocationId | null
}>

function brandedId<Name extends string>(kind: Name, value: string): Brand<string, Name> {
    const normalized = value.trim()
    if (!normalized) throw new TypeError(`${kind} cannot be empty`)
    return normalized as Brand<string, Name>
}

export function asWorkspaceId(value: string): WorkspaceId {
    return brandedId("WorkspaceId", value)
}

export function asLocationId(value: string): LocationId {
    return brandedId("LocationId", value)
}

export function asMembershipId(value: string): MembershipId {
    return brandedId("MembershipId", value)
}

export function asRoleId(value: string): RoleId {
    return brandedId("RoleId", value)
}

export function asPermissionId(value: string): PermissionId {
    return brandedId("PermissionId", value)
}
