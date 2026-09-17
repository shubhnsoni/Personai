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

/**
 * Pick the dashboard active profile.
 * An explicit activeId (cookie / switcher) always wins when that profile is accessible —
 * including owned try-* kits (e.g. Haven Hinoo / try-hotel). Auto-pick still prefers
 * non-try businesses unless TRY_NOW / trying is set, so guest kits do not steal the desk.
 */
export function chooseActiveProfile<P extends { id: string; slug: string; updatedAt: Date }>(
    profiles: readonly P[], activeId?: string, trying = false,
): P | null {
    const fromCookie = profiles.find((p) => p.id === activeId)
    if (fromCookie) return fromCookie
    if (trying) {
        return [...profiles].sort((a, b) => +b.updatedAt - +a.updatedAt)[0] || null
    }
    return [...profiles].filter((p) => !p.slug.startsWith("try-"))
        .sort((a, b) => +b.updatedAt - +a.updatedAt)[0] || profiles[0] || null
}
