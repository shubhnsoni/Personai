import { encodeHotelCard } from "./cards"
import { parseHotelGuestIntent } from "./requests"

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
}

export type HotelDeskAction =
    | { type: "createHousekeeping"; items: { sku: string; qty: number; label: string }[]; roomNumber?: string }
    | { type: "handoff" }
    | { type: "lateCheckout" }

export type HotelDeskResult = {
    text: string
    action?: HotelDeskAction
}

export function hotelDeskReply(query: string, ctx: HotelDeskContext): HotelDeskResult {
    const intent = parseHotelGuestIntent(query)
    const room = intent.kind === "housekeeping" ? intent.roomNumber || ctx.roomNumber || undefined : ctx.roomNumber || undefined
    const name = ctx.displayName

    if (intent.kind === "greeting") {
        const where = room ? ` for room ${room}` : ""
        return { text: `Hi — I’m the concierge at ${name}${where}. Towels, Wi-Fi, food, or reception?` }
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
    if (intent.kind === "housekeeping") {
        const items = intent.items
        const labels = items.map((item) => (item.qty > 1 ? `${item.qty} ${item.label.toLowerCase()}` : item.label.toLowerCase()))
        const roomBit = room ? ` for room ${room}` : " — tell me the room if this isn’t already on a room QR"
        return {
            text: `I’ll send ${labels.join(" and ")}${roomBit}.`,
            action: { type: "createHousekeeping", items, roomNumber: room },
        }
    }
    const where = room ? ` Room ${room} is on this chat.` : ""
    return { text: `I can bring towels, share Wi-Fi, show restaurants, or call reception.${where} What do you need?` }
}
