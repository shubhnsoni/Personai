export type DisplayCurrency = "USD" | "INR"

const USD_INR_RATE = Number(process.env.USD_INR_RATE) || 87

export function usdInrRate() {
    return USD_INR_RATE
}

export function countryFromHeaders(h: Headers): string {
    const header =
        h.get("cf-ipcountry") ||
        h.get("x-vercel-ip-country") ||
        h.get("x-country-code") ||
        h.get("cloudfront-viewer-country") ||
        ""
    const code = header.trim().toUpperCase()
    if (code && code !== "XX" && code !== "T1") return code

    const lang = h.get("accept-language") || ""
    if (/\b(en-IN|hi-IN|hi)\b/i.test(lang)) return "IN"
    return ""
}

export function currencyForCountry(country: string): DisplayCurrency {
    return country === "IN" ? "INR" : "USD"
}

/** Convert stored USD cents to the display/charge minor units (cents or paise). */
export function convertUsdCents(usdCents: number, currency: DisplayCurrency, rate = USD_INR_RATE): number {
    if (usdCents <= 0) return 0
    if (currency === "INR") return Math.round(usdCents * rate)
    return usdCents
}

export function storedCurrency(raw?: string | null): DisplayCurrency {
    return (raw || "USD").toUpperCase() === "INR" ? "INR" : "USD"
}

function formatAmount(amountCents: number, currency: DisplayCurrency): string {
    if (amountCents <= 0) return "Free"
    if (currency === "INR") {
        return `₹${Math.round(amountCents / 100).toLocaleString("en-IN")}`
    }
    const dollars = amountCents / 100
    return `$${dollars.toFixed(amountCents % 100 === 0 ? 0 : 2)}`
}

export function formatMoney(usdCents: number, currency: DisplayCurrency = "USD", rate = USD_INR_RATE): string {
    if (usdCents <= 0) return "Free"
    if (currency === "INR") {
        const rupees = convertUsdCents(usdCents, "INR", rate) / 100
        return `₹${Math.round(rupees).toLocaleString("en-IN")}`
    }
    return formatAmount(usdCents, "USD")
}

/** Format a product/service price using the currency it was stored in. */
export function formatStoredPrice(
    amountCents: number,
    stored: string | null | undefined,
    display: DisplayCurrency,
    rate = USD_INR_RATE,
): string {
    if (amountCents <= 0) return "Free"
    const src = storedCurrency(stored)
    if (src === display) return formatAmount(amountCents, display)
    if (src === "USD") return formatMoney(amountCents, display, rate)
    const usdCents = Math.round(amountCents / rate)
    return formatAmount(usdCents, "USD")
}

export function stripeCurrency(currency: DisplayCurrency): "usd" | "inr" {
    return currency === "INR" ? "inr" : "usd"
}
