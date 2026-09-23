import { bookChip } from "@/lib/kit-copy"
import { catalogDisplayCurrency } from "@/lib/menu"
import { formatStoredPrice, type DisplayCurrency } from "@/lib/pricing"
import { resolveKitRole } from "@/lib/role-alias"
import { chatWhatsAppDigits, findCatalogItemByQuery, normalizeCatalogQuery } from "@/lib/chat-catalog"

export type AppointmentChatService = {
    name: string
    description?: string | null
    priceCents: number
    currency?: string | null
    isFree?: boolean
    durationMinutes?: number | null
}

/** TAKE_APPOINTMENTS goal or salon/barber/gym kit — prefer in-app /book over WA-only. */
export function prefersAppointmentBookPath(role?: string | null, goal?: string | null): boolean {
    if (goal === "TAKE_APPOINTMENTS") return true
    return resolveKitRole(role) === "SALON_SPA"
}

export function appointmentBookPath(slug: string): string {
    const clean = (slug || "").replace(/^\/+|\/+$/g, "")
    return clean ? `/${clean}/book` : "/book"
}

/** Honest book-ask noun for prompt guidance (flavor before salon kit alias). */
export function appointmentBookAskNoun(role?: string | null): string {
    const raw = (role || "").trim().toUpperCase()
    if (raw === "CLINIC") return "appointment or consultation"
    if (raw === "GYM") return "session, PT, or class"
    if (raw === "YOGA") return "class or session"
    if (raw === "BARBER") return "haircut/treatment"
    if (raw === "EVENTS_STUDIO" || raw === "PHOTOGRAPHER" || raw === "CATERER" || raw === "TRAVEL") {
        return "call, enquire, or shoot"
    }
    if (resolveKitRole(role) === "SALON_SPA") return "treatment/haircut"
    return "booking"
}

export function formatAppointmentServicePrice(
    service: AppointmentChatService,
    roleTemplate: string | null | undefined,
    requestCurrency: DisplayCurrency,
): string {
    if (service.isFree || service.priceCents <= 0) return "Free"
    const display = catalogDisplayCurrency(roleTemplate, service.currency, requestCurrency)
    return formatStoredPrice(service.priceCents, service.currency, display)
}

export function appointmentBookPrimaryCta(opts: {
    slug: string
    role?: string | null
}): string {
    const chip = bookChip(opts.role)
    const href = appointmentBookPath(opts.slug)
    return `Tap **${chip}** or open ${href} to pick a service and slot.`
}

export function appointmentBookSecondaryWa(whatsapp?: string | null, shopName?: string): string | null {
    const wa = chatWhatsAppDigits(whatsapp)
    if (!wa) return null
    const who = (shopName || "").trim() || "the desk"
    return `WhatsApp ${who} at ${wa} is optional if you prefer a human — not the only booking path.`
}

/** System-prompt lines: Book / /book first, WA secondary when slots/services exist. */
export function appointmentBookPromptGuidance(opts: {
    slug?: string | null
    role?: string | null
    goal?: string | null
    hasServices: boolean
    whatsapp?: string | null
}): string[] {
    if (!opts.hasServices || !prefersAppointmentBookPath(opts.role, opts.goal)) return []
    const chip = bookChip(opts.role)
    const href = opts.slug ? appointmentBookPath(opts.slug) : "/book"
    const lines = [
        `When they ask how to book, rates, or a ${appointmentBookAskNoun(opts.role)} price: cite in-app **${chip}** or ${href} with honest listed prices (stored currency — no inventing FX).`,
        "Never tell them WhatsApp is the only way to book when services or slots are listed.",
    ]
    const wa = appointmentBookSecondaryWa(opts.whatsapp)
    if (wa) lines.push(`WhatsApp may stay as a secondary CTA only. ${wa}`)
    return lines
}

export function formatShowServicesReply(opts: {
    shopName: string
    slug: string
    role?: string | null
    goal?: string | null
    services: AppointmentChatService[]
    requestCurrency: DisplayCurrency
    whatsapp?: string | null
}): string {
    const name = opts.shopName.trim() || "This business"
    if (!opts.services.length) {
        return `${name} hasn't listed specific services yet, but you can reach out to discuss your needs.`
    }
    const preferBook = prefersAppointmentBookPath(opts.role, opts.goal)
    const serviceList = opts.services
        .map((s) => {
            const price = formatAppointmentServicePrice(s, opts.role, opts.requestCurrency)
            const mins = s.durationMinutes != null ? ` (${s.durationMinutes} min)` : ""
            const desc = s.description ? ` — ${s.description}` : ""
            return `- **${s.name}**: ${price}${mins}${desc}`
        })
        .join("\n")

    if (!preferBook) {
        return `Here are ${name}'s consultation services:\n${serviceList}\n\nWould you like to book any of these?`
    }

    const primary = appointmentBookPrimaryCta({ slug: opts.slug, role: opts.role })
    const wa = appointmentBookSecondaryWa(opts.whatsapp, name)
    const next = wa ? `${primary}\n\n${wa}` : primary
    // Keep "would you like to book" so chat-interface still opens the services rich panel.
    return `Here are ${name}'s services:\n${serviceList}\n\n${next}\n\nWould you like to book any of these?`
}

/**
 * Deterministic desk reply for book/price asks on TAKE_APPOINTMENTS kits.
 * Mirrors restaurant catalog short-circuit — no live LLM required for the Book path cite.
 */
export function answerAppointmentBookOrPrice(opts: {
    query: string
    slug: string
    shopName: string
    roleTemplate: string | null | undefined
    primaryGoal?: string | null
    services: AppointmentChatService[]
    requestCurrency: DisplayCurrency
    whatsapp?: string | null
}): string | null {
    if (!prefersAppointmentBookPath(opts.roleTemplate, opts.primaryGoal)) return null
    if (!opts.slug || !opts.services.length) return null

    const q = normalizeCatalogQuery(opts.query)
    if (!q) return null

    const bookIntent =
        /\b(how (do|can|to) (i |we )?(book|appoint|schedule)|book(ing)?|appointment|appointments|slot|slots|schedule)\b/i.test(
            opts.query,
        )
    const priceIntent =
        /\b(price|cost|how much|rate|rates|fee|fees)\b/i.test(opts.query)
        || /\b(rs\.?|inr)\b/i.test(opts.query)
        || opts.query.includes("₹")

    if (!bookIntent && !priceIntent) return null

    const titled = opts.services.map((s) => ({ title: s.name, ...s }))
    const hit = findCatalogItemByQuery(titled, opts.query)
    const primary = appointmentBookPrimaryCta({ slug: opts.slug, role: opts.roleTemplate })
    const wa = appointmentBookSecondaryWa(opts.whatsapp, opts.shopName)
    const waBlock = wa ? `\n\n${wa}` : ""

    if (hit) {
        const price = formatAppointmentServicePrice(hit, opts.roleTemplate, opts.requestCurrency)
        return `**${hit.name}** is ${price}.\n\n${primary}${waBlock}`
    }

    // General book / rates ask — list a few honest prices then Book path.
    const listed = opts.services.slice(0, 6).map((s) => {
        const price = formatAppointmentServicePrice(s, opts.roleTemplate, opts.requestCurrency)
        return `- **${s.name}**: ${price}`
    })
    return `Here are ${opts.shopName}'s services:\n${listed.join("\n")}\n\n${primary}${waBlock}\n\nWould you like to book any of these?`
}
