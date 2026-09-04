export type VehicleFitment = {
    make: string
    model: string
    yearFrom: number
    yearTo: number
}

export function parseFitment(variantsJson?: string | null): VehicleFitment | null {
    if (!variantsJson) return null
    try {
        const o = JSON.parse(variantsJson) as { fitment?: VehicleFitment }
        const f = o?.fitment
        if (!f || typeof f.make !== "string" || typeof f.model !== "string") return null
        const yearFrom = Number(f.yearFrom)
        const yearTo = Number(f.yearTo)
        if (!Number.isFinite(yearFrom) || !Number.isFinite(yearTo)) return null
        return { make: f.make, model: f.model, yearFrom, yearTo }
    } catch {
        return null
    }
}

export function writeFitment(existing: string | null | undefined, fitment: VehicleFitment | null) {
    let o: Record<string, unknown> = {}
    try { o = JSON.parse(existing || "{}") as Record<string, unknown> } catch { o = {} }
    if (fitment) o.fitment = fitment
    else delete o.fitment
    return JSON.stringify(o)
}

export function fitsVehicle(fitment: VehicleFitment, make: string, model: string, year?: number) {
    if (fitment.make.toLowerCase() !== make.trim().toLowerCase()) return false
    if (fitment.model.toLowerCase() !== model.trim().toLowerCase()) return false
    if (year == null) return true
    return year >= fitment.yearFrom && year <= fitment.yearTo
}

/** Public shop filter: optional make chip ANDed with optional year (model not required). */
export function fitsShopVehicle(
    fitment: VehicleFitment,
    opts: { make?: string | null; year?: number | null },
) {
    const make = opts.make?.trim()
    if (make && make.toLowerCase() !== "all") {
        if (fitment.make.toLowerCase() !== make.toLowerCase()) return false
    }
    if (opts.year != null && Number.isFinite(opts.year)) {
        if (opts.year < fitment.yearFrom || opts.year > fitment.yearTo) return false
    }
    return true
}

/** Unique years covered by catalog fitment ranges (newest first). */
export function yearsInCatalog(fitments: Array<VehicleFitment | null | undefined>): number[] {
    const set = new Set<number>()
    for (const f of fitments) {
        if (!f) continue
        const from = Math.min(f.yearFrom, f.yearTo)
        const to = Math.max(f.yearFrom, f.yearTo)
        for (let y = from; y <= to; y++) set.add(y)
    }
    return Array.from(set).sort((a, b) => b - a)
}

export function fitmentLine(variantsJson?: string | null): string | null {
    const f = parseFitment(variantsJson)
    if (!f) return null
    return `${f.make} ${f.model} ${f.yearFrom}–${f.yearTo}`
}

export function isAutoParts(role?: string | null) {
    return role === "AUTO_PARTS"
}
