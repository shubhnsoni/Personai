import { encodeHotelCard } from "./cards"
import {
    DEFAULT_HOTEL_EXPERIENCES,
    DEFAULT_MAINTENANCE_CATALOGUE,
    DEFAULT_SPA_CATALOGUE,
    DEFAULT_TRANSPORT_OPTIONS,
    defaultHotelExperiences,
    defaultSpaCatalogue,
    defaultTransportOptions,
} from "./catalogue"
import { findMapMarker, lookupHotelKnowledge, type HotelKnowledgeDoc, type HotelMapMarker } from "./knowledge"
import { detectGuestLanguage, guestEmergencyCopy, guestMaintenanceCopy } from "./language"
import { parseHotelGuestIntent } from "./requests"
import { hotelGoogleReviewSearchUrl, stayFeedbackTone, type HotelStayPhase } from "./stay"
import { firstUpsellLine, type HotelUpsell } from "./upsells"

export type HotelDeskRestaurant = { name: string; slug: string }

export type HotelDeskContext = {
    displayName: string
    wifiName?: string | null
    wifiPassword?: string | null
    checkInTime?: string | null
    checkOutTime?: string | null
    roomNumber?: string | null
    restaurants: HotelDeskRestaurant[]
    policiesApproved?: boolean
    spa?: { sku: string; label: string; durationMinutes: number }[]
    transport?: { sku: string; label: string }[]
    experiences?: { sku: string; label: string; summary?: string }[]
    locality?: string | null
    stayPhase?: HotelStayPhase | null
    emergencyContact?: string | null
    receptionPhone?: string | null
    receptionWhatsapp?: string | null
    quietHours?: string | null
    parkingInfo?: string | null
    propertyHours?: string | null
    knowledge?: HotelKnowledgeDoc[]
    mapMarkers?: HotelMapMarker[]
    mapImageUrl?: string | null
    upsells?: HotelUpsell[]
    staffLanguage?: string
}

export type HotelDeskAction =
    | { type: "createHousekeeping"; items: { sku: string; qty: number; label: string }[]; roomNumber?: string }
    | { type: "handoff" }
    | { type: "lateCheckout" }
    | { type: "createSpa"; sku: string; roomNumber?: string }
    | { type: "createTransport"; sku: string; roomNumber?: string }
    | { type: "createExperience"; sku: string; roomNumber?: string }
    | { type: "checkout"; roomNumber?: string }
    | { type: "feedback"; tone: "positive" | "negative" | "neutral" }
    | { type: "createMaintenance"; sku: string; roomNumber?: string }
    | { type: "emergency" }

export type HotelDeskResult = {
    text: string
    action?: HotelDeskAction
}

function roomOf(intentRoom: string | undefined, ctx: HotelDeskContext) {
    return intentRoom || ctx.roomNumber || undefined
}

function telHref(raw?: string | null) {
    if (!raw) return null
    const digits = raw.replace(/[^\d+]/g, "")
    if (!digits) return null
    return `tel:${digits}`
}

function emergencyPhones(ctx: HotelDeskContext) {
    const phones: { label: string; href: string }[] = []
    const reception = telHref(ctx.receptionPhone || ctx.receptionWhatsapp)
    if (reception) phones.push({ label: "Call reception", href: reception })
    const emergency = telHref(ctx.emergencyContact) || "tel:112"
    phones.push({ label: "Emergency", href: emergency })
    return phones
}

function knowledgeReply(query: string, ctx: HotelDeskContext): HotelDeskResult | null {
    const docs = ctx.knowledge || []
    const hit = lookupHotelKnowledge(docs, query, { guest: true })
    if (!hit) return null
    const card = encodeHotelCard({
        type: "knowledge",
        title: hit.title,
        note: hit.bucket.toLowerCase(),
        items: [hit.body],
    })
    return { text: `${card}\n${hit.body}` }
}

