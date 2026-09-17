export type HotelStayPhase = "pre_arrival" | "during" | "checkout" | "after"
export type StayFeedbackTone = "positive" | "negative" | "neutral"

function ymdInKolkata(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date)
}

export function hotelStayPhase(input: {
    now?: Date
    arrival?: Date | null
    departure?: Date | null
    checkInTime?: string | null
    checkOutTime?: string | null
}): HotelStayPhase | null {
    if (!input.arrival && !input.departure) return null
    const now = input.now ?? new Date()
    if (input.arrival && now < input.arrival) return "pre_arrival"
    if (input.departure && now >= input.departure) return "after"
    if (input.departure && ymdInKolkata(now) === ymdInKolkata(input.departure)) return "checkout"
    return "during"
}

export function stayFeedbackTone(text: string): StayFeedbackTone {
    const lower = text.toLowerCase()
    const negative = /\b(poor|bad|terrible|awful|disappoint|loud|worst|never again|rude|dirty)/.test(lower)
    const positive = /\b(love|loved|amazing|wonderful|great|excellent|fantastic|perfect|best)\b/.test(lower)
    if (negative) return "negative"
    if (positive) return "positive"
    return "neutral"
}

export function hotelGoogleReviewSearchUrl(name: string, locality = "Ranchi") {
    const query = `${name} ${locality} reviews`.replace(/\s+/g, " ").trim()
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}
