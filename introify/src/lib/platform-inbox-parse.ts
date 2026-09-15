export type InquiryKind = "WAITLIST" | "CONTACT"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const recent = new Map<string, number>()

export function validEmail(value: string) {
    return EMAIL_RE.test(value.trim().toLowerCase()) && value.trim().length <= 160
}

export function normalizeInquiryEmail(value: string) {
    return value.trim().toLowerCase()
}

export function inquiryRateLimited(key: string, windowMs = 60_000) {
    const now = Date.now()
    const last = recent.get(key) || 0
    if (now - last < windowMs) return true
    recent.set(key, now)
    if (recent.size > 2000) {
        for (const [entry, at] of recent) {
            if (now - at > windowMs * 4) recent.delete(entry)
        }
    }
    return false
}

export function parseInquiryInput(input: {
    kind: InquiryKind
    email?: string
    name?: string
    message?: string
    plan?: string
    cadence?: string
    honeypot?: string
}) {
    if (input.honeypot && input.honeypot.trim()) return { spam: true as const }
    const email = normalizeInquiryEmail(input.email || "")
    if (!validEmail(email)) return { error: "Enter a valid email address." }
    const name = (input.name || "").trim().slice(0, 120) || null
    const message = (input.message || "").trim().slice(0, 4000) || null
    if (input.kind === "CONTACT" && (!message || message.length < 8)) return { error: "Write a short message so we know how to help." }
    const plan = input.plan === "pro" || input.plan === "business" ? input.plan : null
    const cadence = input.cadence === "yearly" || input.cadence === "monthly" ? input.cadence : null
    return { email, name, message, plan, cadence }
}
