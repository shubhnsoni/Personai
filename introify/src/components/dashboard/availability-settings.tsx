"use client"

import { useState, useTransition } from "react"
import { AvailabilitySchedule } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateAvailability } from "@/app/actions/availability"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { toast } from "sonner"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const ZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Kolkata",
    "Asia/Tokyo",
    "Australia/Sydney",
]

interface AvailabilitySettingsProps {
    profileId: string
    schedules: AvailabilitySchedule[]
    timezone?: string
    bufferMinutes?: number
    compact?: boolean
}

export function AvailabilitySettings({
    profileId,
    schedules,
    timezone = "UTC",
    bufferMinutes = 0,
    compact,
}: AvailabilitySettingsProps) {
    const [isPending, startTransition] = useTransition()
    const [tz, setTz] = useState(timezone)
    const [buffer, setBuffer] = useState(bufferMinutes)

    const [localSchedules, setLocalSchedules] = useState(() => {
        return DAYS.map((day, index) => {
            const existing = schedules.find(s => s.dayOfWeek === index)
            return {
                dayOfWeek: index,
                startTime: existing?.startTime || "09:00",
                endTime: existing?.endTime || "17:00",
                isEnabled: existing ? existing.isEnabled : (index >= 1 && index <= 5)
            }
        })
    })

    const handleSave = () => {
        startTransition(async () => {
            try {
                await updateAvailability(profileId, localSchedules, { timezone: tz, bufferMinutes: buffer })
                toast.success("Hours saved")
            } catch (error) {
                console.error(error)
                toast.error("Could not save hours")
            }
        })
    }

    const updateSchedule = (index: number, updates: Partial<typeof localSchedules[0]>) => {
        setLocalSchedules(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <select
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={tz}
                        onChange={(e) => setTz(e.target.value)}
                    >
                        {ZONES.map((z) => (
                            <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <Label>Buffer</Label>
                    <select
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={buffer}
                        onChange={(e) => setBuffer(Number(e.target.value))}
                    >
                        {[0, 10, 15, 30].map((n) => (
                            <option key={n} value={n}>{n === 0 ? "None" : `${n} min`}</option>
                        ))}
                    </select>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">Weekly hours</p>

            <div className="border rounded-lg divide-y">
                {localSchedules.map((schedule, index) => (
                    <div key={index} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 sm:gap-4 sm:w-40">
                            <Switch
                                checked={schedule.isEnabled}
                                onCheckedChange={(checked) => updateSchedule(index, { isEnabled: checked })}
                            />
                            <Label className={schedule.isEnabled ? "font-medium" : "text-muted-foreground"}>
                                {DAYS[index]}
                            </Label>
                        </div>

                        {schedule.isEnabled ? (
                            <div className="flex items-center gap-2 pl-10 sm:pl-0">
                                <Input
                                    type="time"
                                    className="w-[120px] sm:w-32"
                                    value={schedule.startTime}
                                    onChange={(e) => updateSchedule(index, { startTime: e.target.value })}
                                />
                                <span className="text-muted-foreground">to</span>
                                <Input
                                    type="time"
                                    className="w-[120px] sm:w-32"
                                    value={schedule.endTime}
                                    onChange={(e) => updateSchedule(index, { endTime: e.target.value })}
                                />
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic pl-10 sm:pl-0">Unavailable</div>
                        )}
                    </div>
                ))}
            </div>
            {compact ? (
                <Button className="w-full rounded-full" onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving..." : "Save hours"}
                </Button>
            ) : (
                <StudioDock>
                    <Button className="w-full md:w-auto" onClick={handleSave} disabled={isPending}>
                        {isPending ? "Saving..." : "Save hours"}
                    </Button>
                </StudioDock>
            )}
        </div>
    )
}
