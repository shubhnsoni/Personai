import { prisma } from "@/lib/prisma"

export async function createNotification(input: {
    userId: string
    type: string
    title: string
    body?: string
    href?: string
}) {
    return prisma.notification.create({ data: input })
}

export async function unreadNotifications(userId: string) {
    return prisma.notification.findMany({
        where: { userId, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
    })
}

export async function markNotificationsRead(userId: string) {
    await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
    })
}
