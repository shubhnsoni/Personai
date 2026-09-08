import { item, type ImportItem } from "@/lib/import-extract"
import { parseDiet } from "@/lib/menu"

export const MENU_IMPORT_WARNING =
    "Unofficial public-page import. Review every dish. Sites change and may block this. Only import a menu you have the right to copy."

export function isMenuHost(url: string) {
    try {
        const host = new URL(url).hostname.toLowerCase()
        return (
            /(^|\.)swiggy\.com$|(^|\.)zomato\.com$|(^|\.)ubereats\.com$|(^|\.)uber\.com$/.test(host) ||
            isGoogleBusinessHost(url)
        )
    } catch {
        return /swiggy\.com|zomato\.com|ubereats\.com|uber\.com|google\.|g\.page|maps\.app\.goo\.gl/i.test(url)
    }
}

export function isGoogleBusinessHost(url: string) {
    try {
        const u = new URL(url)
        const host = u.hostname.toLowerCase()
        if (/(^|\.)g\.page$|(^|\.)share\.google$|(^|\.)maps\.app\.goo\.gl$|(^|\.)goo\.gl$/.test(host)) return true
        if (host === "maps.google.com" || host.endsWith(".maps.google.com")) return true
        if (/(^|\.)google\.[a-z.]+$/.test(host)) {
            return /maps|business|search|place|local/i.test(u.pathname + u.search)
        }
        return false
    } catch {
        return /google\.|g\.page|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)
    }
}

export function discoverMenuUrls(html: string): string[] {
    const found = new Set<string>()
    const raw = html.replace(/\\u002f/gi, "/").replace(/\\\//g, "/")
    const re = /https?:\/\/(?:www\.)?(?:zomato\.com|link\.zomato\.com|swiggy\.com|ubereats\.com|uber\.com)[^"'\\\s<>]*/gi
    for (const m of raw.match(re) || []) {
        try {
            const u = new URL(m.replace(/&amp;/g, "&").replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&"))
            u.hash = ""
            if (/zomato|swiggy|ubereats|uber\.com/i.test(u.hostname)) found.add(u.toString())
        } catch { /* ignore */ }
    }
    return preferOrderUrls([...found]).slice(0, 8)
}

function preferOrderUrls(urls: string[]) {
    return [...urls].sort((a, b) => scoreMenuUrl(b) - scoreMenuUrl(a))
}

function scoreMenuUrl(url: string) {
    let n = 0
    if (/\/order\b|menu|dineout|restaurant/i.test(url)) n += 3
    if (/zomato\.com/i.test(url)) n += 2
    if (/swiggy\.com/i.test(url)) n += 2
    if (/ubereats/i.test(url)) n += 1
    return n
}

export function googleListingName(html: string) {
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]
    const raw = (og || title || "")
        .replace(/&amp;/g, "&")
        .replace(/\s*[-–|].*(google|maps|search).*$/i, "")
        .replace(/\s+/g, " ")
        .trim()
    return raw.slice(0, 80)
}

export function extractMenuFromHtml(html: string, url: string): ImportItem[] {
    const fromLd = extractJsonLdMenu(html)
    const fromState = extractEmbeddedMenu(html)
    const fromGoogle = isGoogleBusinessHost(url) ? extractGoogleMenuJson(html) : []
    const fromText = extractRupeeMenu(stripTags(html))
    const merged = dedupeMenu([...fromLd, ...fromState, ...fromGoogle, ...fromText])
    if (isMenuHost(url) && merged.length) return merged
    if (merged.length >= 4) return merged
    return merged
}

function extractGoogleMenuJson(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const blobs = html.match(/\{[^{}]{0,200}"(?:name|title|itemName)"[^{}]{0,400}(?:price|finalPrice|priceInr)[^{}]{0,200}\}/gi) || []
    for (const blob of blobs.slice(0, 200)) {
        try {
            const n = JSON.parse(blob) as Record<string, unknown>
            const name = String(n.name || n.title || n.itemName || "").trim()
            const price = firstPrice(n)
            if (!name || name.length > 90 || price == null) continue
            items.push(dishItem(name, price, {
                description: String(n.description || "").slice(0, 240) || undefined,
                category: String(n.category || n.categoryName || "").slice(0, 40) || undefined,
                diet: parseDiet(String(n.dietary || n.vegClassifier || name)),
            }))
        } catch { /* ignore */ }
    }
    return items
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
