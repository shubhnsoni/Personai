import { cookies } from "next/headers"
import { currentUser } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ACTIVE_PROFILE_COOKIE, TRY_NOW_COOKIE } from "@/lib/try-kits"
import { isAdminEmail } from "@/lib/admin/allowlist"
import { IMPERSONATE_COOKIE } from "@/lib/admin/impersonate"
import { canAccessProfile, chooseActiveProfile, type ProfileAccess } from "@/lib/workspace-access"

/**
 * Syncs the signed-in Clerk user into the local database.
 *
 * A single person can end up with a new Clerk user id (for example when the
 * Clerk instance is swapped, or when they sign in through a different
 * provider), while the `User.email` column stays unique. Looking the user up by
 * `clerkId` alone therefore used to fall through to `create` and crash with a
 * unique constraint violation on `email`. We now fall back to an email lookup
 * and re-link the row to the current Clerk id instead, but only after Clerk
 * has verified ownership of that email address.
 */
export async function syncUser() {
    const user = await currentUser()
    if (!user) return null

    // Prefer the primary address; Clerk does not guarantee ordering of the array.
    const primaryEmail =
        user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ??
        user.emailAddresses[0]

    const email = primaryEmail?.emailAddress
    // Email identifies existing accounts and can grant admin access. An address
    // attached to a Clerk user is not proof of ownership until it is verified.
    if (!email || primaryEmail.verification?.status !== "verified") return null

    const name =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User'

    const data = {
        email,
        emailVerifiedAt: new Date(),
        name,
        image: user.imageUrl,
        ...(isAdminEmail(email) ? { role: "ADMIN" as const } : {}),
    }

    const existingByClerkId = await prisma.user.findUnique({
        where: { clerkId: user.id },
        include: { profiles: true },
    })

    if (existingByClerkId) {
        if (
            !existingByClerkId.emailVerifiedAt ||
            existingByClerkId.email !== email ||
            existingByClerkId.name !== name ||
            existingByClerkId.image !== user.imageUrl ||
            (isAdminEmail(email) && existingByClerkId.role !== "ADMIN")
        ) {
            return withActiveProfile(await prisma.user.update({
                where: { id: existingByClerkId.id },
                data,
                include: { profiles: true },
            }))
        }

        return withActiveProfile(existingByClerkId)
    }

    // No row for this Clerk id. The email may still belong to an existing row
    // created under a previous Clerk id, so adopt that row rather than
    // colliding with the unique `email` constraint.
    const existingByEmail = await prisma.user.findUnique({
        where: { email },
        include: { profiles: true },
    })

    if (existingByEmail) {
        return withActiveProfile(await prisma.user.update({
            where: { id: existingByEmail.id },
            data: { ...data, clerkId: user.id },
            include: { profiles: true },
        }))
    }

    try {
        return withActiveProfile(await prisma.user.create({
            data: { ...data, clerkId: user.id },
            include: { profiles: true },
        }))
    } catch (error) {
        // Two concurrent requests can both reach `create` for a new user; the
        // loser can recover only a row bound to this authenticated Clerk ID.
        // An email collision alone must never return another account's row.
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            const raced = await prisma.user.findUnique({
                where: { clerkId: user.id },
                include: { profiles: true },
            })

            if (raced) return withActiveProfile(raced)
        }

        throw error
    }
}

type SyncedDatabaseUser = Prisma.UserGetPayload<{ include: { profiles: true } }>

async function withActiveProfile(dbUser: SyncedDatabaseUser) {
    // Ownership remains an explicit, separate list. A workspace invitation must
    // never let an owner-only action treat a colleague as the legal owner.
    const profileAccess: Record<string, ProfileAccess> = Object.fromEntries(dbUser.profiles.map((p) => [p.id, {
        workspaceId: null, role: "OWNER", owner: true, locationIds: [],
    }]))
    const memberships = await prisma.membership.findMany({
        where: { userId: dbUser.id },
        include: {
            workspace: { select: { id: true, profileId: true, billingAccountId: true } },
            membershipLocations: { select: { locationId: true } },
        },
    })
    const accountMemberships = await prisma.billingAccountMember.findMany({
        where: { userId: dbUser.id, status: "ACTIVE" }, select: { accountId: true },
    })
    const activeAccounts = new Set(accountMemberships.map((member) => member.accountId))
    for (const membership of memberships) {
        const profileId = membership.workspace.profileId
        if (!profileId) continue
        const owner = dbUser.profiles.some((p) => p.id === profileId)
        if (!owner && membership.workspace.billingAccountId && !activeAccounts.has(membership.workspace.billingAccountId)) continue
        profileAccess[profileId] = {
            workspaceId: membership.workspace.id,
            role: owner ? "OWNER" : membership.role,
            owner,
            locationIds: owner ? [] : membership.membershipLocations.map((link) => link.locationId),
        }
    }
    const sharedIds = Object.keys(profileAccess).filter((id) => !dbUser.profiles.some((p) => p.id === id) && canAccessProfile(profileAccess[id], "read"))
    const shared = sharedIds.length ? await prisma.profile.findMany({ where: { id: { in: sharedIds } } }) : []
    const accessibleProfiles = [...dbUser.profiles, ...shared]
    let activeId: string | undefined
    let trying = false
    try {
        const jar = await cookies()
        activeId = jar.get(ACTIVE_PROFILE_COOKIE)?.value
        trying = Boolean(jar.get(TRY_NOW_COOKIE)?.value)
        if (dbUser.role === "ADMIN" || isAdminEmail(dbUser.email)) {
            const impersonateId = jar.get(IMPERSONATE_COOKIE)?.value
            if (impersonateId) {
                const foreign = await prisma.profile.findUnique({ where: { id: impersonateId } })
                if (foreign) {
                    profileAccess[foreign.id] = { workspaceId: null, role: "OWNER", owner: true, locationIds: [] }
                    return {
                        ...dbUser,
                        profiles: [foreign, ...dbUser.profiles.filter((p) => p.id !== foreign.id)],
                        accessibleProfiles: [foreign, ...accessibleProfiles.filter((p) => p.id !== foreign.id)],
                        activeProfile: foreign,
                        profileAccess,
                    }
                }
            }
        }
    } catch { /* Server contexts without cookies use the most recent accessible business. */ }
    const activeProfile = chooseActiveProfile(accessibleProfiles, activeId, trying)
    const ownedActive = chooseActiveProfile(dbUser.profiles, activeId, trying)
    return {
        ...dbUser,
        profiles: ownedActive ? [ownedActive, ...dbUser.profiles.filter((p) => p.id !== ownedActive.id)] : [],
        accessibleProfiles,
        activeProfile,
        profileAccess,
    }
}
