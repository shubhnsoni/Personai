export function defaultPrepMinutesFromConfig(raw?: string | null) {
    try {
        const n = Number((JSON.parse(raw || "{}") as { defaultPrepMinutes?: unknown }).defaultPrepMinutes)
        if (Number.isFinite(n) && n >= 1 && n <= 90) return Math.floor(n)
    } catch { /* ignore */ }
    return 15
}

export function writeDefaultPrepMinutes(raw: string | null | undefined, minutes: number) {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    bag.defaultPrepMinutes = Math.max(1, Math.min(90, Math.floor(minutes)))
    return JSON.stringify(bag)
}

export function payModeFromConfig(raw?: string | null): "PREPAID" | "LATER" {
    try {
        const parsed = JSON.parse(raw || "{}") as { payMode?: unknown }
        return parsed.payMode === "PREPAID" ? "PREPAID" : "LATER"
    } catch {
        return "LATER"
    }
}

export function writePayMode(raw: string | null | undefined, mode: "PREPAID" | "LATER") {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    bag.payMode = mode
    return JSON.stringify(bag)
}

export function paymentQrUrlFromConfig(raw?: string | null): string | null {
    try {
        const parsed = JSON.parse(raw || "{}") as { paymentQrUrl?: unknown }
        const url = parsed.paymentQrUrl
        if (typeof url !== "string") return null
        const clean = url.trim()
        if (!clean.startsWith("/") && !clean.startsWith("https://")) return null
        return clean.slice(0, 500)
    } catch {
        return null
    }
}

export function writePaymentQrUrl(raw: string | null | undefined, url: string | null) {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    if (url) bag.paymentQrUrl = url
    else delete bag.paymentQrUrl
    return JSON.stringify(bag)
}

export function upiPayHref(opts: {
    upiId: string
    name?: string
    amountRupees?: number
    note?: string
}) {
    const params = new URLSearchParams()
    params.set("pa", opts.upiId.trim())
    if (opts.name) params.set("pn", opts.name.slice(0, 50))
    params.set("cu", "INR")
    if (opts.amountRupees && opts.amountRupees > 0) params.set("am", String(opts.amountRupees))
    if (opts.note) params.set("tn", opts.note.slice(0, 50))
    return `upi://pay?${params.toString()}`
}
