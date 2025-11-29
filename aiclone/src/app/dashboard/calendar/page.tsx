import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { AvailabilitySettings } from "@/components/dashboard/availability-settings"

export default async function DashboardCalendarPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const schedules = await prisma.availabilitySchedule.findMany({
        where: { profileId: profile.id },
        orderBy: { dayOfWeek: 'asc' }
    })

    const bookings = await prisma.booking.findMany({
        where: { profileId: profile.id },
        include: { serviceOffering: true },
        orderBy: { startTime: 'desc' }
    })

    const { Tabs, TabsContent, TabsList, TabsTrigger } = await import("@/components/ui/tabs")
    const { BookingsList } = await import("@/components/dashboard/bookings-list")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 h-full flex flex-col">
            <Tabs defaultValue="bookings" className="flex-1 flex flex-col space-y-4">
                <TabsList>
                    <TabsTrigger value="bookings">Bookings</TabsTrigger>
                    <TabsTrigger value="availability">Availability</TabsTrigger>
                </TabsList>

                <TabsContent value="bookings" className="flex-1 h-full">
                    <BookingsList bookings={bookings} />
                </TabsContent>

                <TabsContent value="availability" className="h-full">
                    <AvailabilitySettings profileId={profile.id} schedules={schedules} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
