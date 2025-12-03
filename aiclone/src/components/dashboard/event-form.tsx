"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Event } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createEvent, updateEvent, type EventData } from "@/app/actions/events"

interface EventFormProps {
    profileId: string
    event?: Event
}

const eventTypes = [
    { value: "WEBINAR", label: "Webinar" },
    { value: "WORKSHOP", label: "Workshop" },
    { value: "MEETUP", label: "Meetup" },
]

const timezones = [
    { value: "UTC", label: "UTC" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET/CEST)" },
    { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
]

function formatDateTimeLocal(date: Date | string | undefined): string {
    if (!date) return ""
    const d = new Date(date)
    const pad = (n: number) => n.toString().padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventForm({ profileId, event }: EventFormProps) {
    const router = useRouter()
    const isEditing = !!event

    const [title, setTitle] = useState(event?.title || "")
    const [description, setDescription] = useState(event?.description || "")
    const [eventType, setEventType] = useState<"WEBINAR" | "WORKSHOP" | "MEETUP">(
        (event?.eventType as "WEBINAR" | "WORKSHOP" | "MEETUP") || "WEBINAR"
    )
    const [startTime, setStartTime] = useState(formatDateTimeLocal(event?.startTime))
    const [endTime, setEndTime] = useState(formatDateTimeLocal(event?.endTime))
    const [timezone, setTimezone] = useState(event?.timezone || "UTC")
    const [location, setLocation] = useState(event?.location || "")
    const [meetingUrl, setMeetingUrl] = useState(event?.meetingUrl || "")
    const [price, setPrice] = useState(
        event ? (event.priceCents / 100).toString() : ""
    )
    const [isFree, setIsFree] = useState(event?.isFree ?? true)
    const [maxAttendees, setMaxAttendees] = useState(
        event?.maxAttendees?.toString() || ""
    )
    const [thumbnailUrl, setThumbnailUrl] = useState(event?.thumbnailUrl || "")
    const [isActive, setIsActive] = useState(event?.isActive ?? true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim() || !startTime || !endTime) return

        setIsSubmitting(true)
        try {
            const data: EventData = {
                title: title.trim(),
                description: description.trim() || undefined,
                eventType,
                startTime,
                endTime,
                timezone,
                location: location.trim() || undefined,
                meetingUrl: meetingUrl.trim() || undefined,
                price: parseFloat(price) || 0,
                isFree,
                maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
                thumbnailUrl: thumbnailUrl.trim() || undefined,
                isActive,
            }

            if (isEditing && event) {
                await updateEvent(event.id, data)
            } else {
                await createEvent(profileId, data)
            }

            router.push("/dashboard/events")
            router.refresh()
        } catch (error) {
            console.error("Failed to save event:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push("/dashboard/events")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Event" : "Create New Event"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update your event details."
                        : "Set up a new webinar, workshop, or meetup for your audience."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Live Q&A: Building Your Personal Brand"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what attendees will learn or experience..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="eventType">Event Type *</Label>
                        <Select value={eventType} onValueChange={(v) => setEventType(v as "WEBINAR" | "WORKSHOP" | "MEETUP")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            <SelectContent>
                                {eventTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Start Date & Time *</Label>
                            <Input
                                id="startTime"
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">End Date & Time *</Label>
                            <Input
                                id="endTime"
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone *</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                {timezones.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">Location (for in-person events)</Label>
                        <Input
                            id="location"
                            placeholder="e.g. 123 Main St, New York, NY"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty for online-only events
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="meetingUrl">Meeting URL (for online events)</Label>
                        <Input
                            id="meetingUrl"
                            type="url"
                            placeholder="e.g. https://zoom.us/j/123456789"
                            value={meetingUrl}
                            onChange={(e) => setMeetingUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Add a Zoom, Google Meet, or other video conferencing link
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isFree">Free Event</Label>
                            <p className="text-sm text-muted-foreground">
                                Toggle off to set a price for this event
                            </p>
                        </div>
                        <Switch
                            id="isFree"
                            checked={isFree}
                            onCheckedChange={setIsFree}
                        />
                    </div>

                    {!isFree && (
                        <div className="space-y-2">
                            <Label htmlFor="price">Price (USD)</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="maxAttendees">Max Attendees</Label>
                        <Input
                            id="maxAttendees"
                            type="number"
                            min="1"
                            placeholder="Unlimited"
                            value={maxAttendees}
                            onChange={(e) => setMaxAttendees(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty for unlimited attendees
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                        <Input
                            id="thumbnailUrl"
                            type="url"
                            placeholder="https://example.com/event-thumbnail.jpg"
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Cover image for your event
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isActive">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Make this event visible and open for registration
                            </p>
                        </div>
                        <Switch
                            id="isActive"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                        />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !title.trim() || !startTime || !endTime}>
                            {isSubmitting
                                ? "Saving..."
                                : isEditing
                                ? "Update Event"
                                : "Create Event"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
