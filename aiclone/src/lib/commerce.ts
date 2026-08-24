export type Fulfillment = "DIGITAL" | "PHYSICAL" | "BOTH"

export function isPhysical(fulfillment?: string | null) {
    return fulfillment === "PHYSICAL" || fulfillment === "BOTH"
}

export function isDigital(fulfillment?: string | null) {
    return !fulfillment || fulfillment === "DIGITAL" || fulfillment === "BOTH"
}

export function stockLabel(stock: number | null | undefined) {
    if (stock == null) return null
    if (stock <= 0) return "Sold out"
    if (stock <= 3) return `${stock} left`
    return `${stock} in stock`
}

export function digitsPhone(raw?: string | null) {
    return (raw || "").replace(/\D/g, "")
}

export function whatsappHref(phone: string | null | undefined, text: string) {
    const n = digitsPhone(phone)
    if (!n) return null
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

export function parseVariants(raw?: string | null): { name: string; stock?: number }[] {
    if (!raw?.trim()) return []
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return parsed
                .map((v) => ({ name: String(v.name || v).trim(), stock: typeof v.stock === "number" ? v.stock : undefined }))
                .filter((v) => v.name)
        }
    } catch {
        /* lines */
    }
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name }))
}

export function parseGallery(raw?: string | null, fallback?: string | null): string[] {
    const out: string[] = []
    if (raw?.trim()) {
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const url = typeof item === "string" ? item : item?.url
                    if (url) out.push(url)
                }
            }
        } catch {
            if (raw.startsWith("http") || raw.startsWith("/")) out.push(raw)
        }
    }
    if (fallback && !out.includes(fallback)) out.unshift(fallback)
    return out.filter(Boolean)
}

export function galleryToJson(urls: string[]) {
    const clean = urls.filter(Boolean)
    return clean.length ? JSON.stringify(clean) : null
}

export function variantsToJson(lines: string) {
    const items = lines
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((name) => ({ name }))
    return items.length ? JSON.stringify(items) : null
}
