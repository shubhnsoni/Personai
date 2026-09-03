"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import {
    fetchGooglePlace,
    googlePlaceFromConfig,
    writeGooglePlaceId,
    type GooglePlaceInfo,
    type GooglePlaceWeeklyHours,
} from "@/lib/google-place"
import { prisma } from "@/lib/prisma"
import { requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { socialsFromConfig, writeSocials } from "@/lib/socials"
import {
    venueFromConfig,
    writeVenue,
    type VenueAddress,
    type VenueBag,
    type VenuePhone,
} from "@/lib/venue"

export type ListingField =
    | "placeId"
    | "mapsUrl"
    | "displayName"
    | "headline"
    | "bio"
    | "phone"
    | "hours"
    | "address"
    | "photos"
    | "categories"

export type ListingPreview = {
    source: "google"
    fetchedAt: string
    placeId: string | null
    mapsUrl: string | null
    name: string | null
    rating: number | null
    reviewCount: number | null
    address: {
        formatted: string | null
        line1: string | null
        locality: string | null
        region: string | null
        postalCode: string | null
        country: string | null
    }
    phone: {
        e164: string | null
        display: string | null
    }
    website: string | null
    hours: {
        statusText: string | null
        weekly: Array<{
            dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
            closed: boolean
            startTime: string | null
            endTime: string | null
        }>
        timezone: string | null
    }
    categories: string[]
    description: string | null
    photos: Array<{
        url: string
        source: "google"
        width?: number
        attribution?: string | null
    }>
    reviews: Array<{ author: string; rating: number | null; text: string }>
    warnings: string[]
}

export type ListingApplyResult = {
    applied: ListingField[]
    skipped: Array<{ field: ListingField; reason: string }>
    venue: VenueBag
}

const LISTING_FIELDS: ListingField[] = [
    "placeId",
    "mapsUrl",
    "displayName",
    "headline",
    "bio",
    "phone",
    "hours",
    "address",
    "photos",
    "categories",
]

const COUNTRY_ISO: Record<string, string> = {
    india: "IN",
    "united states": "US",
    "united states of america": "US",
    usa: "US",
    "united kingdom": "GB",
    uk: "GB",
    england: "GB",
    canada: "CA",
    australia: "AU",
    germany: "DE",
    france: "FR",
    spain: "ES",
    italy: "IT",
    japan: "JP",
    china: "CN",
    brazil: "BR",
    mexico: "MX",
    netherlands: "NL",
    singapore: "SG",
    "united arab emirates": "AE",
    uae: "AE",
    ireland: "IE",
    "new zealand": "NZ",
    "south africa": "ZA",
    indonesia: "ID",
    thailand: "TH",
    malaysia: "MY",
    philippines: "PH",
    pakistan: "PK",
    bangladesh: "BD",
    nepal: "NP",
    "sri lanka": "LK",
    nigeria: "NG",
    kenya: "KE",
    poland: "PL",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    switzerland: "CH",
    austria: "AT",
    belgium: "BE",
    portugal: "PT",
    greece: "GR",
    turkey: "TR",
    "south korea": "KR",
    korea: "KR",
    vietnam: "VN",
    argentina: "AR",
    chile: "CL",
    colombia: "CO",
    peru: "PE",
    egypt: "EG",
    "saudi arabia": "SA",
    israel: "IL",
}

function vacant(s?: string | null) {
    return !s || !String(s).trim()
}

function hlFromLanguage(language?: string | null) {
    const raw = (language || "").trim()
    if (!raw) return "en"
    if (/^english$/i.test(raw)) return "en"
    const short = raw.toLowerCase().replace("_", "-")
    const code = short.split("-")[0]
    if (/^[a-z]{2}$/.test(code)) return code
    return "en"
}

function toE164(display?: string | null): string | null {
    if (!display) return null
    const trimmed = display.trim()
    if (!/^\+\d/.test(trimmed)) return null
    const digits = trimmed.replace(/[^\d]/g, "")
    if (digits.length < 8 || digits.length > 15) return null
    return `+${digits}`
}

function phoneParts(display?: string | null): VenuePhone {
    const text = display?.trim() || null
    return { e164: toE164(text), display: text }
}

function whatsappValue(phone: VenuePhone) {
    if (phone.e164) return phone.e164.replace(/^\+/, "")
    if (phone.display) {
        const digits = phone.display.replace(/\D/g, "")
        return digits || null
    }
    return null
}

function extractPostal(formatted: string): string | null {
    const uk = formatted.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)
    if (uk) return uk[0].toUpperCase()
    const ca = formatted.match(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i)
    if (ca) return ca[0].toUpperCase()
    const tail = formatted.split(",").slice(-2).join(" ")
    const last = tail.match(/\b(\d{4,6}(?:-\d{4})?)\b/)
    return last?.[1] || null
}

