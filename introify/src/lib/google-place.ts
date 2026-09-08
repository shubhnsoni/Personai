import type { ItemPhoto } from "@/lib/item-photos"

export type GooglePlaceReview = {
    author: string
    rating: number | null
    text: string
}

export type GooglePlaceWeeklyHours = {
    dayOfWeek: number
    closed: boolean
    startTime: string | null
    endTime: string | null
}

export type GooglePlaceInfo = {
    name: string | null
    rating: number | null
    reviewCount: number | null
    address: string | null
    phone: string | null
    website: string | null
    hours: string | null
    weeklyHours: GooglePlaceWeeklyHours[]
    categories: string[]
    description: string | null
    mapsUrl: string | null
    placeId: string | null
    photos: ItemPhoto[]
    reviews: GooglePlaceReview[]
}

export function googlePlaceFromConfig(raw?: string | null): { placeId?: string; mapsUrl?: string } {
    try {
        const bag = JSON.parse(raw || "{}") as {
            googlePlaceId?: unknown
            googlePlace?: { placeId?: unknown }
            socials?: { maps?: unknown }
        }
        const placeId =
            (typeof bag.googlePlaceId === "string" && bag.googlePlaceId) ||
            (typeof bag.googlePlace?.placeId === "string" && bag.googlePlace.placeId) ||
            undefined
        const mapsUrl = typeof bag.socials?.maps === "string" ? bag.socials.maps : undefined
        return { placeId, mapsUrl }
    } catch {
        return {}
    }
}

export function writeGooglePlaceId(raw: string | null | undefined, placeId: string) {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    bag.googlePlaceId = placeId
    return JSON.stringify(bag)
}

export function placeIdFromMapsUrl(url?: string | null) {
    if (!url) return null
    const fromQuery = url.match(/place_id[=:](ChIJ[A-Za-z0-9_-]+)/i)
    if (fromQuery) return fromQuery[1]
    return null
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"

const DAY_INDEX: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
}

const STREET_RE = /\b(Road|Street|St\.?|Ave\.?|Avenue|Blvd|Boulevard|Lane|Ln\.?|Drive|Dr\.?|Nagar|Way|Place|Plaza|Highway|Hwy|Crescent|Court|Ct\.?|Terrace|Close|Square|Parkway|Marg|Gali|Chowk|Main Rd|Rue|Via|Calle|Rua|Strasse|Straße|Ulitsa|Ring|Pass|Pike)\b/i
const POSTAL_RE = /\b(\d{4,6}(?:[-\s]\d{3,4})?|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|[A-Z]\d[A-Z]\s*\d[A-Z]\d)\b/i
const E164_RE = /^\+\d[\d\s\-().]{7,}$/
const IN_PLUS91_RE = /^\+91[\s-]?\d{5}[\s-]?\d{5}$/
const IN_NATIONAL_RE = /^0\d{5}\s?\d{5}$/
const NATIONAL_BLOCK_RE = /^\(?\d{2,4}\)?[\s.\-]\d{3,4}[\s.\-]\d{3,4}$/
const LANG_CODES = /^(en|es|fr|de|hi|zh|ja|ko|pt|it|ru|ar|nl|bn|ta|te|mr|gu|pa|ur|id|th|vi|tr|pl|sv|da|fi|no|cs|el|he|fa)$/i

type Acc = {
    name?: string
    rating?: number
    reviewCount?: number
    address?: string
    phone?: string
    website?: string
    hours?: string
    weekly: GooglePlaceWeeklyHours[]
    categories: string[]
    blurbs: string[]
    description?: string
    placeId?: string
    photos: string[]
    reviews: GooglePlaceReview[]
}

function digitCount(s: string) {
    return (s.match(/\d/g) || []).length
}

function looksLikePhone(s: string) {
    const t = s.trim()
    const n = digitCount(t)
    if (n < 8 || n > 15) return false
    if (E164_RE.test(t)) return true
    if (IN_PLUS91_RE.test(t)) return true
    if (IN_NATIONAL_RE.test(t)) return true
    if (/^0\d{8,12}$/.test(t)) return true
    if (NATIONAL_BLOCK_RE.test(t)) return true
    return false
}

