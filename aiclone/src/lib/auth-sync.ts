import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

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
        return await prisma.user.create({
            data: {
                clerkId: user.id,
                email: email,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User',
                image: user.imageUrl,
            },
            include: { profiles: true },
        })
    }

    // Update user info if changed
    if (dbUser.email !== email || dbUser.name !== `${user.firstName || ''} ${user.lastName || ''}`.trim()) {
        return await prisma.user.update({
            where: { id: dbUser.id },
            data: {
                email: email,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User',
                image: user.imageUrl,
            },
            include: { profiles: true },
        })
    }

    return dbUser
}
