/** Guest shop order history — localStorage keyed by shop slug (P1-1). */

export type GuestShopPayMethod = "COD" | "UPI" | "WHATSAPP" | "CARD"

export type GuestShopOrder = {
    id: string
    /** Short guest-facing reference derived from id */
    reference: string
    slug: string
    title: string
    itemNames: string[]
    totalCents: number
    currency: string
    payMethod: GuestShopPayMethod
    status: "PLACED" | "HANDOFF" | "PENDING_CARD"
    nextStep: string
    createdAt: string
}

export type KeyValueStore = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem?(key: string): void
}

const MAX_ORDERS = 24
const KEY = (slug: string) => `pl-guest-shop-orders-${slug}`

export function guestOrderReference(id: string): string {
    const cleaned = id.replace(/[^a-zA-Z0-9]/g, "")
    const tail = cleaned.slice(-8).toUpperCase() || cleaned.toUpperCase() || "ORDER"
    return `#${tail}`
}

export function payMethodLabel(method: GuestShopPayMethod): string {
    switch (method) {
        case "COD": return "Cash on delivery"
        case "UPI": return "UPI"
        case "WHATSAPP": return "WhatsApp"
        case "CARD": return "Card"
        default: return method
    }
}

export function nextStepCopy(method: GuestShopPayMethod): string {
    switch (method) {
        case "COD":
            return "Pay cash when you receive it. Keep this reference handy if the shop asks."
        case "UPI":
            return "Complete the UPI payment, then the shop will confirm in Sales."
        case "WHATSAPP":
            return "Finish the chat on WhatsApp — the shop has this order request."
        case "CARD":
            return "Complete card payment in the secure checkout window. You'll get email confirmation."
        default:
            return "The shop has your order."
    }
}

function blankStorage(): KeyValueStore | null {
    if (typeof localStorage === "undefined") return null
    return localStorage
}

function parseList(raw: string | null): GuestShopOrder[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isGuestShopOrder).slice(0, MAX_ORDERS)
    } catch {
        return []
    }
}

function isGuestShopOrder(value: unknown): value is GuestShopOrder {
    if (!value || typeof value !== "object") return false
    const row = value as Record<string, unknown>
    return (
        typeof row.id === "string" &&
        typeof row.reference === "string" &&
        typeof row.slug === "string" &&
        typeof row.title === "string" &&
        Array.isArray(row.itemNames) &&
        typeof row.totalCents === "number" &&
        typeof row.currency === "string" &&
        typeof row.payMethod === "string" &&
        typeof row.createdAt === "string"
    )
}

export function readGuestShopOrders(slug: string, storage?: KeyValueStore | null): GuestShopOrder[] {
    const store = storage === undefined ? blankStorage() : storage
    if (!store || !slug.trim()) return []
    return parseList(store.getItem(KEY(slug.trim())))
}

export function writeGuestShopOrder(
    order: Omit<GuestShopOrder, "reference" | "createdAt" | "nextStep" | "status"> & {
        reference?: string
        createdAt?: string
        nextStep?: string
        status?: GuestShopOrder["status"]
    },
    storage?: KeyValueStore | null,
    now = Date.now(),
): GuestShopOrder {
    const store = storage === undefined ? blankStorage() : storage
    const record: GuestShopOrder = {
        id: order.id,
        reference: order.reference || guestOrderReference(order.id),
        slug: order.slug,
        title: order.title,
        itemNames: order.itemNames.length ? order.itemNames : [order.title],
        totalCents: order.totalCents,
        currency: order.currency || "INR",
        payMethod: order.payMethod,
        status: order.status || (order.payMethod === "CARD" ? "PENDING_CARD" : order.payMethod === "WHATSAPP" ? "HANDOFF" : "PLACED"),
        nextStep: order.nextStep || nextStepCopy(order.payMethod),
        createdAt: order.createdAt || new Date(now).toISOString(),
    }
    if (!store) return record
    const existing = readGuestShopOrders(record.slug, store).filter((row) => row.id !== record.id)
    const next = [record, ...existing].slice(0, MAX_ORDERS)
    try {
        store.setItem(KEY(record.slug), JSON.stringify(next))
    } catch {
        /* quota / private mode */
    }
    return record
}

export function guestShopOrderCount(slug: string, storage?: KeyValueStore | null): number {
    return readGuestShopOrders(slug, storage).length
}
