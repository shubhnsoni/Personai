"use client"

import { useState, useTransition } from "react"
import { AvailabilitySchedule } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateAvailability } from "@/app/actions/availability"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface AvailabilitySettingsProps {
    profileId: string
    schedules: AvailabilitySchedule[]
}

export function AvailabilitySettings({ profileId, schedules }: AvailabilitySettingsProps) {
    const [isPending, startTransition] = useTransition()

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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Availability</h2>
                    <p className="text-sm text-muted-foreground">Set your weekly working hours.</p>
                </div>
                <Button onClick={handleSave} disabled={isPending} className="w-full sm:w-auto">
                    {isPending ? "Saving..." : "Save Changes"}
                </Button>
            </div>

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
        </div>
    )
}
