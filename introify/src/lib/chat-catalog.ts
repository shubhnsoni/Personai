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

/** Find a catalog dish mentioned in a guest question (title substring, case-insensitive). */
export function findCatalogItemByQuery<T extends { title: string }>(items: T[], query: string): T | null {
    const q = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
    if (!q || !items.length) return null
    const ranked = items
        .map((item) => {
            const title = item.title.toLowerCase()
            if (q.includes(title) || title.includes(q)) return { item, score: title.length + 100 }
            const words = title.split(/\s+/).filter((w) => w.length > 2)
            const hits = words.filter((w) => q.includes(w)).length
            return { item, score: hits >= 2 || (hits === 1 && words.length === 1) ? hits * 10 + title.length : 0 }
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
    if (!/\b(price|cost|how much|rates?)\b/i.test(opts.query) && !/\brs\.?\b|\binr\b|₹/i.test(opts.query)) {
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