function mapReply(query: string, ctx: HotelDeskContext): HotelDeskResult {
    const markers = ctx.mapMarkers || []
    const hit = findMapMarker(markers, query)
    if (!hit) {
        return { text: `${ctx.displayName} has no map for that yet. Ask reception — I won’t invent a path.` }
    }
    const card = encodeHotelCard({
        type: "map",
        title: hit.label,
        note: hit.hint,
        marker: { label: hit.label, x: hit.x, y: hit.y, kind: hit.kind, hint: hit.hint },
        mapImageUrl: ctx.mapImageUrl || undefined,
    })
    return { text: `${card}\n${hit.label} is on the property map (${hit.hint}). Marker only — no turn-by-turn path.` }
}

export function hotelDeskReply(query: string, ctx: HotelDeskContext): HotelDeskResult {
    const intent = parseHotelGuestIntent(query)
    const lang = detectGuestLanguage(query)
    const room = intent.kind === "housekeeping" || intent.kind === "spa" || intent.kind === "transport" || intent.kind === "experience" || intent.kind === "checkout" || intent.kind === "maintenance"
        ? roomOf("roomNumber" in intent ? intent.roomNumber : undefined, ctx)
        : ctx.roomNumber || undefined
    const name = ctx.displayName
    const spa = ctx.spa?.length ? ctx.spa : defaultSpaCatalogue()
    const transport = ctx.transport?.length ? ctx.transport : defaultTransportOptions()
    const experiences = ctx.experiences && ctx.experiences.length >= 0 ? ctx.experiences : defaultHotelExperiences()

    if (intent.kind === "greeting") {
        const where = room ? ` for room ${room}` : ""
        const extra = firstUpsellLine(ctx.upsells, ctx.stayPhase, ctx.policiesApproved)
        if (ctx.stayPhase === "pre_arrival") {
            return { text: `Hi — we look forward to seeing you at ${name}. Airport transfer, experiences, or the restaurant next door?${extra ? ` ${extra}` : ""}` }
        }
        if (ctx.stayPhase === "after") {
            return { text: `Hope the stay at ${name} was good. Share feedback if you like — I only send a Google search after a positive note, and I never post a review.` }
        }
        return { text: `Hi — I’m the concierge at ${name}${where}. Towels, Wi-Fi, food, spa, transport, or reception?${extra ? ` ${extra}` : ""}` }
    }
    if (intent.kind === "emergency") {
        const phones = emergencyPhones(ctx)
        const card = encodeHotelCard({
            type: "emergency",
            title: "Call now",
            room,
            note: "This is not an ordinary ticket. Do not wait on chat.",
            phones,
            href: phones[0]?.href,
            cta: phones[0]?.label || "Call reception",
        })
        const numbers = phones.map((row) => `${row.label} ${row.href.replace("tel:", "")}`).join(" · ")
        return {
            text: `${card}\n${guestEmergencyCopy(lang)}\n${numbers}`,
            action: { type: "emergency" },
        }
    }
    if (intent.kind === "maintenance") {
        const item = DEFAULT_MAINTENANCE_CATALOGUE.find((row) => row.sku === intent.sku) || DEFAULT_MAINTENANCE_CATALOGUE[0]
        const card = encodeHotelCard({
            type: "maintenance",
            title: item.label,
            room,
            items: [item.label],
            note: "Request only — add a photo if you can. This chat does not charge a fee.",
        })
        return {
            text: `${card}\n${guestMaintenanceCopy(lang, item.label, room)}`,
            action: { type: "createMaintenance", sku: item.sku, roomNumber: room },
        }
    }
    if (intent.kind === "map") return mapReply(intent.query, ctx)
    if (intent.kind === "knowledge") {
        return knowledgeReply(intent.query, ctx) || { text: `I don’t have that on the guest board yet. Ask reception.` }
    }
    if (intent.kind === "wifi") {
        if (!ctx.wifiName) {
            return { text: `Ask reception for the Wi-Fi. I don’t have a network name stored yet.` }
        }
        const password = ctx.wifiPassword ? ` Password: **${ctx.wifiPassword}**.` : " Reception can share the password."
        const card = encodeHotelCard({ type: "wifi", title: "Wi-Fi", wifiName: ctx.wifiName, note: ctx.wifiPassword || undefined })
        return { text: `${card}\nNetwork **${ctx.wifiName}**.${password}` }
    }
    if (intent.kind === "food") {
        if (!ctx.restaurants.length) {
            return { text: `${name} hasn’t connected a restaurant yet. Ask reception for the in-house kitchen.` }
        }
        const lines = ctx.restaurants.map((row) => `- **${row.name}** — /${row.slug}`).join("\n")
        const card = encodeHotelCard({
            type: "restaurants",
            title: "Restaurants",
            restaurants: ctx.restaurants,
        })
        return { text: `${card}\nPlaces you can eat from ${name}:\n${lines}` }
    }
    if (intent.kind === "reception") {
        const card = encodeHotelCard({ type: "handoff", title: "Talk to reception", room: room || undefined })
        return {
            text: `${card}\nI’ll flag reception. Stay on this chat — someone will pick up.`,
            action: { type: "handoff" },
        }
    }
    if (intent.kind === "late_checkout") {
        const out = ctx.checkOutTime || "11:00"
        const note = ctx.policiesApproved
            ? `Standard checkout is ${out}. Late checkout is a request — this chat does not charge a fee.`
            : `Standard checkout is ${out}. Late checkout is a request, not a billed confirmation.`
        const card = encodeHotelCard({
            type: "late_checkout",
            title: "Late checkout",
            note,
        })
        return {
            text: ctx.policiesApproved
                ? `${card}\nCheckout is ${out}. I’ll file a late-checkout request. This chat does not charge a fee.`
                : `${card}\nCheckout is ${out}. I can ask reception to hold the room as a request. Late checkout is not billed from this page.`,
            action: { type: "lateCheckout" },
        }
    }
    if (intent.kind === "spa") {
        const item = spa.find((row) => row.sku === intent.sku) || spa[0] || DEFAULT_SPA_CATALOGUE[0]
        const roomBit = room ? ` for room ${room}` : ""
        const card = encodeHotelCard({
            type: "spa",
            title: item.label,
            room,
            items: [`${item.durationMinutes} min`],
            note: "Request only — this chat does not charge a fee.",
        })
        return {
            text: `${card}\nI’ll request ${item.label} (${item.durationMinutes} min)${roomBit}. This is a request, not a billed booking.`,
            action: { type: "createSpa", sku: item.sku, roomNumber: room },
        }
    }
    if (intent.kind === "transport") {
        const item = transport.find((row) => row.sku === intent.sku) || transport[0] || DEFAULT_TRANSPORT_OPTIONS[0]
        const roomBit = room ? ` for room ${room}` : ""
        const card = encodeHotelCard({
            type: "transport",
            title: item.label,
            room,
            note: "Request only — this chat does not charge a fee.",
        })
        return {
            text: `${card}\nI’ll request ${item.label.toLowerCase()}${roomBit}. This is a request, not a billed ride.`,
            action: { type: "createTransport", sku: item.sku, roomNumber: room },
        }
    }
    if (intent.kind === "experience") {
        const item = experiences.find((row) => row.sku === intent.sku)
            || DEFAULT_HOTEL_EXPERIENCES.find((row) => row.sku === intent.sku)
            || experiences[0]
        if (!item) {
            return { text: `${name} hasn’t listed experiences yet. Ask reception what’s on.` }
        }
        const card = encodeHotelCard({
            type: "experiences",
            title: item.label,
            room,
            note: "Interest request — this chat does not charge a fee.",
        })
        return {
            text: `${card}\nI’ll file an interest request for ${item.label}${room ? ` from room ${room}` : ""}. This is a request, not a billed ticket.`,
            action: { type: "createExperience", sku: item.sku, roomNumber: room },
        }
    }
    if (intent.kind === "experiences") {
        if (!experiences.length) {
            return { text: `${name} hasn’t listed experiences yet. Ask reception what’s on.` }
        }
        const lines = experiences.map((row) => `- **${row.label}**${row.summary ? ` — ${row.summary}` : ""}`).join("\n")
        const card = encodeHotelCard({
            type: "experiences",
            title: "Experiences",
            items: experiences.map((row) => row.label),
        })
        return { text: `${card}\nHotel-curated at ${name}:\n${lines}\nTell me which one to request. This is not a billed booking.` }
    }
    if (intent.kind === "local_guide") {
        const curated = experiences
        const places = ctx.restaurants
        if (!curated.length && !places.length) {
            return { text: `${name} doesn’t have a local guide list yet. Ask reception what’s nearby — I won’t invent a place.` }
        }
        const experienceLines = curated.map((row) => `- **${row.label}**${row.summary ? ` — ${row.summary}` : ""}`)
        const foodLines = places.map((row) => `- **${row.name}** — /${row.slug}`)
        const card = encodeHotelCard({
            type: "local_guide",
            title: "Nearby",
            items: [...curated.map((row) => row.label), ...places.map((row) => row.name)],
            restaurants: places,
        })
        const blocks = [
            experienceLines.length ? `Hotel-curated:\n${experienceLines.join("\n")}` : "",
            foodLines.length ? `Connected kitchen:\n${foodLines.join("\n")}` : "",
        ].filter(Boolean)
        return { text: `${card}\nWhat I can actually point to from ${name}:\n${blocks.join("\n")}` }
    }
    if (intent.kind === "stay_times") {
        const cin = (ctx.checkInTime || "").trim()
        const cout = (ctx.checkOutTime || "").trim()
        const checkInLine = cin ? `Check-in **${cin}**` : "Check-in is not configured"
        const checkOutLine = cout ? `checkout **${cout}**` : "checkout is not configured"
        // Facts only — never attach a Checkout Request action/card (P0-1).
        return {
            text: `At ${name}: ${checkInLine}; ${checkOutLine}.`,
        }
    }
    if (intent.kind === "checkout") {
        const card = encodeHotelCard({
            type: "checkout",
            title: "Checkout",
            room,
            note: "Request only — this chat does not close a bill.",
        })
        return {
            text: `${card}\nI’ll file a checkout request${room ? ` for room ${room}` : ""}. This does not close a bill or charge a card.`,
            action: { type: "checkout", roomNumber: room },
        }
    }
    if (intent.kind === "feedback") {
        const tone = stayFeedbackTone(query)
        if (tone === "positive") {
            const href = hotelGoogleReviewSearchUrl(name, ctx.locality || "Ranchi")
            const card = encodeHotelCard({
                type: "feedback",
                title: "Thank you",
                note: "This chat does not post reviews.",
                href,
                cta: "Google review search",
            })
            return {
                text: `${card}\nGlad it landed well. If you want to leave a Google review, use this search — this chat does not post reviews and never will.\n${href}`,
                action: { type: "feedback", tone },
            }
        }
        const card = encodeHotelCard({
            type: "feedback",
            title: "Feedback",
            note: "Reception will read this. No Google prompt for a poor stay.",
        })
        return {
            text: `${card}\nThanks — reception will read this. I won’t send you to Google for a review.`,
            action: { type: "feedback", tone },
        }
    }
    if (intent.kind === "housekeeping") {
        const items = intent.items
        const labels = items.map((item) => (item.qty > 1 ? `${item.qty} ${item.label.toLowerCase()}` : item.label.toLowerCase()))
        const roomBit = room ? ` for room ${room}` : " — tell me the room if this isn’t already on a room QR"
        return {
            text: `I’ll send ${labels.join(" and ")}${roomBit}.`,
            action: { type: "createHousekeeping", items, roomNumber: room },
        }
    }
    const known = knowledgeReply(query, ctx)
    if (known) return known
    if (findMapMarker(ctx.mapMarkers || [], query)) return mapReply(query, ctx)
    const where = room ? ` Room ${room} is on this chat.` : ""
    return { text: `I can bring towels, file a repair, share Wi-Fi, show restaurants, request spa or transport, list experiences, or call reception.${where} What do you need?` }
}
