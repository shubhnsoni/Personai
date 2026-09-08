export type MedicineBatch = {
    batch: string
    expiry: string // YYYY-MM-DD
    mrpPaise: number
    rxRequired?: boolean
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const RX_PREFIX = "RX|"

function asBag(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
    if (Array.isArray(raw)) return { variants: raw }
    return {}
}

export function parseMedicine(variantsJson?: string | null): MedicineBatch | null {
    if (!variantsJson) return null
    try {
        const o = asBag(JSON.parse(variantsJson) as unknown)
        const m = o?.medicine as MedicineBatch | undefined
        if (!m || typeof m.batch !== "string" || typeof m.expiry !== "string") return null
        return {
            batch: m.batch,
            expiry: m.expiry,
            mrpPaise: Number(m.mrpPaise) || 0,
            rxRequired: Boolean(m.rxRequired),
        }
    } catch {
        return null
    }
}

export function writeMedicine(existing: string | null | undefined, medicine: MedicineBatch | null) {
    let o: Record<string, unknown> = {}
    try { o = asBag(JSON.parse(existing || "{}") as unknown) } catch { o = {} }
    if (medicine) o.medicine = medicine
    else delete o.medicine
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

export function isRxRequired(variantsJson?: string | null) {
    return Boolean(parseMedicine(variantsJson)?.rxRequired)
}

export function medicineLine(variantsJson?: string | null, now = new Date()): string | null {
    const m = parseMedicine(variantsJson)
    if (!m) return null
    const state = expiryState(m.expiry, now)
    if (state === "expired") return `Expired ${m.expiry}`
    if (state === "soon") return `Exp ${m.expiry}`
    return m.rxRequired ? `Rx · Batch ${m.batch}` : `Batch ${m.batch}`
}

export function shopExpiryLine(variantsJson?: string | null, now = new Date()): { text: string; warn: boolean } | null {
    const m = parseMedicine(variantsJson)
    if (!m) return null
    const state = expiryState(m.expiry, now)
    if (state === "expired") return null
    const t = Date.parse(m.expiry)
    if (!Number.isFinite(t)) return null
    const d = new Date(t)
    const exp = `Exp · ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    return { text: exp, warn: state === "soon" }
}

export function isExpiredMedicine(variantsJson?: string | null, now = new Date()) {
    const m = parseMedicine(variantsJson)
    if (!m) return false
    return expiryState(m.expiry, now) === "expired"
}

export function writeBuyerPrescription(note: string | null | undefined, prescriptionUrl: string | null | undefined) {
    const parsed = parseBuyerPrescription(note)
    const rest = parsed.note || ""
    if (!prescriptionUrl?.trim()) return rest || null
    const head = `${RX_PREFIX}${prescriptionUrl.trim()}`
    return rest ? `${head} ${rest}` : head
}

export function parseBuyerPrescription(note?: string | null): { url: string | null; note: string | null } {
    if (!note) return { url: null, note: null }
    if (!note.startsWith(RX_PREFIX)) return { url: null, note }
    const space = note.indexOf(" ")
    if (space < 0) return { url: note.slice(RX_PREFIX.length) || null, note: null }
    return {
        url: note.slice(RX_PREFIX.length, space) || null,
        note: note.slice(space + 1).trim() || null,
    }
}

export function formatRxBuyerNote(rxNote?: string | null, doctorName?: string | null) {
    const doc = doctorName?.trim()
    const note = rxNote?.trim()
    return [doc ? (doc.toLowerCase().startsWith("dr") ? doc : `Dr. ${doc}`) : null, note].filter(Boolean).join(" · ") || null
}

export function rxAttachmentOk(input: { prescriptionUrl?: string | null; rxNote?: string | null }) {
    return Boolean(input.prescriptionUrl?.trim() || input.rxNote?.trim())
}

/** Gate: OTC always ok; Rx SKUs need a photo URL and/or a short Rx note. */
export function canPurchaseRxSku(
    variantsJson: string | null | undefined,
    attachment: { prescriptionUrl?: string | null; rxNote?: string | null },
) {
    if (!isRxRequired(variantsJson)) return true
    return rxAttachmentOk(attachment)
}

