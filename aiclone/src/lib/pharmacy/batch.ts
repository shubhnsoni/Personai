export type MedicineBatch = {
    batch: string
    expiry: string // YYYY-MM-DD
    mrpPaise: number
}

export function parseMedicine(variantsJson?: string | null): MedicineBatch | null {
    if (!variantsJson) return null
    try {
        const o = JSON.parse(variantsJson) as { medicine?: MedicineBatch }
        const m = o?.medicine
        if (!m || typeof m.batch !== "string" || typeof m.expiry !== "string") return null
        return {
            batch: m.batch,
            expiry: m.expiry,
            mrpPaise: Number(m.mrpPaise) || 0,
        }
    } catch {
        return null
    }
}

export function writeMedicine(existing: string | null | undefined, medicine: MedicineBatch) {
    let o: Record<string, unknown> = {}
    try { o = JSON.parse(existing || "{}") as Record<string, unknown> } catch { o = {} }
    o.medicine = medicine
    return JSON.stringify(o)
}

export function expiryState(expiry: string, now = new Date()): "ok" | "soon" | "expired" {
    const t = Date.parse(expiry)
    if (!Number.isFinite(t)) return "ok"
    const days = (t - now.getTime()) / 86400000
    if (days < 0) return "expired"
    if (days <= 90) return "soon"
    return "ok"
}

export function isPharmacy(role?: string | null) {
    return role === "PHARMACY"
}

export function medicineLine(variantsJson?: string | null, now = new Date()): string | null {
    const m = parseMedicine(variantsJson)
    if (!m) return null
    const state = expiryState(m.expiry, now)
    if (state === "expired") return `Expired ${m.expiry}`
    if (state === "soon") return `Exp ${m.expiry}`
    return `Batch ${m.batch}`
}

export function isExpiredMedicine(variantsJson?: string | null, now = new Date()) {
    const m = parseMedicine(variantsJson)
    if (!m) return false
    return expiryState(m.expiry, now) === "expired"
}
