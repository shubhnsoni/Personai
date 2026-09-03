export type Diet = "VEG" | "NONVEG" | "EGG" | "VEGAN"
export type ServeWindow = "ALL" | "BREAKFAST" | "LUNCH" | "DINNER"

export function isRestaurant(role?: string | null) {
    return role === "RESTAURANT"
}

export function catalogLabel(role?: string | null) {
    if (isRestaurant(role)) return "Menu"
    if (role === "JEWELRY_RETAIL") return "Jewellery"
    if (role === "JEWELRY_WHOLESALE") return "Stock"
    if (role === "DISTRIBUTOR") return "Inventory"
    if (role === "PHARMACY") return "Medicines"
    if (role === "AUTO_PARTS") return "Parts"
    return "Shop"
}

export function catalogPath(slug: string, role?: string | null) {
    return isRestaurant(role) ? `/${slug}/menu` : `/${slug}/shop`
}

export function parseDiet(raw?: string | null): Diet | null {
    const s = (raw || "").trim().toLowerCase()
    if (!s) return null
    if (/\bvegan\b/.test(s)) return "VEGAN"
    if (/\begg\b/.test(s)) return "EGG"
    if (/\b(non[-\s]?veg|nonveg|nv|chicken|mutton|fish|prawn|eggless no)\b/.test(s)) return "NONVEG"
    if (/\b(veg|vegetarian|pure veg)\b/.test(s)) return "VEG"
    if (s === "veg") return "VEG"
    if (s === "nonveg" || s === "non-veg") return "NONVEG"
    if (["VEG", "NONVEG", "EGG", "VEGAN"].includes(raw || "")) return raw as Diet
    return null
}

export function dietLabel(diet?: string | null) {
    switch (diet) {
        case "VEG":
            return "Veg"
        case "NONVEG":
            return "Non-veg"
        case "EGG":
            return "Egg"
        case "VEGAN":
            return "Vegan"
        default:
            return null
    }
}

export function dietDotClass(diet?: string | null) {
    switch (diet) {
        case "VEG":
        case "VEGAN":
            return "bg-emerald-500"
        case "EGG":
            return "bg-amber-400"
        case "NONVEG":
            return "bg-rose-500"
        default:
            return "bg-zinc-500"
    }
}

export function spiceDots(level?: number | null) {
    const n = Math.max(0, Math.min(3, Number(level) || 0))
    return n
}

export function serveLabel(window?: string | null) {
    switch (window) {
        case "BREAKFAST":
            return "Breakfast"
        case "LUNCH":
            return "Lunch"
        case "DINNER":
            return "Dinner"
        case "ALL":
            return "All day"
        default:
            return null
    }
}

export function readyLabel(category?: string | null, serve?: string | null) {
    if (category === "Coffee") return "Ready in 4 min"
    if (category === "Bakery") return "Ready now"
    if (serve === "Breakfast") return "Ready in 12 min"
    if (serve === "Lunch") return "Ready in 14 min"
    return "Ready in 10 min"
}

export function parseReservation(metadata?: string | null) {
    if (!metadata) return { partySize: 1, phone: "", notes: "" }
    try {
        const parsed = JSON.parse(metadata) as { partySize?: number; phone?: string; notes?: string }
        const n = Number(parsed.partySize)
        return {
            partySize: Number.isFinite(n) && n > 0 ? Math.min(80, Math.floor(n)) : 1,
            phone: parsed.phone || "",
            notes: parsed.notes || "",
        }
    } catch {
        return { partySize: 1, phone: "", notes: "" }
    }
}

export function parsePartySize(metadata?: string | null) {
    return parseReservation(metadata).partySize
}

export function reservationLabel(metadata?: string | null, fallback = "") {
    if (!metadata) return fallback
    try {
        const parsed = JSON.parse(metadata) as { partySize?: number }
        if (parsed.partySize) return `Table for ${parsed.partySize}`
    } catch { /* ignore */ }
    return fallback
}

export function localDateKey(d = new Date()) {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function filterPastSlots(dateStr: string, slots: string[], leadMinutes = 15) {
    if (dateStr !== localDateKey()) return slots
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes() + leadMinutes
    return slots.filter((s) => {
        const [h, m] = s.split(":").map(Number)
        return (h || 0) * 60 + (m || 0) >= nowMin
    })
}

export function hoursToday(
    schedules: { dayOfWeek: number; startTime: string; endTime: string; isEnabled: boolean }[],
    now = new Date(),
) {
    const row = schedules.find((s) => s.dayOfWeek === now.getDay())
    if (!row || !row.isEnabled) return "Closed today"
    return `Open today ${row.startTime}–${row.endTime}`
}

export function isHoldBooking(metadata?: string | null, email?: string | null) {
    if (email === "hold@local") return true
    if (!metadata) return false
    try {
        return Boolean((JSON.parse(metadata) as { hold?: boolean }).hold)
    } catch {
        return false
    }
}