function looksLikeAddress(s: string) {
    if (s.length < 18 || s.length > 140) return false
    if (/^https?:/i.test(s) || /^ChIJ/.test(s) || s.includes("|")) return false
    if (looksLikePhone(s)) return false
    const hasComma = s.includes(",")
    const hasStreet = STREET_RE.test(s)
    const hasPostal = POSTAL_RE.test(s)
    if (!(hasComma && (hasStreet || hasPostal)) && !(hasStreet && hasPostal)) return false
    if ((s.match(/\s+/g) || []).length > 12 && /\.\s/.test(s)) return false
    return true
}

function looksLikeBlurb(s: string) {
    if (s.length < 24 || s.length > 220) return false
    if (/^https?:/i.test(s) || /^ChIJ/.test(s)) return false
    if (/googleusercontent\.com/.test(s)) return false
    if (/^(Open|Closed)\b/i.test(s) && s.length < 48) return false
    if (looksLikePhone(s) || looksLikeAddress(s)) return false
    if (/[{}\[\]|=]/.test(s)) return false
    const words = s.split(/\s+/).filter(Boolean)
    if (words.length < 4) return false
    if (!/[A-Za-z\u00C0-\u024F]/.test(s)) return false
    return true
}

function dayIndex(raw: string) {
    const key = raw.trim().toLowerCase().replace(/\.$/, "")
    return key in DAY_INDEX ? DAY_INDEX[key] : null
}

function padClock(h: number, m: number) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function parseClock(raw: string): string | null {
    const s = raw.trim()
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
    if (!m) return null
    let h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    const ap = m[3]?.toUpperCase()
    if (ap === "AM") {
        if (h === 12) h = 0
    } else if (ap === "PM") {
        if (h !== 12) h += 12
    }
    if (h > 23 || min > 59) return null
    return padClock(h, min)
}

function parseHourRange(raw: string): GooglePlaceWeeklyHours | null {
    const t = raw.replace(/\s+/g, " ").trim()
    if (!t) return null
    if (/^closed\b/i.test(t) && !/\d/.test(t)) {
        return { dayOfWeek: 0, closed: true, startTime: null, endTime: null }
    }
    if (/24\s*hours|open\s*24/i.test(t)) {
        return { dayOfWeek: 0, closed: false, startTime: "00:00", endTime: "23:59" }
    }
    const parts = t.split(/\s*(?:[–—−–-]|to)\s*/i)
    if (parts.length >= 2) {
        const start = parseClock(parts[0])
        const end = parseClock(parts[1])
        if (start && end) return { dayOfWeek: 0, closed: false, startTime: start, endTime: end }
    }
    return null
}

function minutesToClock(n: number) {
    if (!Number.isFinite(n) || n < 0 || n > 24 * 60) return null
    const capped = Math.min(n, 24 * 60 - 1)
    return padClock(Math.floor(capped / 60), capped % 60)
}

function upsertWeekly(acc: Acc, dayOfWeek: number, row: Omit<GooglePlaceWeeklyHours, "dayOfWeek">) {
    if (dayOfWeek < 0 || dayOfWeek > 6) return
    const next: GooglePlaceWeeklyHours = { dayOfWeek, ...row }
    const i = acc.weekly.findIndex((w) => w.dayOfWeek === dayOfWeek)
    if (i < 0) acc.weekly.push(next)
    else if (!acc.weekly[i].startTime && next.startTime) acc.weekly[i] = next
    else if (acc.weekly[i].closed && !next.closed) acc.weekly[i] = next
}

function looksLikeTypeArray(node: unknown[]): string[] | null {
    if (node.length < 1 || node.length > 8) return null
    if (!node.every((x) => typeof x === "string")) return null
    const types = node.map((x) => (x as string).trim()).filter(Boolean)
    if (types.length < 1 || types.length > 8) return null
    if (types.some((t) => t.length < 3 || t.length >= 40)) return null
    if (types.some((t) => /^https?:/i.test(t) || /^ChIJ/.test(t) || looksLikePhone(t))) return null
    if (types.every((t) => dayIndex(t) != null || LANG_CODES.test(t))) return null
    if (types.every((t) => /^(Open|Closed)$/i.test(t))) return null
    return types
}

