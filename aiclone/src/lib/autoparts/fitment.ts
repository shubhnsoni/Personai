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

export function writeFitment(existing: string | null | undefined, fitment: VehicleFitment) {
    let o: Record<string, unknown> = {}
    try { o = JSON.parse(existing || "{}") as Record<string, unknown> } catch { o = {} }
    o.fitment = fitment
    return JSON.stringify(o)
}

export function fitsVehicle(fitment: VehicleFitment, make: string, model: string, year?: number) {
    if (fitment.make.toLowerCase() !== make.trim().toLowerCase()) return false
    if (fitment.model.toLowerCase() !== model.trim().toLowerCase()) return false
    if (year == null) return true
    return year >= fitment.yearFrom && year <= fitment.yearTo
}

export function fitmentLine(variantsJson?: string | null): string | null {
    const f = parseFitment(variantsJson)
    if (!f) return null
    return `${f.make} ${f.model} ${f.yearFrom}–${f.yearTo}`
}

export function isAutoParts(role?: string | null) {
    return role === "AUTO_PARTS"
}
