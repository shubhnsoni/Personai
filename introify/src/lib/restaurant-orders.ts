import { dishGroups } from "./dish-options"

export const MAX_CART_LINES = 50
export const MAX_LINE_QUANTITY = 20

export type RestaurantOrderChannel = "DINE_IN" | "TAKEAWAY"
export type RestaurantOrderPayMethod = "UPI" | "COD" | "WHATSAPP"
export type RestaurantOrderStatus =
    | "PLACED"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "SERVED"
    | "PAID"
    | "CANCELLED"
export type RestaurantOrderLineStatus = "QUEUED" | "PREPARING" | "READY" | "SERVED"

export type ModifierSelectionInput = {
    groupId: string
    optionIds: string[]
}

export type RestaurantCartLineInput = {
    productId: string
    qty: number
    modifiers?: ModifierSelectionInput[]
}

export type CreateRestaurantOrderInput = {
    profileSlug: string
    idempotencyKey: string
    lines: RestaurantCartLineInput[]
    guestName: string
    guestEmail: string
    guestPhone?: string
    note?: string
    channel: RestaurantOrderChannel
    tableCode?: string
    payMethod: RestaurantOrderPayMethod
}

export type NormalizedRestaurantOrderInput = {
    profileSlug: string
    idempotencyKey: string
    lines: Array<{
        productId: string
        qty: number
        modifiers: ModifierSelectionInput[]
    }>
    guestName: string
    guestEmail: string
    guestPhone: string | null
    note: string | null
    channel: RestaurantOrderChannel
    tableCode: string | null
    payMethod: RestaurantOrderPayMethod
}

export type OrderableProduct = {
    id: string
    profileId: string
    title: string
    sku: string | null
    priceCents: number
    currency: string
    category: string | null
    isActive: boolean
    stock: number | null
}

export type ModifierSnapshot = {
    groupId: string
    group: string
    optionId: string
    label: string
    priceCents: number
}

export type PricedRestaurantLine = {
    productId: string
    titleSnapshot: string
    skuSnapshot: string | null
    qty: number
    unitPriceCents: number
    unitModifierCents: number
    modifiers: ModifierSnapshot[]
    modifiersLabel: string | null
    lineTotalCents: number
}

export type PricedRestaurantCart = {
    lines: PricedRestaurantLine[]
    subtotalCents: number
    totalCents: number
    currency: string
}

function requiredText(value: unknown, label: string, maxLength: number) {
    if (typeof value !== "string") throw new Error(`${label} is required.`)
    const text = value.trim()
    if (!text) throw new Error(`${label} is required.`)
    if (text.length > maxLength) throw new Error(`${label} is too long.`)
    return text
}

function optionalText(value: unknown, label: string, maxLength: number) {
    if (value == null || value === "") return null
    if (typeof value !== "string") throw new Error(`${label} is invalid.`)
    const text = value.trim()
    if (!text) return null
    if (text.length > maxLength) throw new Error(`${label} is too long.`)
    return text
}