function countryToIso(raw?: string | null): string | null {
    if (!raw) return null
    const t = raw.trim()
    if (/^[A-Z]{2}$/.test(t)) return t
    const mapped = COUNTRY_ISO[t.toLowerCase()]
    return mapped || null
}

function splitFormattedAddress(formatted?: string | null): VenueAddress {
    if (!formatted) {
        return { formatted: null, line1: null, locality: null, region: null, postalCode: null, country: null }
    }
    const postalCode = extractPostal(formatted)
    const parts = formatted.split(",").map((s) => s.trim()).filter(Boolean)
    let country: string | null = null
    if (parts.length) {
        const iso = countryToIso(parts[parts.length - 1])
        if (iso) {
            country = iso
            parts.pop()
        }
    }
    let region: string | null = null
    if (parts.length) {
        let tail = parts[parts.length - 1]
        if (postalCode) tail = tail.replace(postalCode, "").replace(/\s+/g, " ").trim()
        if (tail && (/^[A-Z]{2}$/.test(tail) || /[A-Za-z]{2,}/.test(tail))) {
            region = tail
            parts.pop()
        }
    }
    let locality: string | null = null
    if (parts.length >= 2) {
        locality = parts.pop() || null
    }
    const line1 = parts.join(", ") || null
    return { formatted, line1, locality, region, postalCode, country }
}

function headlineFrom(place: GooglePlaceInfo) {
    if (!place.description) return null
    const description = place.description
    const dot = description.indexOf(". ")
    const first = dot > 20 && dot < 180 ? description.slice(0, dot + 1) : description
    return first.slice(0, 180)
}

function structuredWeekly(rows: GooglePlaceWeeklyHours[]) {
    return rows
        .filter((row) => row.dayOfWeek >= 0 && row.dayOfWeek <= 6)
        .map((row) => ({
            dayOfWeek: row.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            closed: Boolean(row.closed),
            startTime: row.startTime,
            endTime: row.endTime,
        }))
}

function openWeekly(rows: GooglePlaceWeeklyHours[]) {
    return rows.filter((row) => !row.closed && row.startTime && row.endTime)
}

function warningsFor(place: GooglePlaceInfo, usedNameSearch: boolean): string[] {
    const warnings: string[] = []
    if (usedNameSearch) warnings.push("Searched by name; confirm this is the right listing.")
    if (!place.placeId) warnings.push("No placeId found.")
    if (!place.address) warnings.push("No address found.")
    if (!place.phone) warnings.push("No phone found.")
    if (!place.photos.length) warnings.push("No photos found.")
    if (!openWeekly(place.weeklyHours).length) warnings.push("Hours are unstructured; apply will skip hours.")
    else if (place.weeklyHours.length < 5) warnings.push("Hours table looks incomplete.")
    if (!place.reviews.length) warnings.push("Reviews could not be parsed.")
    return warnings
}

function toPreview(place: GooglePlaceInfo, timezone: string | null, usedNameSearch: boolean): ListingPreview {
    const weekly = structuredWeekly(place.weeklyHours)
    return {
        source: "google",
        fetchedAt: new Date().toISOString(),
        placeId: place.placeId,
        mapsUrl: place.mapsUrl,
        name: place.name,
        rating: place.rating,
        reviewCount: place.reviewCount,
        address: (() => {
            const a = splitFormattedAddress(place.address)
            return {
                formatted: a.formatted ?? null,
                line1: a.line1 ?? null,
                locality: a.locality ?? null,
                region: a.region ?? null,
                postalCode: a.postalCode ?? null,
                country: a.country ?? null,
            }
        })(),
        phone: (() => {
            const p = phoneParts(place.phone)
            return { e164: p.e164 ?? null, display: p.display ?? null }
        })(),
        website: place.website,
        hours: {
            statusText: place.hours,
            weekly,
            timezone: weekly.length ? timezone : null,
        },
        categories: place.categories,
        description: place.description,
        photos: place.photos
            .filter((p) => p.url)
            .slice(0, 12)
            .map((p) => ({ url: p.url, source: "google" as const })),
        reviews: place.reviews,
        warnings: warningsFor(place, usedNameSearch),
    }
}

