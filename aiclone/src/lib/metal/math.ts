/** Integer gold math. Paise and milligrams only — no floats in the ledger. */

export const K24_BPS = 9990
export const K22_BPS = 9160
export const K18_BPS = 7500

/** ₹200 / 10 g. Hourly poll may nudge; it must not silently rewrite the board. */
export const MOVE_THRESHOLD_PAISE_PER_10G = 20_000

export type Karat = "24K" | "22K" | "18K"

export type GoldRates = {
    k24PaisePer10g: number
    k22PaisePer10g: number
    k18PaisePer10g: number
}

export type ProductMetal = {
    grossMg: number
    purityBps: number
    makingPaise: number
    costTouchBps?: number
    costPaise?: number
    sourceBillId?: string
}

export function isJewelryRetail(role?: string | null) {
    return role === "JEWELRY_RETAIL"
}

export function isJewelryWholesale(role?: string | null) {
    return role === "JEWELRY_WHOLESALE"
}

export function isJewelryKit(role?: string | null) {
    return isJewelryRetail(role) || isJewelryWholesale(role)
}

export function karatToBps(karat: Karat): number {
    if (karat === "24K") return K24_BPS
    if (karat === "18K") return K18_BPS
    return K22_BPS
}

export function bpsToKarat(purityBps: number): Karat | null {
    if (purityBps >= 9900) return "24K"
    if (purityBps >= 9000 && purityBps <= 9300) return "22K"
    if (purityBps >= 7400 && purityBps <= 7600) return "18K"
    return null
}

export function gramsToMg(grams: number): number {
    if (!Number.isFinite(grams) || grams < 0) return 0
    return Math.round(grams * 1000)
}

export function mgToGrams(mg: number): number {
    return mg / 1000
}

export function rupeesToPaise(rupees: number): number {
    if (!Number.isFinite(rupees) || rupees < 0) return 0
    return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
    return Math.round(paise / 100)
}

/** City pages quote ₹ / gram. The board stores paise / 10 g. */
export function rupeesPerGramToPaisePer10g(rupeesPerGram: number): number {
    if (!Number.isFinite(rupeesPerGram) || rupeesPerGram <= 0) return 0
    return Math.round(rupeesPerGram * 10 * 100)
}

export function paisePer10gToRupeesPerGram(paisePer10g: number): number {
    return paisePer10g / 1000
}

export function ratePaisePer10gForPurity(rates: GoldRates, purityBps: number): number {
    if (purityBps >= 9900) return rates.k24PaisePer10g
    if (purityBps >= 9000 && purityBps <= 9300) return rates.k22PaisePer10g
    if (purityBps >= 7400 && purityBps <= 7600) return rates.k18PaisePer10g
    if (rates.k24PaisePer10g <= 0) return 0
    return Math.round((rates.k24PaisePer10g * purityBps) / K24_BPS)
}

/** Metal value for this weight at the city rate for this purity. */
export function metalPaise(grossMg: number, purityBps: number, rates: GoldRates): number {
    if (grossMg <= 0 || purityBps <= 0) return 0
    const rate = ratePaisePer10gForPurity(rates, purityBps)
    if (rate <= 0) return 0
    return Math.round((grossMg * rate) / 10_000)
}

export function ticketPaise(spec: ProductMetal, rates: GoldRates): number {
    return metalPaise(spec.grossMg, spec.purityBps, rates) + Math.max(0, spec.makingPaise)
}

export function boardMoved(current: GoldRates, next: GoldRates, threshold = MOVE_THRESHOLD_PAISE_PER_10G): boolean {
    return Math.abs(next.k22PaisePer10g - current.k22PaisePer10g) >= threshold
}

export function formatInrPaise(paise: number): string {
    if (paise <= 0) return "₹0"
    return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`
}

export function formatRatePerGram(paisePer10g: number): string {
    const rupees = Math.round(paisePer10gToRupeesPerGram(paisePer10g))
    return `₹${rupees.toLocaleString("en-IN")}/g`
}
