export const LEAD_STATUSES = [
    { id: "NEW", label: "New" },
    { id: "CONTACTED", label: "Warm" },
    { id: "CLOSED", label: "Won" },
    { id: "LOST", label: "Lost" },
] as const

export function normalizeLeadStatus(raw?: string | null) {
    const s = (raw || "NEW").toUpperCase()
    if (s === "NEW") return "NEW"
    if (s === "CONTACTED" || s === "QUALIFIED" || s === "WARM") return "CONTACTED"
    if (s === "CLOSED" || s === "CONVERTED" || s === "WON") return "CLOSED"
    if (s === "LOST") return "LOST"
    return "NEW"
}

export function leadStatusLabel(raw?: string | null) {
    const id = normalizeLeadStatus(raw)
    return LEAD_STATUSES.find((s) => s.id === id)?.label || "New"
}