function safeCents(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} has an invalid price.`)
    return value
}

export function normalizeCreateRestaurantOrderInput(raw: CreateRestaurantOrderInput): NormalizedRestaurantOrderInput {
    const input = raw as unknown as Record<string, unknown>
    const profileSlug = requiredText(input.profileSlug, "Restaurant", 160)
    const idempotencyKey = requiredText(input.idempotencyKey, "Order key", 128)
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(idempotencyKey)) {
        throw new Error("Order key is invalid.")
    }

    const guestName = requiredText(input.guestName, "Name", 120)
    const guestEmail = requiredText(input.guestEmail, "Email", 320).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) throw new Error("A real email is required.")
    const guestPhone = optionalText(input.guestPhone, "Phone", 40)
    const note = optionalText(input.note, "Order note", 1000)

    if (input.channel !== "DINE_IN" && input.channel !== "TAKEAWAY") {
        throw new Error("Order channel is invalid.")
    }
    const channel = input.channel
    const rawTableCode = optionalText(input.tableCode, "Table code", 128)
    if (channel === "DINE_IN" && !rawTableCode) throw new Error("Open the menu from the table QR code to order at a table.")
    if (rawTableCode && !/^[A-Za-z0-9_-]{12,128}$/.test(rawTableCode)) throw new Error("Table code is invalid.")
    const tableCode = channel === "DINE_IN" ? rawTableCode : null

    if (input.payMethod !== "UPI" && input.payMethod !== "COD" && input.payMethod !== "WHATSAPP") {
        throw new Error("Payment method is invalid.")
    }
    const payMethod = input.payMethod

    if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error("Cart is empty.")
    if (input.lines.length > MAX_CART_LINES) throw new Error("Cart has too many lines.")

    const lines = input.lines.map((rawLine, lineIndex) => {
        if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) {
            throw new Error(`Cart line ${lineIndex + 1} is invalid.`)
        }
        const line = rawLine as Record<string, unknown>
        const productId = requiredText(line.productId, `Cart line ${lineIndex + 1} product`, 191)
        const qty = line.qty
        if (!Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > MAX_LINE_QUANTITY) {
            throw new Error(`Quantity for cart line ${lineIndex + 1} must be between 1 and ${MAX_LINE_QUANTITY}.`)
        }

        const rawModifiers = line.modifiers == null ? [] : line.modifiers
        if (!Array.isArray(rawModifiers)) throw new Error(`Modifiers for cart line ${lineIndex + 1} are invalid.`)
        const modifiers = rawModifiers.map((rawSelection, modifierIndex) => {
            if (!rawSelection || typeof rawSelection !== "object" || Array.isArray(rawSelection)) {
                throw new Error(`Modifier ${modifierIndex + 1} for cart line ${lineIndex + 1} is invalid.`)
            }
            const selection = rawSelection as Record<string, unknown>
            const groupId = requiredText(selection.groupId, "Modifier group", 100)
            if (!Array.isArray(selection.optionIds)) throw new Error(`Choices for ${groupId} are invalid.`)
            const optionIds = selection.optionIds.map((optionId) => requiredText(optionId, "Modifier choice", 100))
            return { groupId, optionIds }
        })
        return { productId, qty: qty as number, modifiers }
    })

    return {
        profileSlug,
        idempotencyKey,
        lines,
        guestName,
        guestEmail,
        guestPhone,
        note,
        channel,
        tableCode,
        payMethod,
    }
}

export function priceRestaurantCart(
    expectedProfileId: string,
    inputLines: NormalizedRestaurantOrderInput["lines"],
    products: OrderableProduct[],
): PricedRestaurantCart {
    const productById = new Map(products.map((product) => [product.id, product]))
    const requestedQty = new Map<string, number>()
    const pricedLines: PricedRestaurantLine[] = []
    let currency: string | null = null
    let subtotalCents = 0

    for (const [lineIndex, line] of inputLines.entries()) {
        const product = productById.get(line.productId)
        if (!product) throw new Error(`Cart line ${lineIndex + 1} is no longer available.`)
        if (product.profileId !== expectedProfileId) throw new Error("Every cart item must belong to the same restaurant.")
        if (!product.isActive) throw new Error(`${product.title} is no longer available.`)

        const productCurrency = requiredText(product.currency, `${product.title} currency`, 8).toUpperCase()
        if (currency && currency !== productCurrency) throw new Error("All cart items must use the same currency.")
        currency = productCurrency
        const unitPriceCents = safeCents(product.priceCents, product.title)

        requestedQty.set(product.id, (requestedQty.get(product.id) || 0) + line.qty)

        const groups = dishGroups(product.category, product.title)
        const groupById = new Map(groups.map((group) => [group.id, group]))
        const selectedByGroup = new Map<string, string[]>()
        for (const selection of line.modifiers) {
            if (selectedByGroup.has(selection.groupId)) throw new Error(`Modifier group ${selection.groupId} was submitted more than once.`)
            if (!groupById.has(selection.groupId)) throw new Error(`Unknown modifier group for ${product.title}.`)
            if (new Set(selection.optionIds).size !== selection.optionIds.length) {
                throw new Error(`A modifier choice for ${product.title} was submitted more than once.`)
            }
            selectedByGroup.set(selection.groupId, selection.optionIds)
        }

        const modifierSnapshots: ModifierSnapshot[] = []
        for (const group of groups) {
            const selectedIds = selectedByGroup.get(group.id) || []
            if (group.required && selectedIds.length === 0) throw new Error(`${group.label} is required for ${product.title}.`)
            if (selectedIds.length > group.max) throw new Error(`Too many ${group.label.toLowerCase()} choices for ${product.title}.`)
            for (const optionId of selectedIds) {
                const option = group.options.find((choice) => choice.id === optionId)
                if (!option) throw new Error(`Unknown ${group.label.toLowerCase()} choice for ${product.title}.`)
                modifierSnapshots.push({
                    groupId: group.id,
                    group: group.label,
                    optionId: option.id,
                    label: option.name,
                    priceCents: safeCents(option.priceCents, option.name),
                })
            }
        }

        const unitModifierCents = modifierSnapshots.reduce((sum, modifier) => sum + modifier.priceCents, 0)
        safeCents(unitModifierCents, `${product.title} modifiers`)
        const lineTotalCents = (unitPriceCents + unitModifierCents) * line.qty
        safeCents(lineTotalCents, product.title)
        subtotalCents += lineTotalCents
        safeCents(subtotalCents, "Order")

        pricedLines.push({
            productId: product.id,
            titleSnapshot: product.title,
            skuSnapshot: product.sku,
            qty: line.qty,
            unitPriceCents,
            unitModifierCents,
            modifiers: modifierSnapshots,
            modifiersLabel: modifierSnapshots.length ? modifierSnapshots.map((modifier) => modifier.label).join(", ") : null,
            lineTotalCents,
        })
    }

    for (const product of products) {
        const qty = requestedQty.get(product.id) || 0
        if (qty > 0 && product.stock != null && product.stock < qty) {
            throw new Error(product.stock <= 0 ? `${product.title} is sold out.` : `Only ${product.stock} ${product.title} available.`)
        }
    }

    if (!currency) throw new Error("Cart is empty.")
    return { lines: pricedLines, subtotalCents, totalCents: subtotalCents, currency }
}

export function businessDateKey(timeZone: string, now = new Date()) {
    let parts: Intl.DateTimeFormatPart[]
    try {
        parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(now)
    } catch {
        throw new Error("Restaurant timezone is invalid.")
    }
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
}

const ORDER_SEQUENCE: Exclude<RestaurantOrderStatus, "CANCELLED">[] = [
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "SERVED",
    "PAID",
]
const LINE_SEQUENCE: RestaurantOrderLineStatus[] = ["QUEUED", "PREPARING", "READY", "SERVED"]

export function nextOrderStatus(current: RestaurantOrderStatus) {
    if (current === "CANCELLED" || current === "PAID") return null
    const index = ORDER_SEQUENCE.indexOf(current)
    return index >= 0 ? ORDER_SEQUENCE[index + 1] || null : null
}

export function assertOrderTransition(from: RestaurantOrderStatus, to: RestaurantOrderStatus) {
    if (nextOrderStatus(from) !== to) throw new Error(`Cannot move an order from ${from} to ${to}.`)
}

export function nextOrderLineStatus(current: RestaurantOrderLineStatus) {
    const index = LINE_SEQUENCE.indexOf(current)
    return index >= 0 ? LINE_SEQUENCE[index + 1] || null : null
}

export function assertOrderLineTransition(from: RestaurantOrderLineStatus, to: RestaurantOrderLineStatus) {
    if (nextOrderLineStatus(from) !== to) throw new Error(`Cannot move an order line from ${from} to ${to}.`)
}
