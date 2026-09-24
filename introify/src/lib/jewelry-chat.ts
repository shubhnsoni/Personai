import { chatWhatsAppDigits, findCatalogItemByQuery, formatChatCatalogPrice, normalizeCatalogQuery, type ChatCatalogItem } from "@/lib/chat-catalog"
import { goldBoardFromConfig, type GoldBoard } from "@/lib/metal/board"
import { formatRatePerGram, isJewelryKit, isJewelryRetail } from "@/lib/metal/math"
import type { DisplayCurrency } from "@/lib/pricing"
import { resolveKitRole } from "@/lib/role-alias"

export type JewelryChatBoard = Pick<GoldBoard, "city" | "k22PaisePer10g" | "k24PaisePer10g" | "k18PaisePer10g">

/** JEWELRY_RETAIL (and wholesale metal kits) — prefer in-app /menu + City Rates over phone-only or invented visits. */
export function prefersJewelryMenuPath(role?: string | null, goal?: string | null): boolean {
    if (isJewelryKit(role)) return true
    const kit = resolveKitRole(role)
    if (kit === "JEWELRY_RETAIL" || kit === "JEWELRY_WHOLESALE") return true
    // SELL_PRODUCTS metal showrooms that keep the jewelry roleTemplate.
    if (goal === "SELL_PRODUCTS" && isJewelryRetail(role)) return true
    return false
}

export function jewelryMenuPath(slug: string): string {
    const clean = (slug || "").replace(/^\/+|\/+$/g, "")
    return clean ? `/${clean}/menu` : "/menu"
}

export function formatJewelryCityRates(board?: JewelryChatBoard | null): string | null {
    if (!board || board.k22PaisePer10g <= 0 || board.k24PaisePer10g <= 0) return null
    const city = (board.city || "").trim() || "City"
    return `**City Rates** (${city}): 22K ${formatRatePerGram(board.k22PaisePer10g)} · 24K ${formatRatePerGram(board.k24PaisePer10g)}`
}

export function jewelryMenuPrimaryCta(opts: { slug: string; role?: string | null }): string {
    const href = jewelryMenuPath(opts.slug)
    if (isJewelryRetail(opts.role) || resolveKitRole(opts.role) === "JEWELRY_RETAIL") {
        return `Open ${href} for Jewellery pieces and the City Rates board (22K / 24K ₹/g).`
    }
    return `Open ${href} for stock and today's board.`
}

export function jewelryMenuSecondaryWa(whatsapp?: string | null, shopName?: string): string | null {
    const wa = chatWhatsAppDigits(whatsapp)
    if (!wa) return null
    const who = (shopName || "").trim() || "the showroom"
    return `WhatsApp ${who} at ${wa} or walk in — secondary to the menu, not the only path.`
}

/** When /book has no Free bookable offerings — never invent visit-booking fields. */
export function jewelryNoBookSteer(opts: {
    slug: string
    shopName: string
    role?: string | null
    whatsapp?: string | null
}): string {
    const name = opts.shopName.trim() || "This showroom"
    const primary = jewelryMenuPrimaryCta({ slug: opts.slug, role: opts.role })
    const wa = jewelryMenuSecondaryWa(opts.whatsapp, name)
    return `${name} does not take bookable visits online. Browse Jewellery on the menu, WhatsApp the floor, or walk in.\n\n${primary}${wa ? `\n\n${wa}` : ""}`
}

export function jewelryMenuPromptGuidance(opts: {
    slug?: string | null
    role?: string | null
    goal?: string | null
    hasCatalog: boolean
    hasBoard: boolean
    hasBookableServices: boolean
    whatsapp?: string | null
}): string[] {
    if (!prefersJewelryMenuPath(opts.role, opts.goal)) return []
    const href = opts.slug ? jewelryMenuPath(opts.slug) : "/menu"
    const lines = [
        `When they ask bridal, mangalsutra, gold rate, City Rates, or catalogue: cite listed SKUs and/or the City Rates board and deep-link ${href}. Never claim stock is unlisted when the menu has pieces.`,
        "Never invent visit-booking fields, appointment slots, or a bookable visit form when /book has no Free offerings — steer to Jewellery / WhatsApp / walk-in instead.",
        "Never tell them phone or off-platform confirmation is the only way to see rates or catalogue when the menu or City Rates board is published.",
    ]
    if (!opts.hasCatalog && !opts.hasBoard) {
        lines.push("If catalogue and City Rates are empty, say so honestly and offer WhatsApp or walk-in — do not invent a rate or SKU.")
    }
    if (!opts.hasBookableServices) {
        lines.push("This kit has no Free bookable offerings on /book — do not invent visit booking.")
    }
    const wa = jewelryMenuSecondaryWa(opts.whatsapp)
    if (wa) lines.push(`WhatsApp may stay as a secondary CTA only. ${wa}`)
    return lines
}

/**
 * Deterministic desk reply for bridal / mangalsutra / gold-rate / catalogue asks on jewelry kits.
 * Mirrors appointment-chat short-circuit — no live LLM required for the /menu + City Rates cite.
 */
