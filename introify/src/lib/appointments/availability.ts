/**
 * Availability evaluation, built on the EXISTING AvailabilitySchedule and
 * CalendarOverride models. Nothing here replaces them; this module interprets them.
 *
 * A pure module apart from the row shapes it is handed, so the rules are testable with
 * plain objects and no database.
 *
 * TIME HANDLING, stated because it is easy to get silently wrong:
 * `AvailabilitySchedule.startTime`/`endTime` are `"HH:MM"` strings with no timezone, and
 * `CalendarOverride.date` is a timestamp. `Booking.startTime`/`endTime` are
 * `timestamp without time zone`. This module therefore compares everything in UTC
 * wall-clock terms and never converts between zones. Interpreting the same strings as
 * local time in one place and UTC in another is exactly how off-by-one-hour
 * double-bookings appear, so the choice is made once, here.
 */

export type AvailabilityWindowRow = Readonly<{
    dayOfWeek: number
    startTime: string
    endTime: string
    isEnabled: boolean
}>

export type CalendarOverrideRow = Readonly<{
    date: Date
    isBlocked: boolean
    startTime: string | null
    endTime: string | null
}>

export type AvailabilityVerdict =
    | Readonly<{ available: true }>
    | Readonly<{ available: false; reason: string }>

/** Minutes since midnight for an "HH:MM" string, or null when unparsable. */
export function parseClock(value: string | null | undefined): number | null {
    if (typeof value !== "string") return null
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
    if (!match) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null
    const total = hours * 60 + minutes
    return total > 24 * 60 ? null : total
}

/** Minutes since midnight UTC. */
export function minutesOfDayUtc(at: Date): number {
    return at.getUTCHours() * 60 + at.getUTCMinutes()
}

function sameUtcDate(a: Date, b: Date): boolean {
    return (
        a.getUTCFullYear() === b.getUTCFullYear() &&
        a.getUTCMonth() === b.getUTCMonth() &&
        a.getUTCDate() === b.getUTCDate()
    )
}

/**
 * Decides whether [start, end) falls inside published availability.
 *
 * Order of precedence, chosen so an override is genuinely an override:
 *   1. A blocking override with no times blocks the WHOLE day.
 *   2. A blocking override with times blocks that range only.
 *   3. A non-blocking override with times REPLACES the weekly schedule for that day.
 *   4. Otherwise the weekly schedule applies.
 *
 * Fails closed: if no window can be established, the answer is unavailable.
 */
export function evaluateAvailability(input: {
    start: Date
    end: Date
    windows: readonly AvailabilityWindowRow[]
    overrides: readonly CalendarOverrideRow[]
}): AvailabilityVerdict {
    const { start, end, windows, overrides } = input

    if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
        return { available: false, reason: "The start time is not a valid timestamp" }
    }
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
        return { available: false, reason: "The end time is not a valid timestamp" }
    }
    if (end.getTime() <= start.getTime()) {
        return { available: false, reason: "The end time must be after the start time" }
    }
    // A slot spanning midnight cannot be expressed by a single "HH:MM" window pair, so
    // it is refused rather than silently mis-evaluated against one day's schedule.
    if (!sameUtcDate(start, end) && !(minutesOfDayUtc(end) === 0 && sameUtcDate(new Date(end.getTime() - 1), start))) {
        return { available: false, reason: "An appointment cannot span more than one day" }
    }

    const startMinutes = minutesOfDayUtc(start)
    const endMinutes = minutesOfDayUtc(end) === 0 ? 24 * 60 : minutesOfDayUtc(end)

    const dayOverrides = overrides.filter((o) => o.date instanceof Date && sameUtcDate(o.date, start))

    for (const override of dayOverrides) {
        if (!override.isBlocked) continue
        const from = parseClock(override.startTime)
        const to = parseClock(override.endTime)
        if (from === null || to === null) {
            return { available: false, reason: "That date is blocked" }
        }
        // Half-open overlap: a block ending exactly when the slot starts does not clash.
        if (startMinutes < to && endMinutes > from) {
            return { available: false, reason: "That time is blocked on this date" }
        }
    }

    const replacing = dayOverrides.filter(
        (o) => !o.isBlocked && parseClock(o.startTime) !== null && parseClock(o.endTime) !== null,
    )
    if (replacing.length > 0) {
        const fits = replacing.some((o) => {
            const from = parseClock(o.startTime)
            const to = parseClock(o.endTime)
            return from !== null && to !== null && startMinutes >= from && endMinutes <= to
        })
        return fits
            ? { available: true }
            : { available: false, reason: "That time is outside the special hours set for this date" }
    }

    const dayOfWeek = start.getUTCDay()
    const applicable = windows.filter((w) => w.isEnabled && w.dayOfWeek === dayOfWeek)
    if (applicable.length === 0) {
        return { available: false, reason: "No availability is published for that day" }
    }

    const fits = applicable.some((w) => {
        const from = parseClock(w.startTime)
        const to = parseClock(w.endTime)
        return from !== null && to !== null && startMinutes >= from && endMinutes <= to
    })

    return fits
        ? { available: true }
        : { available: false, reason: "That time is outside published hours" }
}

/**
 * Expands a slot by the owner's buffer so back-to-back appointments keep a gap.
 * Profile.bufferMinutes already exists and defaults to 0, so a venue that has not
 * configured a buffer behaves exactly as before.
 */
export function applyBuffer(start: Date, end: Date, bufferMinutes: number): { from: Date; to: Date } {
    const buffer = Number.isFinite(bufferMinutes) && bufferMinutes > 0 ? Math.floor(bufferMinutes) : 0
    return {
        from: new Date(start.getTime() - buffer * 60_000),
        to: new Date(end.getTime() + buffer * 60_000),
    }
}
