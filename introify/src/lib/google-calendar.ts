/**
 * Google Calendar Integration (Placeholder)
 * 
 * To enable, set GOOGLE_CALENDAR_API_KEY in .env
 * Future: Use Google Calendar API to sync availability and bookings.
 */

const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY

export function isGoogleCalendarEnabled(): boolean {
    return !!GOOGLE_CALENDAR_API_KEY
}

/**
 * Fetch busy times from Google Calendar for a given date range.
 * Placeholder — returns empty array until Google OAuth is implemented.
 */
export async function getGoogleCalendarBusyTimes(
    _calendarId: string,
    _startDate: Date,
    _endDate: Date
): Promise<{ start: Date; end: Date }[]> {
    if (!GOOGLE_CALENDAR_API_KEY) {
        console.log('[Google Calendar] API key not set, skipping calendar check')
        return []
    }

    // TODO: Implement Google Calendar API integration
    // 1. Use service account or OAuth to access user's calendar
    // 2. Call freebusy.query to get busy times
    // 3. Return busy time slots to exclude from availability
    //
    // const calendar = google.calendar({ version: 'v3', auth: GOOGLE_CALENDAR_API_KEY })
    // const response = await calendar.freebusy.query({
    //     requestBody: {
    //         timeMin: startDate.toISOString(),
    //         timeMax: endDate.toISOString(),
    //         items: [{ id: calendarId }],
    //     },
    // })

    return []
}

/**
 * Create a Google Calendar event for a booking.
 * Placeholder — logs to console until implemented.
 */
export async function createCalendarEvent(_booking: {
    title: string
    description?: string
    startTime: Date
    endTime: Date
    attendeeEmail: string
}): Promise<string | null> {
    if (!GOOGLE_CALENDAR_API_KEY) {
        console.log('[Google Calendar] Would create event:', _booking)
        return null
    }

    // TODO: Implement event creation
    return null
}
