export const IMPERSONATE_COOKIE = "pl_impersonate"
export const IMPERSONATE_MAX_AGE = 60 * 60 * 4

export function impersonationScope<T extends { id: string }>(input: {
    isAdmin: boolean
    impersonateProfileId?: string | null
    targetUserProfiles: T[]
    adminProfiles: T[]
}): { profiles: T[]; activeId: string } | null {
    if (!input.isAdmin || !input.impersonateProfileId) return null
    if (!input.targetUserProfiles.length) return null
    const active = input.targetUserProfiles.find((row) => row.id === input.impersonateProfileId)
        || input.targetUserProfiles[0]
    const rest = input.targetUserProfiles.filter((row) => row.id !== active.id)
    return { profiles: [active, ...rest], activeId: active.id }
}