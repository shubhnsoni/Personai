import { chatWhatsAppDigits, formatChatCatalogPrice, normalizeCatalogQuery, type ChatCatalogItem } from "@/lib/chat-catalog"
import { fitmentLine, isAutoParts, parseFitment, type VehicleFitment } from "@/lib/autoparts/fitment"
import type { DisplayCurrency } from "@/lib/pricing"
import { resolveKitRole } from "@/lib/role-alias"

/** Catalog row for fitment-aware auto-parts chat (variantsJson from DigitalProduct). */
export type AutoPartsCatalogItem = ChatCatalogItem & {
    variantsJson?: string | null
    sku?: string | null
    description?: string | null
}

/** AUTO_PARTS retail kits — prefer in-app /menu + published fitment over phone/WA-only. */
export function prefersAutoPartsMenuPath(role?: string | null, goal?: string | null): boolean {
    if (isAutoParts(role)) return true
    const kit = resolveKitRole(role)
    if (kit === "AUTO_PARTS") return true
    if (goal === "SELL_PRODUCTS" && (role === "AUTO_PARTS" || kit === "AUTO_PARTS")) return true
    return false
}

export function autoPartsMenuPath(slug: string): string {
    const clean = (slug || "").replace(/^\/+|\/+$/g, "")
    return clean ? `/${clean}/menu` : "/menu"
}

export function formatFitmentLine(variantsJson?: string | null): string | null {
    return fitmentLine(variantsJson)
}

export function autoPartsMenuPrimaryCta(opts: { slug: string }): string {
    const href = autoPartsMenuPath(opts.slug)
    return `Open ${href} for Parts with published make/model/year fitment.`
}

export function autoPartsMenuSecondaryWa(whatsapp?: string | null, shopName?: string): string | null {
    const wa = chatWhatsAppDigits(whatsapp)
    if (!wa) return null
    const who = (shopName || "").trim() || "the counter"
    return `WhatsApp ${who} at ${wa} — secondary to the Parts menu, not the only path.`
}

export function autoPartsMenuPromptGuidance(opts: {
    slug?: string | null
    role?: string | null
    goal?: string | null
    hasCatalog: boolean
    whatsapp?: string | null
}): string[] {
    if (!prefersAutoPartsMenuPath(opts.role, opts.goal)) return []
    const href = opts.slug ? autoPartsMenuPath(opts.slug) : "/menu"
    const lines = [
        `When they ask brake pads, oil filters, fitment, spares, or parts for a make/model (e.g. Swift): cite catalog SKUs that publish a fitment line and deep-link ${href}. Never invent a fitment year range.`,
        "Never present a part as fitting a vehicle it is not published for (e.g. do not sell an i20 oil filter as a Swift fit without an explicit caveat).",
        "Never tell them phone or WhatsApp is the only way to see fitment or stock when the Parts menu publishes SKUs with fitment.",
    ]
    if (!opts.hasCatalog) {
        lines.push("If the Parts catalogue is empty, say so honestly and offer WhatsApp — do not invent a SKU or fitment.")
    }
    const wa = autoPartsMenuSecondaryWa(opts.whatsapp)
    if (wa) lines.push(`WhatsApp may stay as a secondary CTA only. ${wa}`)
    return lines
}

const PART_INTENTS: Array<{ key: string; re: RegExp; titleHints: RegExp }> = [
    { key: "brake_pad", re: /\b(brake\s*pads?|pads?)\b/i, titleHints: /\bbrake\s*pad\b/i },
    { key: "oil_filter", re: /\b(oil\s*filters?)\b/i, titleHints: /\boil\s*filter\b/i },
    { key: "air_filter", re: /\b(air\s*filters?)\b/i, titleHints: /\bair\s*filter\b/i },
    { key: "cabin_filter", re: /\b(cabin\s*filters?|pollen\s*filters?)\b/i, titleHints: /\bcabin\s*filter\b/i },
    { key: "battery", re: /\b(batter(?:y|ies)|35ah)\b/i, titleHints: /\bbattery\b/i },
    { key: "wiper", re: /\b(wiper\s*blades?|wipers?)\b/i, titleHints: /\bwiper\b/i },
    { key: "clutch", re: /\b(clutch\s*plates?|clutch)\b/i, titleHints: /\bclutch\b/i },
    { key: "spark", re: /\b(spark\s*plugs?)\b/i, titleHints: /\bspark\s*plug\b/i },
    { key: "hose", re: /\b(radiator\s*hoses?|hoses?)\b/i, titleHints: /\bhose\b/i },
    { key: "brake_disc", re: /\b(brake\s*discs?|discs?|rotors?)\b/i, titleHints: /\bbrake\s*disc\b|\bdisc\b/i },
]