export function answerJewelryCatalogOrRate(opts: {
    query: string
    slug: string
    shopName: string
    roleTemplate: string | null | undefined
    primaryGoal?: string | null
    items: ChatCatalogItem[]
    requestCurrency: DisplayCurrency
    whatsapp?: string | null
    board?: JewelryChatBoard | null
    /** Free / active service offerings on /book — empty means do not invent visits. */
    hasBookableServices?: boolean
    personalityConfig?: string | null
}): string | null {
    if (!prefersJewelryMenuPath(opts.roleTemplate, opts.primaryGoal)) return null
    if (!opts.slug) return null

    const q = normalizeCatalogQuery(opts.query)
    if (!q) return null

    const board = opts.board || goldBoardFromConfig(opts.personalityConfig || null)
    const ratesLine = formatJewelryCityRates(board)
    const hasCatalog = opts.items.length > 0
    const hasBoard = Boolean(ratesLine)

    const catalogIntent =
        /\b(bridal|bride|wedding|mangalsutra|mangal\s*sutra|jewellery|jewelry|bangle|bangles|chain|necklace|pendant|ring|rings|studs|kada|coin|gold (piece|set|jewellery|jewelry)|catalogue|catalog|stock|in stock|do you (have|sell)|show (me )?(bridal|gold|jewellery|jewelry))\b/i.test(
            opts.query,
        )
    const rateIntent =
        /\b(gold rate|gold rates|city rate|city rates|today'?s (gold|rate|board)|board rate|22k|24k|18k|₹\s*\/\s*g|per gram|purity|making charge)\b/i.test(
            opts.query,
        )
        || (/\b(rate|rates|price|cost|how much)\b/i.test(opts.query)
            && /\b(gold|22k|24k|board|city)\b/i.test(opts.query))
    const visitBookIntent =
        /\b(book (a )?(visit|appointment|slot|call)|schedule (a )?(visit|appointment)|visit booking|bookable visit|reserve (a )?visit|book online)\b/i.test(
            opts.query,
        )

    if (!catalogIntent && !rateIntent && !visitBookIntent) {
        // Bare SKU / piece name with price cue still grounded via catalog hit below.
        const hasPriceCue =
            /\b(price|cost|how much|rate|rates)\b/i.test(opts.query)
            || /\b(rs\.?|inr)\b/i.test(opts.query)
            || opts.query.includes("₹")
            || /\b(what(?:'s| is)|tell me|do you have)\b/i.test(opts.query)
        if (!hasPriceCue) return null
    }

    if (visitBookIntent && !opts.hasBookableServices) {
        return jewelryNoBookSteer({
            slug: opts.slug,
            shopName: opts.shopName,
            role: opts.roleTemplate,
            whatsapp: opts.whatsapp,
        })
    }

    if (!hasCatalog && !hasBoard && !visitBookIntent) return null

    const primary = jewelryMenuPrimaryCta({ slug: opts.slug, role: opts.roleTemplate })
    const wa = jewelryMenuSecondaryWa(opts.whatsapp, opts.shopName)
    const waBlock = wa ? `\n\n${wa}` : ""
    const ratesBlock = ratesLine ? `${ratesLine}\n\n` : ""

    const hit = hasCatalog ? findCatalogItemByQuery(opts.items, opts.query) : null
    if (hit) {
        const price = formatChatCatalogPrice(hit, opts.roleTemplate, opts.requestCurrency)
        return `${ratesBlock}**${hit.title}** is ${price} on the live Jewellery menu.\n\n${primary}${waBlock}`
    }

    if (rateIntent && ratesLine) {
        const samples = hasCatalog
            ? opts.items.slice(0, 4).map((item) => {
                const price = formatChatCatalogPrice(item, opts.roleTemplate, opts.requestCurrency)
                return `- **${item.title}**: ${price}`
            })
            : []
        const list = samples.length
            ? `\n\nSample pieces on the menu:\n${samples.join("\n")}`
            : ""
        return `${ratesLine}${list}\n\n${primary}${waBlock}`
    }

    if (catalogIntent && hasCatalog) {
        const listed = opts.items.slice(0, 6).map((item) => {
            const price = formatChatCatalogPrice(item, opts.roleTemplate, opts.requestCurrency)
            return `- **${item.title}**: ${price}`
        })
        return `${ratesBlock}Here is Jewellery on the menu at ${opts.shopName}:\n${listed.join("\n")}\n\n${primary}${waBlock}`
    }

    if (rateIntent || catalogIntent) {
        // Board or catalog empty for this ask — still deep-link /menu, never phone-only invent.
        if (ratesLine) return `${ratesLine}\n\n${primary}${waBlock}`
        if (hasCatalog) {
            const listed = opts.items.slice(0, 6).map((item) => {
                const price = formatChatCatalogPrice(item, opts.roleTemplate, opts.requestCurrency)
                return `- **${item.title}**: ${price}`
            })
            return `Here is Jewellery on the menu at ${opts.shopName}:\n${listed.join("\n")}\n\n${primary}${waBlock}`
        }
    }

    return null
}
