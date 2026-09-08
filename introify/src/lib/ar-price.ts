/** Photoreal 3D pricing. Markup is 3× our generation cost. Never expose the vendor. */

export const AR_CREDITS_PER_ITEM = 30
export const AR_MARKUP = 3

export function creditUsdCents() {
    const n = Number(process.env.MESHY_CREDIT_USD_CENTS)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 2
}

export function arCostCents(count = 1) {
    return AR_CREDITS_PER_ITEM * creditUsdCents() * Math.max(0, count)
}

export function arChargeCents(count = 1) {
    return arCostCents(count) * AR_MARKUP
}

export function arQuote(count: number) {
    const items = Math.max(0, count)
    return {
        items,
        itemCents: arChargeCents(1),
        totalCents: arChargeCents(items),
    }
}