/** Common India passenger-car aliases → catalog make/model. */
const VEHICLE_ALIASES: Array<{ re: RegExp; make: string; model: string }> = [
    { re: /\b(?:maruti\s+)?swift\b/i, make: "Maruti", model: "Swift" },
    { re: /\b(?:hyundai\s+)?i20\b/i, make: "Hyundai", model: "i20" },
    { re: /\b(?:maruti\s+)?alto\b/i, make: "Maruti", model: "Alto" },
    { re: /\b(?:tata\s+)?nexon\b/i, make: "Tata", model: "Nexon" },
    { re: /\b(?:honda\s+)?city\b/i, make: "Honda", model: "City" },
    { re: /\b(?:mahindra\s+)?bolero\b/i, make: "Mahindra", model: "Bolero" },
]

function detectVehicle(query: string): { make: string; model: string } | null {
    for (const row of VEHICLE_ALIASES) {
        if (row.re.test(query)) return { make: row.make, model: row.model }
    }
    return null
}

function detectPartKeys(query: string): string[] {
    return PART_INTENTS.filter((p) => p.re.test(query)).map((p) => p.key)
}

function itemFitment(item: AutoPartsCatalogItem): VehicleFitment | null {
    return parseFitment(item.variantsJson)
}

function itemFitsVehicle(item: AutoPartsCatalogItem, make: string, model: string): boolean {
    const f = itemFitment(item)
    if (!f) return false
    return f.make.toLowerCase() === make.toLowerCase() && f.model.toLowerCase() === model.toLowerCase()
}

function matchesPartKey(item: AutoPartsCatalogItem, key: string): boolean {
    const hint = PART_INTENTS.find((p) => p.key === key)?.titleHints
    if (!hint) return false
    const hay = `${item.title} ${item.category || ""} ${item.description || ""} ${item.sku || ""}`
    return hint.test(hay)
}

function generalPartsIntent(query: string): boolean {
    return /\b(fitment|spare|spares|parts?|catalogue|catalog|in stock|do you (have|sell)|what (fits|do you have)|show (me )?(parts|spares|filters|pads))\b/i.test(
        query,
    )
}

/**
 * Deterministic desk reply for brake-pad / oil-filter / fitment asks on AUTO_PARTS kits.
 * Mirrors jewelry-chat short-circuit — cite published fitment + /menu; WhatsApp secondary only.
 */
