import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { CalendarStudio } from "@/components/dashboard/calendar-studio"
import { ensureCalendarToken } from "@/app/actions/calendar-sync"
import { requireSurface } from "@/lib/require-surface"
import { calendarNoun } from "@/lib/surfaces"

export const dynamic = "force-dynamic"

export default async function DashboardCalendarPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "calendar", profile)

    const from = new Date()
    from.setMonth(from.getMonth() - 1)
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
    const to = new Date()
    to.setMonth(to.getMonth() + 3)
    to.setDate(1)

    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const token = await ensureCalendarToken()

    const [schedules, bookings] = await Promise.all([
        prisma.availabilitySchedule.findMany({
            where: { profileId: profile.id },
            orderBy: { dayOfWeek: "asc" },
        }),
        prisma.booking.findMany({
            where: {
                profileId: profile.id,
                startTime: { gte: from, lt: to },
            },
            include: { serviceOffering: true },
            orderBy: { startTime: "asc" },
        }),
    ])

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <CalendarStudio
                profileId={profile.id}
                timezone={profile.timezone || "UTC"}
                bufferMinutes={Number((profile as { bufferMinutes?: number }).bufferMinutes || 0)}
                icsUrl={`${proto}://${host}/api/calendar/${token}`}
                noun={calendarNoun(profile.roleTemplate)}
                schedules={schedules}
                bookings={bookings.map((b) => ({
                    id: b.id,
                    visitorName: b.visitorName,
                    visitorEmail: b.visitorEmail,
                    service: b.serviceOffering.name,
                    startTime: b.startTime.toISOString(),
                    endTime: b.endTime.toISOString(),
                    status: b.status,
                    metadata: b.metadata,
                }))}
            />
        </div>
    )
}
