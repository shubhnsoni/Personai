import { item, type ImportItem } from "@/lib/import-extract"
import { parseDiet } from "@/lib/menu"

export const MENU_IMPORT_WARNING =
    "Unofficial public-page import. Review every dish. Sites change and may block this. Only import a menu you have the right to copy."

export function isMenuHost(url: string) {
    try {
        const host = new URL(url).hostname.toLowerCase()
        return /(^|\.)swiggy\.com$|(^|\.)zomato\.com$|(^|\.)ubereats\.com$|(^|\.)uber\.com$/.test(host)
    } catch {
        return /swiggy\.com|zomato\.com|ubereats\.com|uber\.com/i.test(url)
    }
}

export function extractMenuFromHtml(html: string, url: string): ImportItem[] {
    const fromLd = extractJsonLdMenu(html)
    const fromState = extractEmbeddedMenu(html)
    const fromText = extractRupeeMenu(stripTags(html))
    const merged = dedupeMenu([...fromLd, ...fromState, ...fromText])
    if (isMenuHost(url) && merged.length) return merged
    if (merged.length >= 4) return merged
    return merged
}

export function extractSwiggyMenu(html: string) {
    return extractMenuFromHtml(html, "https://www.swiggy.com/")
}

export function extractZomatoMenu(html: string) {
    return extractMenuFromHtml(html, "https://www.zomato.com/")
}

export function extractRupeeMenu(text: string): ImportItem[] {
    const items: ImportItem[] = []
    let category = ""
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line) continue
        if (isSectionHeader(line)) {
            category = line.replace(/[:：]+$/, "").slice(0, 40)
            continue
        }
        const parsed = parsePricedDish(line)
        if (!parsed) continue
        items.push(dishItem(parsed.title, parsed.price, {
            description: parsed.description,
            category: category || undefined,
            diet: parsed.diet,
        }))
    }
    return dedupeMenu(items).slice(0, 80)
}

function dishItem(
    title: string,
    price: number,
    extra?: { description?: string; category?: string; diet?: string | null },
): ImportItem {
    return item("product", title.slice(0, 80), 0.82, {
        price,
        description: extra?.description,
        productType: "OTHER",
        category: extra?.category,
        diet: extra?.diet || undefined,
        fulfillment: "PHYSICAL",
    })
}

function parsePricedDish(line: string) {
    if (line.length > 180 || line.length < 3) return null
    const money = line.match(/(?:₹|Rs\.?|INR|\$)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:₹|Rs\.?|INR)/i)
    if (!money) return null
    const amount = parseFloat((money[1] || money[2] || "0").replace(",", ""))
    if (!Number.isFinite(amount)) return null
    const title = line
        .replace(money[0], " ")
        .replace(/\b(veg(?:an|etarian)?|non[-\s]?veg(?:etarian)?|egg)\b/gi, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/^[-–—•*\d.)\s]+/, "")
        .trim()
    if (title.length < 2 || /^(total|subtotal|gst|tax|delivery|packaging)\b/i.test(title)) return null
    return {
        title,
        price: amount,
        description: undefined as string | undefined,
        diet: parseDiet(line),
    }
}

function isSectionHeader(line: string) {
    if (/[₹$]|\d{2,}/.test(line)) return false
    return /^(starters?|mains?|desserts?|drinks?|beverages?|breads?|rice|biryani|thali|combos?|breakfast|lunch|dinner|soups?|salads?|sides?|tandoor|chinese|indian|south indian|chinese|rolls?|pizza|pasta|burgers?)\b/i.test(line)
        && line.length < 40
}

function extractJsonLdMenu(html: string): ImportItem[] {
    const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    const nodes: Record<string, unknown>[] = []
    for (const m of blocks) {
        try {
            flatten(JSON.parse(m[1].replace(/[\u0000-\u001F]+/g, " ")), nodes)
        } catch { /* ignore */ }
    }
    return nodesToDishes(nodes)
}

function extractEmbeddedMenu(html: string): ImportItem[] {
    const blobs: string[] = []
    const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
    if (next?.[1]) blobs.push(next[1])
    const pre = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/)
    if (pre?.[1]) blobs.push(pre[1])
    const items: ImportItem[] = []
    for (const blob of blobs) {
        try {
            const nodes: Record<string, unknown>[] = []
            flatten(JSON.parse(blob), nodes)
            items.push(...nodesToDishes(nodes))
        } catch { /* ignore */ }
    }
    return items
}

function nodesToDishes(nodes: Record<string, unknown>[]): ImportItem[] {
    const out: ImportItem[] = []
    for (const n of nodes) {
        const type = String(n["@type"] || n.type || "")
        const name = String(n.name || n.title || n.itemName || "").trim()
        if (!name || name.length > 90) continue
        const looksDish = /MenuItem|Dish|Item/i.test(type) || n.price != null || n.finalPrice != null || n.defaultPrice != null
        const price = firstPrice(n)
        if (!looksDish && price == null) continue
        if (price == null && !/MenuItem/i.test(type)) continue
        const desc = String(n.description || n.desc || "").slice(0, 240) || undefined
        const cat = String(n.category || n.categoryName || n.menuCategory || "").slice(0, 40) || undefined
        const dietRaw = String(n.itemAttribute || n.vegClassifier || n.dietary || n.isVeg || "")
        const diet = parseDiet(dietRaw) || (n.isVeg === true || n.isVeg === "VEG" ? "VEG" : n.isVeg === false ? "NONVEG" : parseDiet(name))
        out.push(dishItem(name, price ?? 0, { description: desc, category: cat, diet }))
    }
    return out
}

function firstPrice(n: Record<string, unknown>): number | null {
    const candidates = [n.price, n.finalPrice, n.defaultPrice, n.offerPrice, n.priceInr]
    const offers = n.offers
    if (offers && typeof offers === "object") {
        const o = offers as Record<string, unknown>
        candidates.push(o.price, o.lowPrice)
    }
    for (const c of candidates) {
        if (c == null) continue
        if (typeof c === "object") {
            const obj = c as Record<string, unknown>
            const nested = firstPrice(obj)
            if (nested != null) return nested
            continue
        }
        const num = typeof c === "number" ? c : parseFloat(String(c).replace(/[^0-9.]/g, ""))
        if (!Number.isFinite(num)) continue
        // Swiggy sometimes stores paise
        if (num > 1000 && Number.isInteger(num) && num % 100 === 0 && num < 100000) return num / 100
        return num
    }
    return null
}

function flatten(node: unknown, out: Record<string, unknown>[], depth = 0) {
    if (!node || depth > 12) return
    if (Array.isArray(node)) {
        for (const x of node) flatten(x, out, depth + 1)
        return
    }
    if (typeof node !== "object") return
    const rec = node as Record<string, unknown>
    out.push(rec)
    if (rec["@graph"]) flatten(rec["@graph"], out, depth + 1)
    if (rec.hasMenuItem) flatten(rec.hasMenuItem, out, depth + 1)
    if (rec.hasMenuSection) flatten(rec.hasMenuSection, out, depth + 1)
    for (const v of Object.values(rec)) {
        if (v && typeof v === "object") flatten(v, out, depth + 1)
    }
}

function stripTags(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "\n")
        .replace(/<style[\s\S]*?<\/style>/gi, "\n")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#8377;|&rsquo;|&#x20B9;/g, "₹")
}

function dedupeMenu(items: ImportItem[]) {
    const seen = new Set<string>()
    const out: ImportItem[] = []
    for (const it of items) {
        const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, "")
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push(it)
    }
    return out
}