export function answerAutoPartsCatalogOrFitment(opts: {
    query: string
    slug: string
    shopName: string
    roleTemplate: string | null | undefined
    primaryGoal?: string | null
    items: AutoPartsCatalogItem[]
    requestCurrency: DisplayCurrency
    whatsapp?: string | null
}): string | null {
    if (!prefersAutoPartsMenuPath(opts.roleTemplate, opts.primaryGoal)) return null
    if (!opts.slug) return null

    const q = normalizeCatalogQuery(opts.query)
    if (!q) return null

    const hasCatalog = opts.items.length > 0
    const partKeys = detectPartKeys(opts.query)
    const vehicle = detectVehicle(opts.query)
    const partsAsk = partKeys.length > 0 || generalPartsIntent(opts.query) || Boolean(vehicle)

    if (!partsAsk) {
        const hasPriceCue =
            /\b(price|cost|how much|rate|rates)\b/i.test(opts.query)
            || /\b(rs\.?|inr)\b/i.test(opts.query)
            || opts.query.includes("₹")
            || /\b(what(?:'s| is)|tell me|do you have)\b/i.test(opts.query)
        if (!hasPriceCue) return null
    }

    if (!hasCatalog) return null

    const primary = autoPartsMenuPrimaryCta({ slug: opts.slug })
    const wa = autoPartsMenuSecondaryWa(opts.whatsapp, opts.shopName)
    const waBlock = wa ? `\n\n${wa}` : ""

    let matches = opts.items.slice()

    if (vehicle) {
        matches = matches.filter((item) => itemFitsVehicle(item, vehicle.make, vehicle.model))
    }
    if (partKeys.length > 0) {
        const byPart = matches.filter((item) => partKeys.some((k) => matchesPartKey(item, k)))
        if (byPart.length > 0) matches = byPart
        else if (vehicle) {
            // Vehicle+part with no published fitment for that part — do not invent; caveat wrong SKUs.
            const wrongPart = opts.items.filter((item) => partKeys.some((k) => matchesPartKey(item, k)))
            if (wrongPart.length > 0) {
                const wrongLines = wrongPart.slice(0, 3).map((item) => {
                    const fl = formatFitmentLine(item.variantsJson)
                    const price = formatChatCatalogPrice(item, opts.roleTemplate, opts.requestCurrency)
                    const fit = fl ? ` (published for **${fl}** — not ${vehicle.make} ${vehicle.model})` : ""
                    return `- **${item.title}**: ${price}${fit}`
                })
                return (
                    `I don't have a published ${partKeys[0].replace(/_/g, " ")} fitment for **${vehicle.make} ${vehicle.model}** on the Parts menu.`
                    + `\n\nRelated parts with different fitment:\n${wrongLines.join("\n")}`
                    + `\n\n${primary}${waBlock}`
                )
            }
            return (
                `No published ${partKeys[0].replace(/_/g, " ")} for **${vehicle.make} ${vehicle.model}** on the live Parts menu yet.`
                + `\n\n${primary}${waBlock}`
            )
        }
    }

    if (matches.length === 0 && vehicle) {
        // Vehicle asked but no fitment hits — list nothing as a false fit; steer to menu.
        return (
            `Nothing on the live Parts menu publishes fitment for **${vehicle.make} ${vehicle.model}** yet.`
            + `\n\n${primary}${waBlock}`
        )
    }

    if (matches.length === 0) {
        // Generic parts ask — sample catalogue with fitment lines.
        const listed = opts.items.slice(0, 6).map((item) => {
            const price = formatChatCatalogPrice(item, opts.roleTemplate, opts.requestCurrency)
            const fl = formatFitmentLine(item.variantsJson)
            const fit = fl ? ` · Fits **${fl}**` : ""
            return `- **${item.title}**: ${price}${fit}`
        })
        return `Here are Parts on the menu at ${opts.shopName}:\n${listed.join("\n")}\n\n${primary}${waBlock}`
    }

    const listed = matches.slice(0, 6).map((item) => {
        const price = formatChatCatalogPrice(item, opts.roleTemplate, opts.requestCurrency)
        const fl = formatFitmentLine(item.variantsJson)
        const fit = fl ? ` · Fits **${fl}**` : ""
        const sku = item.sku ? ` (${item.sku})` : ""
        return `- **${item.title}**${sku}: ${price}${fit}`
    })

    const vehicleBit = vehicle ? ` for **${vehicle.make} ${vehicle.model}**` : ""
    const lead =
        matches.length === 1
            ? (() => {
                const hit = matches[0]!
                const price = formatChatCatalogPrice(hit, opts.roleTemplate, opts.requestCurrency)
                const fl = formatFitmentLine(hit.variantsJson)
                const fit = fl ? ` Fits **${fl}**.` : ""
                return `**${hit.title}** is ${price} on the live Parts menu.${fit}`
            })()
            : `Here are Parts${vehicleBit} on the menu at ${opts.shopName}:\n${listed.join("\n")}`

    if (matches.length === 1) {
        return `${lead}\n\n${primary}${waBlock}`
    }
    return `${lead}\n\n${primary}${waBlock}`
}
