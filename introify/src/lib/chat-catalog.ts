import { formatStoredPrice, type DisplayCurrency } from "@/lib/pricing"
import { catalogDisplayCurrency } from "@/lib/menu"
import { canonicalWhatsAppDigits } from "@/lib/whatsapp/phone"

export type ChatCatalogItem = {
    title: string
    priceCents: number
    currency?: string | null
    diet?: string | null
    category?: string | null
    stock?: number | null
}

/** Digits-only WhatsApp for prompts/chat — same body as wa.me links. Never truncate. */
export function chatWhatsAppDigits(raw?: string | null): string | null {
    return canonicalWhatsAppDigits(raw)
}

export function formatChatCatalogPrice(
    item: ChatCatalogItem,
    roleTemplate: string | null | undefined,
    requestCurrency: DisplayCurrency,
): string {
    const display = catalogDisplayCurrency(roleTemplate, item.currency, requestCurrency)
    return formatStoredPrice(item.priceCents, item.currency, display)
}

/** Compact live menu lines for system/facts — survives prompt clipping better than full prose. */
export function compactCatalogFacts(
    items: ChatCatalogItem[],
    roleTemplate: string | null | undefined,
    requestCurrency: DisplayCurrency,
    limit = 48,
): Array<{ title: string; price: string; diet?: string; category?: string }> {
    return items.slice(0, limit).map((item) => ({
        title: item.title,
        price: formatChatCatalogPrice(item, roleTemplate, requestCurrency),
        ...(item.diet ? { diet: item.diet } : {}),
        ...(item.category ? { category: item.category } : {}),
    }))
}

const QUERY_STOP = new Set([
    "what", "whats", "what's", "is", "the", "a", "an", "of", "for", "to", "me", "tell",
    "please", "price", "cost", "how", "much", "are", "do", "you", "have", "on", "menu",
    "rates", "rate", "rs", "inr",
])

/** Normalize guest text for catalog matching (drop punctuation / collapse spaces). */
export function normalizeCatalogQuery(query: string): string {
    return query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
}

/** Find a catalog dish mentioned in a guest question (title substring / significant tokens). */
export function findCatalogItemByQuery<T extends { title: string }>(items: T[], query: string): T | null {
    const q = normalizeCatalogQuery(query)
    if (!q || !items.length) return null
    const qTokens = q.split(" ").filter((w) => w.length > 1 && !QUERY_STOP.has(w))
    const ranked = items
        .map((item) => {
            const title = item.title.toLowerCase().trim()
            if (!title) return { item, score: 0 }
            // Contiguous title in the question — strongest signal ("…Iced Latte?")
            if (q.includes(title)) return { item, score: title.length + 200 }
            if (title.length > 3 && title.includes(q) && qTokens.length === 0) return { item, score: title.length + 100 }
            const words = title.split(/\s+/).filter((w) => w.length > 2 && !QUERY_STOP.has(w))
            if (!words.length) return { item, score: 0 }
            const hits = words.filter((w) => q.includes(w)).length
            const ordered = words.every((w) => qTokens.includes(w) || q.includes(w))
            if (hits >= 2 || (hits === 1 && words.length === 1) || (ordered && hits === words.length)) {
                return { item, score: hits * 10 + title.length + (ordered ? 5 : 0) }
            }
            return { item, score: 0 }
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
    return ranked[0]?.item || null
}

export function answerCatalogPriceQuestion(opts: {
    query: string
    items: ChatCatalogItem[]
    roleTemplate: string | null | undefined
    requestCurrency: DisplayCurrency
    shopName: string
    whatsapp?: string | null
}): string | null {
    // Price cue: words, Rs/INR, or rupee sign (avoid brittle `|?` / mangled-currency regexes)
    const hasPriceCue =
        /\b(price|cost|how much|rate|rates)\b/i.test(opts.query)
        || /\b(rs\.?|inr)\b/i.test(opts.query)
        || opts.query.includes("₹")
    if (!hasPriceCue) {
        // Still allow bare dish name + "latte?" style — require a price cue OR explicit "what is"
        if (!/\b(what(?:'s| is)|tell me)\b/i.test(opts.query)) return null
    }
    const hit = findCatalogItemByQuery(opts.items, opts.query)
    if (!hit) return null
    const price = formatChatCatalogPrice(hit, opts.roleTemplate, opts.requestCurrency)
    const wa = chatWhatsAppDigits(opts.whatsapp)
    const next = wa
        ? `Want it on the menu, or WhatsApp ${opts.shopName} at ${wa}?`
        : `Open the menu to add it.`
    return `**${hit.title}** is ${price} on the live menu.\n\n${next}`
}