async function loadOwnedProfile() {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    return profile
}

function newImageId() {
    return `c${randomBytes(12).toString("hex")}`
}

export async function previewListing(input: {
    mapsUrl?: string
    placeId?: string
    name?: string
    locale?: { hl?: string; gl?: string }
} = {}): Promise<ListingPreview> {
    const profile = await loadOwnedProfile()
    const fromConfig = googlePlaceFromConfig(profile.personalityConfig)
    const mapsUrl = input.mapsUrl || fromConfig.mapsUrl
    const placeId = input.placeId || fromConfig.placeId
    const name = input.name?.trim() || profile.displayName
    const usedNameSearch = !mapsUrl && !placeId
    const place = await fetchGooglePlace({
        name,
        mapsUrl,
        placeId,
        hl: input.locale?.hl || hlFromLanguage(profile.language),
        gl: input.locale?.gl,
    })
    return toPreview(place, profile.timezone || null, usedNameSearch)
}

export async function applyListing(input: {
    mapsUrl?: string
    placeId?: string
    fields: string[]
    overwrite: boolean
    publishPhotos: boolean
}): Promise<ListingApplyResult> {
    const profile = await loadOwnedProfile()
    const overwrite = Boolean(input.overwrite)
    const publishPhotos = Boolean(input.publishPhotos)
    const fields = [...new Set((input.fields || []).filter((f): f is ListingField => (
        LISTING_FIELDS.includes(f as ListingField)
    )))]

    const row = await prisma.profile.findUnique({
        where: { id: profile.id },
        select: {
            id: true,
            slug: true,
            displayName: true,
            headline: true,
            bio: true,
            whatsapp: true,
            personalityConfig: true,
            language: true,
            timezone: true,
        },
    })
    if (!row) throw new Error("Unauthorized")

    const fromConfig = googlePlaceFromConfig(row.personalityConfig)
    const mapsUrl = input.mapsUrl || fromConfig.mapsUrl
    const placeId = input.placeId || fromConfig.placeId
    const place = await fetchGooglePlace({
        name: row.displayName,
        mapsUrl,
        placeId,
        hl: hlFromLanguage(row.language),
    })

    const preview = toPreview(place, row.timezone || null, !mapsUrl && !placeId)
    const venue = venueFromConfig(row.personalityConfig)
    const socials = socialsFromConfig(row.personalityConfig)
    const applied: ListingField[] = []
    const skipped: Array<{ field: ListingField; reason: string }> = []
    const profilePatch: {
        displayName?: string
        headline?: string | null
        bio?: string | null
        whatsapp?: string | null
    } = {}
    let config = row.personalityConfig
    const venuePatch: VenueBag = {}

    const skip = (field: ListingField, reason: string) => {
        skipped.push({ field, reason })
    }
    const take = (field: ListingField) => {
        if (!applied.includes(field)) applied.push(field)
    }

    if (fields.includes("placeId")) {
        if (!preview.placeId) skip("placeId", "listing has no placeId")
        else if (!overwrite && fromConfig.placeId) skip("placeId", "already set")
        else {
            config = writeGooglePlaceId(config, preview.placeId)
            take("placeId")
        }
    }

    if (fields.includes("mapsUrl")) {
        if (!preview.mapsUrl) skip("mapsUrl", "listing has no mapsUrl")
        else if (!overwrite && socials.maps) skip("mapsUrl", "already set")
        else {
            config = writeSocials(config, { ...socialsFromConfig(config), maps: preview.mapsUrl })
            take("mapsUrl")
        }
    }

    if (fields.includes("displayName")) {
        if (vacant(preview.name)) skip("displayName", "listing has no name")
        else if (!overwrite && !vacant(row.displayName)) skip("displayName", "already set")
        else {
            profilePatch.displayName = preview.name!.trim()
            take("displayName")
        }
    }

    if (fields.includes("headline")) {
        const headline = headlineFrom(place)
        if (vacant(headline)) skip("headline", "listing has no description")
        else if (!overwrite && !vacant(row.headline)) skip("headline", "already set")
        else {
            profilePatch.headline = headline
            take("headline")
        }
    }

    if (fields.includes("bio")) {
        if (vacant(place.description)) skip("bio", "listing has no description")
        else if (!overwrite && !vacant(row.bio)) skip("bio", "already set")
        else {
            profilePatch.bio = place.description
            take("bio")
        }
    }

    if (fields.includes("phone")) {
        const phone = preview.phone
        const hasPhone = !vacant(phone.display) || !vacant(phone.e164)
        if (!hasPhone) skip("phone", "listing has no phone")
        else {
            const venuePhoneEmpty = vacant(venue.phone?.display) && vacant(venue.phone?.e164)
            const whatsappEmpty = vacant(row.whatsapp)
            if (!overwrite && !venuePhoneEmpty && !whatsappEmpty) skip("phone", "already set")
            else {
                if (overwrite || venuePhoneEmpty) venuePatch.phone = phone
                if (overwrite || whatsappEmpty) {
                    const wa = whatsappValue(phone)
                    if (wa) profilePatch.whatsapp = wa
                }
                take("phone")
            }
        }
    }

    if (fields.includes("address")) {
        if (vacant(preview.address.formatted)) skip("address", "listing has no address")
        else if (!overwrite && !vacant(venue.address?.formatted)) skip("address", "already set")
        else {
            venuePatch.address = preview.address
            take("address")
        }
    }

    if (fields.includes("categories")) {
        if (!preview.categories.length) skip("categories", "listing has no categories")
        else if (!overwrite && (venue.categories?.length || 0) > 0) skip("categories", "already set")
        else {
            venuePatch.categories = preview.categories
            take("categories")
        }
    }

    if (venuePatch.address || venuePatch.phone || venuePatch.categories) {
        config = writeVenue(config, venuePatch)
    }

    if (fields.includes("hours")) {
        const open = openWeekly(place.weeklyHours)
        if (!open.length) skip("hours", "hours unstructured")
        else {
            const existing = await prisma.availabilitySchedule.count({ where: { profileId: row.id } })
            if (!overwrite && existing > 0) skip("hours", "already set")
            else {
                try {
                    await prisma.$transaction(async (tx) => {
                        await tx.availabilitySchedule.deleteMany({ where: { profileId: row.id } })
                        await tx.availabilitySchedule.createMany({
                            data: open.map((s) => ({
                                profileId: row.id,
                                dayOfWeek: s.dayOfWeek,
                                startTime: s.startTime as string,
                                endTime: s.endTime as string,
                                isEnabled: true,
                            })),
                        })
                    })
                    take("hours")
                    revalidatePath("/dashboard/calendar")
                } catch {
                    skip("hours", "could not write hours")
                }
            }
        }
    }

    if (fields.includes("photos")) {
        const incoming = preview.photos.filter((p) => p.url && (p.url.startsWith("https://") || p.url.startsWith("/")))
        if (!incoming.length) skip("photos", "listing has no photos")
        else {
            const existing = await prisma.$queryRaw<Array<{ url: string; sortOrder: number }>>`
                SELECT url, "sortOrder" FROM "ProfileImage" WHERE "profileId" = ${row.id} ORDER BY "sortOrder" DESC
            `
            if (!overwrite && existing.length > 0) skip("photos", "already set")
            else {
                const seen = new Set(existing.map((p) => p.url))
                const fresh = incoming.filter((p) => !seen.has(p.url))
                if (!fresh.length) skip("photos", "photos already present")
                else {
                    try {
                        let sortOrder = existing[0]?.sortOrder || 0
                        for (const photo of fresh) {
                            sortOrder += 1
                            const id = newImageId()
                            await prisma.$executeRaw`
                                INSERT INTO "ProfileImage" (id, "profileId", url, title, caption, body, category, "sortOrder", "isPublished", "createdAt")
                                VALUES (
                                    ${id},
                                    ${row.id},
                                    ${photo.url},
                                    ${place.name?.slice(0, 80) || null},
                                    ${null},
                                    ${null},
                                    CAST(${"AMBIENCE"} AS "ProfileImageCategory"),
                                    ${sortOrder},
                                    ${publishPhotos},
                                    CURRENT_TIMESTAMP
                                )
                            `
                        }
                        take("photos")
                        revalidatePath(`/${row.slug}/story`)
                    } catch {
                        skip("photos", "could not write photos")
                    }
                }
            }
        }
    }

    const hasProfilePatch = Object.keys(profilePatch).length > 0
    if (hasProfilePatch || applied.includes("placeId") || applied.includes("mapsUrl") || venuePatch.address || venuePatch.phone || venuePatch.categories) {
        await prisma.profile.update({
            where: { id: row.id },
            data: {
                ...profilePatch,
                personalityConfig: config,
            },
        })
    }

    revalidatePath("/dashboard/profile")
    revalidatePath(`/${row.slug}`)

    return {
        applied,
        skipped,
        venue: venueFromConfig(config),
    }
}
