"use client"

import { useState, useTransition } from "react"
import { AvailabilitySchedule } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateAvailability } from "@/app/actions/availability"
// import { toast } from "sonner"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface AvailabilitySettingsProps {
    profileId: string
    schedules: AvailabilitySchedule[]
}

export function AvailabilitySettings({ profileId, schedules }: AvailabilitySettingsProps) {
    const [isPending, startTransition] = useTransition()

    // Initialize state with existing schedules or defaults
    const [localSchedules, setLocalSchedules] = useState(() => {
        return DAYS.map((day, index) => {
            const existing = schedules.find(s => s.dayOfWeek === index)
            return {
                dayOfWeek: index,
                startTime: existing?.startTime || "09:00",
                endTime: existing?.endTime || "17:00",
                isEnabled: existing ? existing.isEnabled : (index >= 1 && index <= 5) // Default M-F enabled
            }
        })
    })

    const handleSave = () => {
        startTransition(async () => {
            try {
                await updateAvailability(profileId, localSchedules)
                alert("Availability updated")
            } catch (error) {
                console.error(error)
                alert("Failed to update availability")
            }
        })
    }

    const updateSchedule = (index: number, updates: Partial<typeof localSchedules[0]>) => {
        setLocalSchedules(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Availability</h2>
                    <p className="text-muted-foreground">Set your weekly working hours.</p>
                </div>
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <div className="border rounded-lg divide-y">
                {localSchedules.map((schedule, index) => (
                    <div key={index} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4 w-40">
                            <Switch
                                checked={schedule.isEnabled}
                                onCheckedChange={(checked) => updateSchedule(index, { isEnabled: checked })}
                            />
                            <Label className={schedule.isEnabled ? "font-medium" : "text-muted-foreground"}>
                                {DAYS[index]}
                            </Label>
                        </div>

                        {schedule.isEnabled ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="time"
                                    className="w-32"
                                    value={schedule.startTime}
                                    onChange={(e) => updateSchedule(index, { startTime: e.target.value })}
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                    type="time"
                                    className="w-32"
                                    value={schedule.endTime}
                                    onChange={(e) => updateSchedule(index, { endTime: e.target.value })}
                                />
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic">Unavailable</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