function intervalFromUnknown(slot: unknown): { startTime: string; endTime: string } | null {
    if (!Array.isArray(slot) || slot.length < 2) return null
    const a = slot[0]
    const b = slot[1]
    const c = slot[2]
    if (typeof a === "string" && typeof b === "string") {
        const start = parseClock(a)
        const end = parseClock(b)
        if (start && end) return { startTime: start, endTime: end }
    }
    if (typeof a === "number" && typeof b === "number" && slot.length === 2) {
        const start = minutesToClock(a)
        const end = minutesToClock(b)
        if (start && end) return { startTime: start, endTime: end }
    }
    if (typeof a === "number" && typeof b === "number" && typeof c === "number") {
        const start = minutesToClock(b)
        const end = minutesToClock(c)
        if (start && end) return { startTime: start, endTime: end }
    }
    return null
}

function maybeDayHours(node: unknown[], acc: Acc) {
    if (node.length === 2 && typeof node[0] === "string" && typeof node[1] === "string") {
        const day = dayIndex(node[0])
        if (day == null) return
        const parsed = parseHourRange(node[1])
        if (parsed) upsertWeekly(acc, day, parsed)
        return
    }
    if (node.length === 2 && typeof node[0] === "string" && Array.isArray(node[1])) {
        const day = dayIndex(node[0])
        if (day == null) return
        if (typeof node[1][0] === "string") {
            const parsed = parseHourRange(node[1][0])
            if (parsed) upsertWeekly(acc, day, parsed)
            return
        }
        const times = (node[1] as unknown[]).map(intervalFromUnknown).filter(Boolean) as { startTime: string; endTime: string }[]
        if (times.length) {
            upsertWeekly(acc, day, { closed: false, startTime: times[0].startTime, endTime: times[times.length - 1].endTime })
        }
        return
    }
    if (node.length === 2 && typeof node[0] === "number" && node[0] >= 0 && node[0] <= 6 && Array.isArray(node[1])) {
        const day = node[0]
        const slots = node[1] as unknown[]
        if (slots.length === 0) {
            upsertWeekly(acc, day, { closed: true, startTime: null, endTime: null })
            return
        }
        const times = slots.map(intervalFromUnknown).filter(Boolean) as { startTime: string; endTime: string }[]
        if (times.length) {
            upsertWeekly(acc, day, { closed: false, startTime: times[0].startTime, endTime: times[times.length - 1].endTime })
        }
        return
    }
    if (
        node.length === 2 &&
        Array.isArray(node[0]) &&
        Array.isArray(node[1]) &&
        node[0].length === 7 &&
        node[1].length === 7 &&
        node[0].every((x) => typeof x === "string" && dayIndex(x) != null) &&
        node[1].every((x) => typeof x === "string")
    ) {
        for (let i = 0; i < 7; i++) {
            const day = dayIndex(node[0][i] as string)
            const parsed = parseHourRange(node[1][i] as string)
            if (day != null && parsed) upsertWeekly(acc, day, parsed)
        }
    }
}

function looksLikePersonName(s: string) {
    const t = s.trim()
    if (t.length < 2 || t.length > 80) return false
    if (/^https?:/i.test(t) || /googleusercontent/i.test(t) || /^ChIJ/.test(t)) return false
    if (/\d{3,}/.test(t) || looksLikePhone(t) || looksLikeAddress(t)) return false
    if (dayIndex(t) != null) return false
    const words = t.split(/\s+/).filter(Boolean)
    if (words.length < 1 || words.length > 5) return false
    if (words.some((w) => w.length > 24)) return false
    if (!/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0900-\u097F\u4E00-\u9FFF]/.test(t)) return false
    return true
}

