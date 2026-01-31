"use client"

import { Booking, ServiceOffering } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface BookingsListProps {
    bookings: (Booking & { serviceOffering: ServiceOffering })[]
}

export function BookingsList({ bookings }: BookingsListProps) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Bookings</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bookings.map((booking) => (
                    <Card key={booking.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {booking.visitorName}
                            </CardTitle>
                            <Badge variant={booking.status === "CONFIRMED" ? "default" : "secondary"}>
                                {booking.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-medium mb-1">
                                {booking.serviceOffering.name}
                            </div>
                            <div className="text-xs text-muted-foreground mb-4">
                                {new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(booking.startTime))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {booking.visitorEmail}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {bookings.length === 0 && (
                    <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                        No bookings yet.
                    </div>
                )}
            </div>
        </div>
    )
}
