/** E.164 + India last-10 helpers for WhatsApp shop intake allowlist. */

export function digitsOnly(raw?: string | null): string {
    return (raw || "").replace(/\D/g, "")
}

/**
 * Normalize a phone to E.164.
 * - Already +… → keep digits with leading +
 * - 10 digits → assume India (+91)
 * - 11–15 digits starting with country code → prefix +
 * - whatsapp:+E164 / wa.me forms accepted
 */
export function normalizeE164(raw?: string | null, defaultCountry = "91"): string | null {
    if (!raw?.trim()) return null
    let s = raw.trim()
    if (s.toLowerCase().startsWith("whatsapp:")) s = s.slice("whatsapp:".length).trim()
    const hasPlus = s.includes("+") || s.startsWith("+")
    const digits = digitsOnly(s)
    if (!digits) return null
    if (hasPlus || digits.length > 10) {
        // Strip leading 00
        const body = digits.replace(/^00/, "")
        if (body.length < 8 || body.length > 15) return null
        return `+${body}`
    }
    if (digits.length === 10 && defaultCountry) {
        return `+${defaultCountry}${digits}`
    }
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`
    return null
}

export function last10Digits(raw?: string | null): string | null {
    const d = digitsOnly(raw)
    if (d.length < 10) return null
    return d.slice(-10)
}

/** True when two phone strings refer to the same handset (E.164 or last-10). */
export function phonesMatch(a?: string | null, b?: string | null): boolean {
    const ea = normalizeE164(a)
    const eb = normalizeE164(b)
    if (ea && eb && ea === eb) return true
    const la = last10Digits(a)
    const lb = last10Digits(b)
    return Boolean(la && lb && la === lb)
}
