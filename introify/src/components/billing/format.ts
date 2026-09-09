export function dollars(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
}

export function billingDate(value: string | null) {
    if (!value) return "Date pending"
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "Date pending" : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date)
}

export function storageSize(bytes: number) {
    return bytes >= 1024 ** 3 ? `${Number((bytes / 1024 ** 3).toFixed(1))} GB` : `${Number((bytes / 1024 ** 2).toFixed(1))} MB`
}

export function safeInvoiceUrl(value: string | null) {
    try {
        const url = new URL(value || "")
        return url.protocol === "https:" && !url.username && !url.password ? url.href : null
    } catch { return null }
}

export function invoiceAmount(minorUnits: number, currency: string) {
    try {
        const format = new Intl.NumberFormat("en-US", { style: "currency", currency })
        return format.format(minorUnits / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2))
    } catch { return `${minorUnits} minor units` }
}
