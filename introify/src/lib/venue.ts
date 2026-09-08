export type VenueAddress = {
    formatted?: string | null
    line1?: string | null
    locality?: string | null
    region?: string | null
    postalCode?: string | null
    country?: string | null
}

export type VenuePhone = {
    e164?: string | null
    display?: string | null
}

export type VenueBag = {
    address?: VenueAddress
    phone?: VenuePhone
    categories?: string[]
}

function asObject(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
}

function asStr(raw: unknown): string | null | undefined {
    if (raw == null) return raw === null ? null : undefined
    if (typeof raw !== "string") return undefined
    const t = raw.trim()
    return t ? t.slice(0, 300) : null
}

function pickStr(bag: Record<string, unknown>, key: string): string | null | undefined {
    if (!(key in bag)) return undefined
    return asStr(bag[key]) ?? null
}

function cleanAddress(raw: unknown): VenueAddress | undefined {
    if (typeof raw === "string") {
        const formatted = asStr(raw)
        return formatted ? { formatted } : undefined
    }
    const bag = asObject(raw)
    if (!bag) return undefined
    const address: VenueAddress = {}
    const formatted = pickStr(bag, "formatted")
    const line1 = pickStr(bag, "line1")
    const locality = pickStr(bag, "locality")
    const region = pickStr(bag, "region")
    const postalCode = pickStr(bag, "postalCode")
    const country = pickStr(bag, "country")
    if (formatted !== undefined) address.formatted = formatted
    if (line1 !== undefined) address.line1 = line1
    if (locality !== undefined) address.locality = locality
    if (region !== undefined) address.region = region
    if (postalCode !== undefined) address.postalCode = postalCode
    if (country !== undefined) address.country = country
    if (!Object.keys(address).length) return undefined
    return address
}

function cleanPhone(raw: unknown): VenuePhone | undefined {
    const bag = asObject(raw)
    if (!bag) {
        if (typeof raw === "string") {
            const display = asStr(raw)
            return display ? { display } : undefined
        }
        return undefined
    }
    const phone: VenuePhone = {}
    const e164 = pickStr(bag, "e164")
    const display = pickStr(bag, "display")
    if (e164 !== undefined) phone.e164 = e164
    if (display !== undefined) phone.display = display
    if (phone.e164 == null && phone.display == null) return undefined
    return phone
}

function cleanCategories(raw: unknown): string[] | undefined {
    if (!Array.isArray(raw)) return undefined
    const categories = raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length < 40 && !/^https?:/i.test(item))
        .slice(0, 12)
    return categories
}

export function venueFromConfig(raw?: string | null): VenueBag {
    try {
        const parsed = JSON.parse(raw || "{}") as unknown
        const root = asObject(parsed)
        if (!root) return {}
        const venue = asObject(root.venue)
        if (!venue) return {}
        const bag: VenueBag = {}
        const address = cleanAddress(venue.address)
        const phone = cleanPhone(venue.phone)
        const categories = cleanCategories(venue.categories)
        if (address) bag.address = address
        if (phone) bag.phone = phone
        if (categories) bag.categories = categories
        return bag
    } catch {
        return {}
    }
}

export function writeVenue(raw: string | null | undefined, patch: VenueBag): string {
    let bag: Record<string, unknown> = {}
    try {
        const parsed = JSON.parse(raw || "{}") as unknown
        bag = asObject(parsed) || {}
    } catch {
        bag = {}
    }
    const currentVenue = asObject(bag.venue) || {}
    const current = venueFromConfig(JSON.stringify({ venue: currentVenue }))
    const next: Record<string, unknown> = { ...currentVenue }

    if (patch.address) {
        next.address = { ...current.address, ...cleanAddress(patch.address) }
    }
    if (patch.phone) {
        next.phone = { ...current.phone, ...cleanPhone(patch.phone) }
    }
    if (patch.categories) {
        next.categories = cleanCategories(patch.categories) || []
    }

    bag.venue = next
    return JSON.stringify(bag)
}
