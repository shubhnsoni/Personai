import { parseVariants } from "@/lib/commerce"
import type { GoldRates, ProductMetal } from "@/lib/metal/math"
import { bpsToKarat, mgToGrams, ticketPaise } from "@/lib/metal/math"

function asObject(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
}

function asInt(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw)
    return null
}

export function parseProductMetal(variantsJson?: string | null): ProductMetal | null {
    if (!variantsJson?.trim()) return null
    try {
        const parsed = JSON.parse(variantsJson) as unknown
        const bag = asObject(parsed)
        const metal = asObject(bag?.metal) || (bag && "grossMg" in bag ? bag : null)
        if (!metal) return null
        const grossMg = asInt(metal.grossMg)
        const purityBps = asInt(metal.purityBps)
        const makingPaise = asInt(metal.makingPaise) ?? 0
        if (grossMg == null || grossMg <= 0 || purityBps == null || purityBps <= 0) return null
        const costTouchBps = asInt(metal.costTouchBps)
        const costPaise = asInt(metal.costPaise)
        const sourceBillId = typeof metal.sourceBillId === "string" ? metal.sourceBillId : undefined
        return {
            grossMg,
            purityBps,
            makingPaise: Math.max(0, makingPaise),
            ...(costTouchBps && costTouchBps > 0 ? { costTouchBps } : {}),
            ...(costPaise && costPaise > 0 ? { costPaise } : {}),
            ...(sourceBillId ? { sourceBillId } : {}),
        }
    } catch {
        return null
    }
}

export function serializeProductBag(
    variants: { name: string; stock?: number }[],
    metal: ProductMetal | null,
): string | null {
    if (!metal && variants.length === 0) return null
    if (!metal) return JSON.stringify(variants)
    if (variants.length === 0) return JSON.stringify({ metal })
    return JSON.stringify({ metal, variants })
}

export function catalogTicketPaise(
    variantsJson: string | null | undefined,
    rates: GoldRates | null | undefined,
    fallbackCents: number,
): number {
    if (!rates) return fallbackCents
    const metal = parseProductMetal(variantsJson)
    if (!metal) return fallbackCents
    return ticketPaise(metal, rates)
}

export function metalLine(variantsJson?: string | null): string | null {
    const metal = parseProductMetal(variantsJson)
    if (!metal) return null
    const karat = bpsToKarat(metal.purityBps)
    const grams = mgToGrams(metal.grossMg)
    const g = Number.isInteger(grams) ? String(grams) : grams.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
    return karat ? `${g} g · ${karat}` : `${g} g · ${(metal.purityBps / 100).toFixed(1)}%`
}

export function writeProductMetal(
    existingJson: string | null | undefined,
    metal: ProductMetal | null,
    variantsText?: string | null,
): string | null {
    const variants =
        variantsText != null
            ? variantsText
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((name) => ({ name }))
            : parseVariants(existingJson)
    return serializeProductBag(variants, metal)
}
