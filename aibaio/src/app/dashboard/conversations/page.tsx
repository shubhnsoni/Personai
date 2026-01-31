import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ConversationsList } from "@/components/dashboard/conversations-list"

export default async function DashboardConversationsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const conversations = await prisma.conversation.findMany({
        where: { profileId: profile.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { lastMessageAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Conversations</h2>
            </div>
            <ConversationsList conversations={conversations} />
        </div>
    )
}
