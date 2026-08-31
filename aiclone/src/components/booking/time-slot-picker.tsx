'use client'

import { useState, useEffect } from 'react'

interface AvailabilitySlot {
    dayOfWeek: number
    startTime: string
    endTime: string
    isEnabled: boolean
}

interface TimeSlotPickerProps {
    profileId: string
    serviceId: string
    durationMinutes: number
    availability: AvailabilitySlot[]
    onSelect: (slot: { date: string; startTime: string; endTime: string }) => void
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function TimeSlotPicker({
    profileId,
    serviceId,
    durationMinutes,
    availability,
    onSelect,
}: TimeSlotPickerProps) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
    // One piece of state for "the answer we have", tagged with the request it answers. `loading`
    // and `bookedSlots` are derived from it rather than being separate state set from the effect
    // body. Two things follow, and both are behaviours a test pins:
    //  - There is no cascading render. The old code called setLoading(true) synchronously inside
    //    the effect, so picking a second date committed one frame in which selectedDate was
    //    already the new date while bookedSlots still held the PREVIOUS date's answer - the user
    //    saw the new date's slots filtered by the old date's bookings, i.e. wrong availability
    //    presented as fact.
    //  - A late or out-of-order response cannot poison a different date. The answer is only used
    //    when its tag matches the request currently on screen.
    const [answer, setAnswer] = useState<{
        date: string
        profileId: string
        serviceId: string
        slots: string[]
    } | null>(null)

    // Generate next 14 days
    const dates = Array.from({ length: 14 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i + 1)
        return d
    })

    // Filter dates to only those with availability
    const availableDays = new Set(availability.filter(a => a.isEnabled).map(a => a.dayOfWeek))
    const availableDates = dates.filter(d => availableDays.has(d.getDay()))

    // Generate time slots for selected date
    function getSlotsForDate(date: Date): { start: string; end: string }[] {
        const dayOfWeek = date.getDay()
        const dayAvail = availability.filter(a => a.dayOfWeek === dayOfWeek && a.isEnabled)
        const slots: { start: string; end: string }[] = []

        for (const avail of dayAvail) {
            const [startH, startM] = avail.startTime.split(':').map(Number)
            const [endH, endM] = avail.endTime.split(':').map(Number)
            const startMinutes = startH * 60 + startM
            const endMinutes = endH * 60 + endM

            for (let m = startMinutes; m + durationMinutes <= endMinutes; m += durationMinutes) {
                const sh = Math.floor(m / 60)
                const sm = m % 60
                const eh = Math.floor((m + durationMinutes) / 60)
                const em = (m + durationMinutes) % 60
                slots.push({
                    start: `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}`,
                    end: `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`,
                })
            }
        }
        return slots
    }

    // Fetch booked slots when date changes. setState happens only in the promise callbacks, never
    // synchronously in the effect body, so there is no cascading render.
    useEffect(() => {
        if (!selectedDate) return
        let cancelled = false
        const tag = { date: selectedDate, profileId, serviceId }
        fetch(`/api/bookings/slots?profileId=${profileId}&serviceId=${serviceId}&date=${selectedDate}`)
            .then(r => r.json())
            .then(data => { if (!cancelled) setAnswer({ ...tag, slots: data.bookedSlots || [] }) })
            .catch(() => { if (!cancelled) setAnswer({ ...tag, slots: [] }) })
        return () => { cancelled = true }
    }, [selectedDate, profileId, serviceId])

    const answered =
        answer !== null &&
        answer.date === selectedDate &&
        answer.profileId === profileId &&
        answer.serviceId === serviceId
    const loading = selectedDate !== null && !answered
    const bookedSlots = answered ? answer.slots : []

    const selectedDateObj = selectedDate ? new Date(selectedDate) : null
    const slots = selectedDateObj ? getSlotsForDate(selectedDateObj) : []
    const availableSlots = slots.filter(s => !bookedSlots.includes(s.start))

    return (
        <div className="space-y-4">
            {/* Date picker */}
            <div>
                <h4 className="text-sm font-medium mb-2">Select a date</h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {availableDates.map(date => {
                        const dateStr = date.toISOString().split('T')[0]
                        const isSelected = selectedDate === dateStr
                        return (
                            <button
                                key={dateStr}
                                onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null) }}
                                className={`flex flex-col items-center px-3 py-2 rounded-lg border min-w-[60px] transition-colors ${
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'hover:bg-muted border-border'
                                }`}
                            >
                                <span className="text-xs font-medium">{DAY_NAMES[date.getDay()]}</span>
                                <span className="text-lg font-bold">{date.getDate()}</span>
                                <span className="text-xs">{date.toLocaleDateString('en', { month: 'short' })}</span>
                            </button>
                        )
                    })}
                </div>
                {availableDates.length === 0 && (
                    <p className="text-sm text-muted-foreground">No available dates. The creator hasn&apos;t set their availability yet.</p>
                )}
            </div>

            {/* Time slots */}
            {selectedDate && (
                <div>
                    <h4 className="text-sm font-medium mb-2">Select a time</h4>
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading available times...</p>
                    ) : availableSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No available slots on this date.</p>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {availableSlots.map(slot => {
                                const isSelected = selectedSlot === slot.start
                                return (
                                    <button
                                        key={slot.start}
                                        onClick={() => {
                                            setSelectedSlot(slot.start)
                                            onSelect({ date: selectedDate, startTime: slot.start, endTime: slot.end })
                                        }}
                                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                            isSelected
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'hover:bg-muted border-border'
                                        }`}
                                    >
                                        {slot.start}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
