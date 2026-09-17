import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { StudioPageHead, StudioPanel } from "@/components/dashboard/studio-ui"

export const dynamic = "force-dynamic"

export default async function HotelAnalyticsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    if (!isHotelRole(profile.roleTemplate)) redirect("/dashboard")
    const [requests, scans, chats] = await Promise.all([
        prisma.hotelRequest.count({ where: { profileId: profile.id } }),
        prisma.hotelQr.aggregate({ where: { profileId: profile.id }, _sum: { scanCount: true } }),
        prisma.conversation.count({ where: { profileId: profile.id } }),
    ])
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Analytics" hint="Counts only in this slice. SLA breach and sentiment come later." />
            <StudioPanel className="grid grid-cols-3 divide-x divide-white/8">
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">Requests</p>
                    <p className="text-lg font-semibold tabular-nums">{requests}</p>
                </div>
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">QR scans</p>
                    <p className="text-lg font-semibold tabular-nums">{scans._sum.scanCount || 0}</p>
                </div>
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">Guest chats</p>
                    <p className="text-lg font-semibold tabular-nums">{chats}</p>
                </div>
            </StudioPanel>
        </div>
    )
}
