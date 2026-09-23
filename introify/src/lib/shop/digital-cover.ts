/**
 * Creator P0-2 — PDF / digital PDP cover when the product has no owner photo.
 * Reuses existing public/uploads try-* assets (workbook-ish zine / course art).
 * Never returns pharmacy stock.
 */
export function digitalCoverForProduct(
    type?: string | null,
    title?: string | null,
): string | null {
    const kind = (type || "").trim().toUpperCase()
    if (kind !== "PDF" && kind !== "VIDEO" && kind !== "AUDIO") return null
    const name = (title || "").toLowerCase()
    if (kind === "VIDEO") return "/uploads/try-film.jpg"
    if (kind === "AUDIO") return "/uploads/try-presets.jpg"
    if (/script|discovery|call/.test(name)) return "/uploads/try-course.jpg"
    // Workbook / PDF default — zine cover reads as a document pack, not medicine.
    return "/uploads/try-zine.jpg"
}

/** Pharmacy blister art is only honest for pharmacy kits. */
export function pdpAllowsBlisterFallback(roleTemplate?: string | null, pharmacy?: boolean): boolean {
    if (pharmacy) return true
    const role = (roleTemplate || "").toUpperCase()
    return role === "PHARMACY"
}
