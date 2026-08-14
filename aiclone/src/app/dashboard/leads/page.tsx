import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { LeadsList } from "@/components/dashboard/leads-list"
import { LeadsKanban } from "@/components/dashboard/leads-kanban"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const dynamic = 'force-dynamic'

export default async function DashboardLeadsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const leads = await prisma.visitorLead.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 h-full flex flex-col">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
            </div>

            <Tabs defaultValue="board" className="flex-1 flex flex-col space-y-4">
                <TabsList>
                    <TabsTrigger value="board">Board</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>

                <TabsContent value="board" className="flex-1 h-full">
                    <LeadsKanban leads={leads} />
                </TabsContent>

                <TabsContent value="list" className="h-full">
                    <LeadsList leads={leads} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
