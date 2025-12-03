"use client"

import { useState } from "react"
import Link from "next/link"
import { Event } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Pencil,
    Trash2,
    Calendar,
    Users,
    MapPin,
    Video,
    Clock,
} from "lucide-react"
import { deleteEvent } from "@/app/actions/events"

interface EventWithCounts extends Event {
    _count: {
        registrations: number
    }
}

interface EventsListProps {
    profileId: string
    events: EventWithCounts[]
}

const eventTypeLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    WEBINAR: { label: "Webinar", variant: "default" },
    WORKSHOP: { label: "Workshop", variant: "secondary" },
    MEETUP: { label: "Meetup", variant: "outline" },
}

function formatEventDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(date))
}

function formatEventTime(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(date))
}

export function EventsList({ profileId, events }: EventsListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this event? This will also remove all registrations.")) return

        setDeletingId(id)
        try {
            await deleteEvent(id)
        } catch (error) {
            console.error("Failed to delete event:", error)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Events</h2>
                    <p className="text-muted-foreground">
                        Create and manage webinars, workshops, and meetups for your audience.
                    </p>
                </div>
                <Link href="/dashboard/events/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Create Event
                    </Button>
                </Link>
            </div>

            {events.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No events yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Start connecting with your audience by creating your first event.
                            Host webinars, workshops, or meetups.
                        </p>
                        <Link href="/dashboard/events/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create Your First Event
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {events.map((event) => {
                        const isDeleting = deletingId === event.id
                        const typeConfig = eventTypeLabels[event.eventType] || eventTypeLabels.WEBINAR
                        const isOnline = !event.location && event.meetingUrl

                        return (
                            <Card key={event.id} className="relative overflow-hidden">
                                {event.thumbnailUrl ? (
                                    <div className="aspect-video w-full overflow-hidden bg-muted">
                                        <img
                                            src={event.thumbnailUrl}
                                            alt={event.title}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                        <Calendar className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                )}

                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base font-medium line-clamp-2">
                                            {event.title}
                                        </CardTitle>
                                        <Badge variant={typeConfig.variant}>
                                            {typeConfig.label}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center">
                                            <Clock className="mr-2 h-4 w-4" />
                                            <span>
                                                {formatEventDate(event.startTime)} at {formatEventTime(event.startTime)}
                                            </span>
                                        </div>
                                        <div className="flex items-center">
                                            {isOnline ? (
                                                <>
                                                    <Video className="mr-2 h-4 w-4" />
                                                    <span>Online</span>
                                                </>
                                            ) : (
                                                <>
                                                    <MapPin className="mr-2 h-4 w-4" />
                                                    <span className="line-clamp-1">{event.location || "Location TBD"}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <div className="font-bold text-lg">
                                            {event.isFree || event.priceCents === 0
                                                ? "Free"
                                                : `$${(event.priceCents / 100).toFixed(2)}`}
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <Users className="mr-1 h-3 w-3" />
                                            {event._count.registrations} registered
                                            {event.maxAttendees && ` / ${event.maxAttendees}`}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant={event.isActive ? "default" : "secondary"}>
                                            {event.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        {new Date(event.startTime) < new Date() && (
                                            <Badge variant="outline">Past</Badge>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/events/${event.id}/edit`}
                                            className="flex-1"
                                        >
                                            <Button variant="outline" size="sm" className="w-full">
                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(event.id)}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
