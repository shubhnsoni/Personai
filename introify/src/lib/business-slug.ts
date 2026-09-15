import { prisma } from "@/lib/prisma"
import { normalizeUsername, usernameError } from "@/lib/username"

export async function slugTaken(candidate: string, exceptProfileId?: string) {
    const [profile, workspace] = await Promise.all([
        prisma.profile.findUnique({ where: { slug: candidate }, select: { id: true } }),
        prisma.workspace.findUnique({ where: { slug: candidate }, select: { profileId: true } }),
    ])
    if (profile && profile.id !== exceptProfileId) return true
    if (workspace && workspace.profileId !== exceptProfileId) return true
    return false
}

export async function allocateBusinessSlug(displayName: string, preferred?: string, exceptProfileId?: string): Promise<string> {
    const wanted = preferred ? normalizeUsername(preferred) : ""
    if (wanted) {
        const error = usernameError(wanted)
        if (error) throw new TypeError(error)
        if (await slugTaken(wanted, exceptProfileId)) throw new TypeError("That username is taken")
        return wanted
    }
    const base = normalizeUsername(displayName) || "page"
    let candidate = base
    let suffix = 2
    while (await slugTaken(candidate, exceptProfileId) || usernameError(candidate)) {
        candidate = `${base}-${suffix++}`
        if (suffix > 500) throw new TypeError("Could not allocate a username")
    }
    return candidate
}
