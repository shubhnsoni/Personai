import { venueFromConfig } from "@/lib/venue"
import type { GoldRates } from "@/lib/metal/math"
import { citySlug, displayCity } from "@/lib/metal/city"

export type GoldQuote = GoldRates & {
    fetchedAt: string
    city: string
    citySlug: string
    sourcePage: string
}

export type GoldTapeCity = GoldRates & {
    city: string
    citySlug: string
}

export type GoldTape = {
    fetchedAt: string
    cities: GoldTapeCity[]
}

export type GoldBoard = GoldRates & {
    city: string
    citySlug: string
    asOf: string
    source: "manual" | "city-feed"
    quote?: GoldQuote | null
    lastCheckedAt?: string | null
    collapsed?: boolean
    shopTape?: boolean
    pdpTape?: boolean
    tape?: GoldTape | null
}

export const GOLD_TAPE_STALE_MS = 6 * 60 * 60 * 1000

function asObject(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
}

function asInt(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.round(raw)
    if (typeof raw === "string" && raw.trim()) {
        const n = Number(raw.replace(/,/g, ""))
        if (Number.isFinite(n) && n >= 0) return Math.round(n)
    }
    return null
}

function asStr(raw: unknown): string | null {
    if (typeof raw !== "string") return null
    const t = raw.trim()
    return t ? t.slice(0, 80) : null
}

function readRates(bag: Record<string, unknown>): GoldRates | null {
    const k24 = asInt(bag.k24PaisePer10g)
    const k22 = asInt(bag.k22PaisePer10g)
    const k18 = asInt(bag.k18PaisePer10g)
    if (k24 == null || k22 == null || k18 == null) return null
    if (k24 <= 0 || k22 <= 0 || k18 <= 0) return null
    return { k24PaisePer10g: k24, k22PaisePer10g: k22, k18PaisePer10g: k18 }
}

function asBool(raw: unknown, fallback: boolean): boolean {
    if (raw === true) return true
    if (raw === false) return false
    return fallback
}

function readTapeCity(raw: unknown): GoldTapeCity | null {
    const bag = asObject(raw)
    if (!bag) return null
    const rates = readRates(bag)
    const city = asStr(bag.city)
    const slug = asStr(bag.citySlug)
    if (!rates || !city || !slug) return null
    return { ...rates, city, citySlug: slug }
}

function readTape(raw: unknown): GoldTape | null {
    const bag = asObject(raw)
    if (!bag) return null
    const fetchedAt = asStr(bag.fetchedAt)
    if (!fetchedAt || !Array.isArray(bag.cities)) return null
    const cities: GoldTapeCity[] = []
    const seen = new Set<string>()
    for (const row of bag.cities) {
        const city = readTapeCity(row)
        if (!city || seen.has(city.citySlug)) continue
        seen.add(city.citySlug)
        cities.push(city)
        if (cities.length >= 40) break
    }
    if (cities.length === 0) return null
    return { fetchedAt, cities }
}

export function goldBoardDisplay(board?: GoldBoard | null): Pick<GoldBoard, "collapsed" | "shopTape" | "pdpTape" | "tape"> {
    return {
        collapsed: Boolean(board?.collapsed),
        shopTape: board?.shopTape !== false,
        pdpTape: board?.pdpTape !== false,
        tape: board?.tape ?? null,
    }
}

export function goldTapeStale(board: GoldBoard | null | undefined): boolean {
    const at = board?.tape?.fetchedAt ? Date.parse(board.tape.fetchedAt) : 0
    if (!at || !Number.isFinite(at) || !(board?.tape?.cities.length)) return true
    return Date.now() - at >= GOLD_TAPE_STALE_MS
}

export function orderTapeCities(cities: GoldTapeCity[], preferSlug?: string | null): GoldTapeCity[] {
    const seen = new Set<string>()
    const out: GoldTapeCity[] = []
    for (const city of cities) {
        if (!city.citySlug || seen.has(city.citySlug)) continue
        seen.add(city.citySlug)
        out.push(city)
    }
    if (preferSlug) {
        const i = out.findIndex((row) => row.citySlug === preferSlug)
        if (i > 0) {
            const [hit] = out.splice(i, 1)
            out.unshift(hit)
        }
    }
    return out
}

function readQuote(raw: unknown): GoldQuote | null {
    const bag = asObject(raw)
    if (!bag) return null
    const rates = readRates(bag)
    const fetchedAt = asStr(bag.fetchedAt)
    const city = asStr(bag.city)
    const slug = asStr(bag.citySlug)
    const sourcePage = asStr(bag.sourcePage)
    if (!rates || !fetchedAt || !city || !slug || !sourcePage) return null
    return { ...rates, fetchedAt, city, citySlug: slug, sourcePage }
}

export function goldBoardFromConfig(raw?: string | null): GoldBoard | null {
    try {
        const root = asObject(JSON.parse(raw || "{}"))
        const bag = asObject(root?.goldBoard)
        if (!bag) return null
        const rates = readRates(bag)
        const city = asStr(bag.city)
        const slug = asStr(bag.citySlug)
        const asOf = asStr(bag.asOf)
        const source = bag.source === "manual" || bag.source === "city-feed" ? bag.source : null
        if (!rates || !city || !slug || !asOf || !source) return null
        return {
            ...rates,
            city,
            citySlug: slug,
            asOf,
            source,
            quote: readQuote(bag.quote),
            lastCheckedAt: asStr(bag.lastCheckedAt),
            collapsed: asBool(bag.collapsed, false),
            shopTape: asBool(bag.shopTape, true),
            pdpTape: asBool(bag.pdpTape, true),
            tape: readTape(bag.tape),
        }
    } catch {
        return null
    }
}

export function writeGoldBoard(raw: string | null | undefined, board: GoldBoard | null): string {
    let bag: Record<string, unknown> = {}
    try {
        bag = asObject(JSON.parse(raw || "{}")) || {}
    } catch {
        bag = {}
    }
    if (!board) {
        delete bag.goldBoard
        return JSON.stringify(bag)
    }
    const display = goldBoardDisplay(board)
    bag.goldBoard = {
        city: board.city,
        citySlug: board.citySlug,
        asOf: board.asOf,
        source: board.source,
        k24PaisePer10g: board.k24PaisePer10g,
        k22PaisePer10g: board.k22PaisePer10g,
        k18PaisePer10g: board.k18PaisePer10g,
        quote: board.quote ?? null,
        lastCheckedAt: board.lastCheckedAt ?? null,
        collapsed: display.collapsed,
        shopTape: display.shopTape,
        pdpTape: display.pdpTape,
        tape: display.tape,
    }
    return JSON.stringify(bag)
}

export function cityFromProfile(personalityConfig?: string | null, override?: string | null): { city: string; citySlug: string } {
    const typed = override?.trim()
    if (typed) return { city: displayCity(typed), citySlug: citySlug(typed) }
    const board = goldBoardFromConfig(personalityConfig)
    if (board?.city) return { city: board.city, citySlug: board.citySlug }
    const venue = venueFromConfig(personalityConfig)
    const locality = venue.address?.locality || guessCity(venue.address?.formatted)
    if (locality) return { city: displayCity(locality), citySlug: citySlug(locality) }
    return { city: "India", citySlug: "india" }
}

function guessCity(formatted?: string | null): string | null {
    if (!formatted) return null
    const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) return parts[parts.length - 2]
    return parts[0] || null
}
