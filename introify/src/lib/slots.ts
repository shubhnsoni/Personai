export type DayHours = {
    dayOfWeek: number
    startTime: string
    endTime: string
    isEnabled: boolean
}

export type DayOverride = {
    date: string
    isBlocked: boolean
    startTime?: string | null
    endTime?: string | null
}

export type BusyBlock = { start: Date; end: Date; covers?: number }

function minutesOf(hhmm: string) {
    const [h, m] = hhmm.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
}

function pad(n: number) {
    return String(n).padStart(2, "0")
}

export function dayKey(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function hoursForDate(date: Date, weekly: DayHours[], overrides: DayOverride[]) {
    const key = dayKey(date)
    const override = overrides.find((o) => o.date.slice(0, 10) === key)
    if (override) {
        if (override.isBlocked) return null
        if (override.startTime && override.endTime) {
            return { startTime: override.startTime, endTime: override.endTime }
        }
    }
    const weeklyDay = weekly.find((w) => w.dayOfWeek === date.getDay() && w.isEnabled)
    if (!weeklyDay) return null
    return { startTime: weeklyDay.startTime, endTime: weeklyDay.endTime }
}

export function generateSlots(opts: {
    date: Date
    weekly: DayHours[]
    overrides: DayOverride[]
    durationMinutes: number
    bufferMinutes?: number
    busy?: BusyBlock[]
    coverLimit?: number | null
    partySize?: number
}): string[] {
    const hours = hoursForDate(opts.date, opts.weekly, opts.overrides)
    if (!hours) return []
    const duration = Math.max(15, opts.durationMinutes || 30)
    const buffer = Math.max(0, opts.bufferMinutes || 0)
    const step = duration + buffer
    const startMin = minutesOf(hours.startTime)
    const endMin = minutesOf(hours.endTime)
    const day = dayKey(opts.date)
    const busy = opts.busy || []
    const coverLimit = opts.coverLimit && opts.coverLimit > 0 ? opts.coverLimit : null
    const partySize = Math.max(1, opts.partySize || 1)
    const slots: string[] = []

    for (let m = startMin; m + duration <= endMin; m += step) {
        const start = new Date(`${day}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`)
        const end = new Date(start.getTime() + duration * 60000)
        if (coverLimit) {
            const used = busy
                .filter((b) => start < b.end && end > b.start)
                .reduce((sum, b) => sum + (b.covers || 1), 0)
            if (used + partySize > coverLimit) continue
        } else {
            const taken = busy.some((b) => start < b.end && end > b.start)
            if (taken) continue
        }
        slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
    }
    return slots
}
