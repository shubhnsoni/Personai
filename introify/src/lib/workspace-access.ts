/** Legacy dashboard permissions, separate from ownership and location-scoped Business OS rights. */
export type ProfilePermission = "read" | "content.write" | "inbox.write" | "operations.write" | "settings.write"

export type ProfileAccess = Readonly<{
    workspaceId: string | null
    role: string
    owner: boolean
    locationIds: readonly string[]
}>

export function canAccessProfile(access: ProfileAccess | undefined, permission: ProfilePermission): boolean {
    if (!access || access.locationIds.length) return false
    if (access.owner || access.role === "OWNER" || access.role === "ADMIN") return true
    if (access.role === "MANAGER") return permission !== "settings.write"
    if (access.role === "STAFF") return permission === "read" || permission === "inbox.write" || permission === "operations.write"
    if (access.role === "VIEWER") return permission === "read"
    // Specialist/location desks use their existing domain-specific access checks.
    return false
}

export function chooseActiveProfile<P extends { id: string; slug: string; updatedAt: Date }>(
    profiles: readonly P[], activeId?: string, trying = false,
): P | null {
    const fromCookie = profiles.find((p) => p.id === activeId)
    if (fromCookie && (trying || !fromCookie.slug.startsWith("try-"))) return fromCookie
    return [...profiles].filter((p) => !p.slug.startsWith("try-"))
        .sort((a, b) => +b.updatedAt - +a.updatedAt)[0] || fromCookie || profiles[0] || null
}