function maybeReview(node: unknown[], acc: Acc) {
    if (acc.reviews.length >= 8) return
    if (node.length < 3 || node.length > 24) return
    const strings: string[] = []
    const numbers: number[] = []
    for (const item of node) {
        if (typeof item === "string") strings.push(item)
        else if (typeof item === "number") numbers.push(item)
        else if (Array.isArray(item)) {
            for (const inner of item.slice(0, 8)) {
                if (typeof inner === "string") strings.push(inner)
                else if (typeof inner === "number") numbers.push(inner)
            }
        }
    }
    const texts = strings.filter((s) => (
        s.length >= 40 &&
        s.length <= 2000 &&
        /\s/.test(s) &&
        !/^https?:/i.test(s) &&
        !/googleusercontent\.com/.test(s) &&
        !/^ChIJ/.test(s)
    ))
    if (!texts.length) return
    const authors = strings.filter(looksLikePersonName)
    const ratings = numbers.filter((n) => n >= 1 && n <= 5)
    if (!authors.length && !ratings.some((n) => Number.isInteger(n))) return
    const text = texts[0]
    if (acc.reviews.some((r) => r.text === text)) return
    acc.reviews.push({
        author: authors[0] || "Google reviewer",
        rating: ratings.find((n) => Number.isInteger(n)) ?? ratings[0] ?? null,
        text,
    })
}

function walk(node: unknown, acc: Acc, depth = 0) {
    if (depth > 18 || node == null) return
    if (typeof node === "string") {
        if (!acc.placeId && /^ChIJ[A-Za-z0-9_-]{20,}$/.test(node)) acc.placeId = node
        if (!acc.hours && /^(Open|Closed)\b/i.test(node) && node.length < 48) acc.hours = node.replace(/\s+/g, " ").trim()
        if (!acc.website && /^https?:\/\/(?!www\.google\.|lh[0-9]\.googleusercontent|maps\.google)/i.test(node) && node.length < 180) {
            acc.website = node
        }
        if (/googleusercontent\.com\/(?:p|gps-cs-s)\//.test(node) && !/\/a[-/]/.test(node)) {
            const url = node.replace(/\\u003d/g, "=").replace(/\\u0026/g, "&").replace(/=s\d+.*$/, "=s800").replace(/=w\d+-h\d+.*$/, "=s800")
            if (!acc.photos.includes(url) && acc.photos.length < 12) acc.photos.push(url)
        }
        if (looksLikeAddress(node)) {
            const better = STREET_RE.test(node)
            if (!acc.address || (better && node.length > acc.address.length)) acc.address = node
        }
        if (looksLikeBlurb(node)) acc.blurbs.push(node)
        if (!acc.phone && looksLikePhone(node)) acc.phone = node.trim()
        return
    }
    if (typeof node === "number") return
    if (Array.isArray(node)) {
        if (
            node.length >= 8 &&
            node.slice(0, 7).every((x) => x == null) &&
            typeof node[7] === "number" &&
            node[7] >= 1 &&
            node[7] <= 5
        ) {
            acc.rating = node[7]
        }
        const types = looksLikeTypeArray(node)
        if (types && (!acc.categories.length || types.length > acc.categories.length)) {
            acc.categories = types
        }
        if (
            Array.isArray(node[0]) &&
            typeof node[0]?.[0] === "string" &&
            looksLikePhone(node[0][0]) &&
            !acc.phone
        ) {
            acc.phone = node[0][0].trim()
        }
        maybeDayHours(node, acc)
        maybeReview(node, acc)
        for (const child of node) walk(child, acc, depth + 1)
        return
    }
    if (typeof node === "object") {
        for (const value of Object.values(node as Record<string, unknown>)) walk(value, acc, depth + 1)
    }
}

function pickDescription(acc: Acc) {
    const reviewTexts = new Set(acc.reviews.map((r) => r.text))
    const blurbs = acc.blurbs.filter((b) => !reviewTexts.has(b))
    const pool = blurbs.length ? blurbs : acc.blurbs
    return pool.slice().sort((a, b) => b.length - a.length)[0]
}

