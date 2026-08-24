import { cookies } from "next/headers"
import { currentUser } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"

/**
 * Syncs the signed-in Clerk user into the local database.
 *
 * A single person can end up with a new Clerk user id (for example when the
 * Clerk instance is swapped, or when they sign in through a different
 * provider), while the `User.email` column stays unique. Looking the user up by
 * `clerkId` alone therefore used to fall through to `create` and crash with a
 * unique constraint violation on `email`. We now fall back to an email lookup
 * and re-link the row to the current Clerk id instead.
 */
export async function syncUser() {
    const user = await currentUser()
    if (!user) return null

    // Prefer the primary address; Clerk does not guarantee ordering of the array.
    const primaryEmail =
        user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ??
        user.emailAddresses[0]

    const email = primaryEmail?.emailAddress
    if (!email) return null

    const name =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User'

    const data = {
        email,
        name,
        image: user.imageUrl,
    }

    const existingByClerkId = await prisma.user.findUnique({
        where: { clerkId: user.id },
        include: { profiles: true },
    })

    if (existingByClerkId) {
        if (
            existingByClerkId.email !== email ||
            existingByClerkId.name !== name ||
            existingByClerkId.image !== user.imageUrl
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
        // Only re-link verified emails, otherwise an unverified address could be
        // used to take over an existing account and its profiles.
        if (primaryEmail?.verification?.status !== 'verified') {
            throw new Error(
                `Cannot link Clerk account to existing user: the email address is not verified.`
            )
        }

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
        // loser of that race just reads the row the winner inserted.
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            const raced = await prisma.user.findFirst({
                where: { OR: [{ clerkId: user.id }, { email }] },
                include: { profiles: true },
            })

            if (raced) return withActiveProfile(raced)
        }

        throw error
    }
}

async function withActiveProfile<T extends { profiles: { id: string }[] }>(dbUser: T): Promise<T> {
    if (dbUser.profiles.length < 2) return dbUser
    try {
        const activeId = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value
        if (!activeId) return dbUser
        const idx = dbUser.profiles.findIndex((p) => p.id === activeId)
        if (idx <= 0) return dbUser
        const next = [...dbUser.profiles]
        const [picked] = next.splice(idx, 1)
        next.unshift(picked)
        return { ...dbUser, profiles: next }
    } catch {
        return dbUser
    }
}
