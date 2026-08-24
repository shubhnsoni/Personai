import { cookies } from "next/headers"
import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"

export async function syncUser() {
    const user = await currentUser()
    if (!user) return null

    const email = user.emailAddresses[0]?.emailAddress
    if (!email) return null

    // Check if user exists
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        include: { profiles: true },
    })

    if (!dbUser) {
        // Create user
        return withActiveProfile(await prisma.user.create({
            data: {
                clerkId: user.id,
                email: email,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User',
                image: user.imageUrl,
            },
            include: { profiles: true },
        }))
    }

    // Update user info if changed
    if (dbUser.email !== email || dbUser.name !== `${user.firstName || ''} ${user.lastName || ''}`.trim()) {
        return withActiveProfile(await prisma.user.update({
            where: { id: dbUser.id },
            data: {
                email: email,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User',
                image: user.imageUrl,
            },
            include: { profiles: true },
        }))
    }

    return withActiveProfile(dbUser)
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