function parsePayload(raw: string, fallbackName: string): Acc {
    const acc: Acc = { categories: [], photos: [], reviews: [], weekly: [], blurbs: [] }
    const body = raw.replace(/^\)\]\}'\s*/, "")
    try {
        walk(JSON.parse(body), acc)
    } catch {
        /* regex fallback below */
    }
    if (!acc.placeId) {
        const m = raw.match(/ChIJ[A-Za-z0-9_-]{20,}/)
        if (m) acc.placeId = m[0]
    }
    if (acc.rating == null) {
        const m = raw.match(/\[null,null,null,null,null,null,null,(1|2|3|4|5(?:\.\d)?)\]/)
        if (m) acc.rating = Number(m[1])
    }
    if (!acc.hours) {
        const m = raw.match(/"(Open · Closes [^"]{2,24}|Closed · Opens [^"]{2,24})"/)
        if (m) acc.hours = m[1]
    }
    if (!acc.phone) {
        const e164 = raw.match(/"(\+\d[\d\s-]{7,})"/)
        if (e164 && looksLikePhone(e164[1])) acc.phone = e164[1]
    }
    if (!acc.phone) {
        const local = raw.match(/"(\+91[\s-]?\d{5}[\s-]?\d{5}|0\d{5}\s?\d{5}|0\d{8,12})"/)
        if (local && looksLikePhone(local[1])) acc.phone = local[1]
    }
    if (!acc.address) {
        for (const m of raw.matchAll(/"([^"]{18,140})"/g)) {
            if (looksLikeAddress(m[1])) {
                acc.address = m[1]
                break
            }
        }
    }
    if (!acc.name) acc.name = fallbackName
    const count = raw.match(/(\d{2,5})\s+reviews/i)
    if (count) acc.reviewCount = Number(count[1])
    acc.description = pickDescription(acc)
    acc.weekly.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    return acc
}

async function pull(url: string, hl: string, gl?: string) {
    const localeTag = hl.includes("-") ? hl : gl ? `${hl}-${gl.toUpperCase()}` : hl
    const res = await fetch(url, {
        headers: {
            "User-Agent": UA,
            "Accept-Language": `${localeTag},en;q=0.8`,
            Accept: "text/html,application/json",
        },
        next: { revalidate: 1800 },
    })
    if (!res.ok) throw new Error("Google listing unavailable")
    return res.text()
}

function searchQuery(input: { name: string; mapsUrl?: string | null }) {
    const fromPath = input.mapsUrl?.match(/\/maps\/place\/([^/@]+)/)
    if (fromPath) return decodeURIComponent(fromPath[1].replace(/\+/g, " "))
    return input.name
}

function mapSearchUrl(q: string, hl: string, gl?: string) {
    const params = new URLSearchParams()
    params.set("tbm", "map")
    params.set("hl", hl || "en")
    if (gl) params.set("gl", gl)
    params.set("q", q)
    return `https://www.google.com/search?${params.toString()}`
}

export async function fetchGooglePlace(input: {
    name: string
    mapsUrl?: string | null
    placeId?: string | null
    hl?: string
    gl?: string
    locale?: { hl?: string; gl?: string }
}): Promise<GooglePlaceInfo> {
    const placeId = input.placeId || placeIdFromMapsUrl(input.mapsUrl)
    const hl = input.hl || input.locale?.hl || "en"
    const gl = input.gl || input.locale?.gl
    const primary = searchQuery(input)
    let raw = await pull(mapSearchUrl(primary, hl, gl), hl, gl)
    if (raw.length < 2000) {
        raw = await pull(mapSearchUrl(input.name, hl, gl), hl, gl)
    }
    const acc = parsePayload(raw, input.name)

    const mapsUrl =
        input.mapsUrl ||
        (acc.placeId ? `https://www.google.com/maps/place/?q=place_id:${acc.placeId}` : null)

    return {
        name: acc.name || input.name,
        rating: acc.rating ?? null,
        reviewCount: acc.reviewCount ?? null,
        address: acc.address || null,
        phone: acc.phone || null,
        website: acc.website || null,
        hours: acc.hours || null,
        weeklyHours: acc.weekly,
        categories: acc.categories,
        description: acc.description || null,
        mapsUrl,
        placeId: acc.placeId || placeId || null,
        photos: acc.photos.map((url) => ({ url, source: "google" as const })),
        reviews: acc.reviews,
    }
}
