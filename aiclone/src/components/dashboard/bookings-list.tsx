"use client"

import { useTransition } from "react"
import { Booking, ServiceOffering } from "@prisma/client"
import { BookingRow, type CalBooking } from "@/components/dashboard/calendar-week"
import { setBookingStatus } from "@/app/actions/bookings"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { CalendarDays } from "lucide-react"

interface BookingsListProps {
    bookings: (Booking & { serviceOffering: ServiceOffering })[]
}

function toCal(booking: Booking & { serviceOffering: ServiceOffering }): CalBooking {
    return {
        id: booking.id,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        service: booking.serviceOffering.name,
        startTime: new Date(booking.startTime).toISOString(),
        endTime: new Date(booking.endTime).toISOString(),
        status: booking.status,
        metadata: booking.metadata,
    }
}

export function BookingsList({ bookings }: BookingsListProps) {
    const [pending, startTransition] = useTransition()

    const onStatus = (id: string, status: "CONFIRMED" | "CANCELLED") => {
        startTransition(async () => {
            try {
                await setBookingStatus(id, status)
                toast.success(status === "CONFIRMED" ? "Confirmed" : "Cancelled")
            } catch {
                toast.error("Could not update booking")
            }
        })
    }

    if (bookings.length === 0) {
        return (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <EmptyState
                    icon={<CalendarDays />}
                    title="No bookings yet"
                    description="When someone books a table or a call, it shows up here."
                />
            </div>
        )
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            {bookings.map((booking) => (
                <BookingRow
                    key={booking.id}
                    booking={toCal(booking)}
                    pending={pending}
                    onStatus={onStatus}
                />
            ))}
        </div>
    )
}
