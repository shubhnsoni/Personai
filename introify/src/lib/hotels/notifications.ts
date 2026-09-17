import { hotelDesksForRole, type HotelStaffRole } from "./staff"

export type HotelNotifyChannel = "in_app" | "browser" | "email" | "sms" | "whatsapp"

export type HotelNotifyStep = {
    channel: HotelNotifyChannel
    department?: string
    to?: string | null
    stub: boolean
    reason?: string
}

export function hotelNotifyPlan(input: {
    department: string
    type: string
    ownerEmail?: string | null
    emailConfigured: boolean
}): HotelNotifyStep[] {
    const emailTo = input.ownerEmail?.trim() || null
    const emailReady = Boolean(input.emailConfigured && emailTo)
    return [
        { channel: "in_app", department: input.department, stub: false },
        { channel: "browser", stub: false },
        {
            channel: "email",
            to: emailTo,
            stub: !emailReady,
            reason: emailReady ? undefined : "EMAIL_NOT_CONFIGURED",
        },
        { channel: "sms", stub: true, reason: "interface-only" },
        { channel: "whatsapp", stub: true, reason: "interface-only" },
    ]
}

export function hotelEmailCopy(input: { title: string; body: string; hotelName?: string }) {
    const hotel = input.hotelName || "Hotel"
    return {
        subject: `${hotel}: ${input.title}`,
        text: `${input.body}\n\nOpen the hotel requests board to accept or close this ticket.`,
    }
}

export function filterHotelNotices<T extends { department?: string | null }>(
    notices: readonly T[],
    role: HotelStaffRole,
): T[] {
    const desks = hotelDesksForRole(role)
    if (desks == null) return [...notices]
    if (!desks.length) return []
    return notices.filter((row) => row.department != null && desks.includes(row.department))
}
