// import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function syncUser() {
    // MOCK MODE
    const user = {
        id: "mock-clerk-id-new",
        emailAddresses: [{ emailAddress: "mock-new@example.com" }],
        firstName: "Mock",
        lastName: "User",
        username: "mockuser",
        imageUrl: "https://github.com/shadcn.png"
    }
    // const user = await currentUser()
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

    return dbUser
}
