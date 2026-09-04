/**
 * Invoice GST stamp helpers (no e-invoice / IRN / GSP).
 *
 * Choice documented here:
 * - Order totals are treated as GST-inclusive invoice totals (taxable + gst = total).
 * - Default rate is 18% (1800 bps) when none is supplied.
 * - If seller + buyer state codes are both known and equal → CGST + SGST (half each).
 * - If both known and different → IGST.
 * - If either state is unknown → a single GST line at the rate (no CGST/SGST/IGST split).
 * Seller state is taken from Profile.gstin (first two digits). Buyer state may come from
 * a known location map (e.g. distro Ranchi/Jamshedpur → Jharkhand "20") when available.
 */

export const DEFAULT_GST_RATE_BPS = 1800
/** Gold jewellery taxable at 3% under GST. */
export const JEWELLERY_GST_RATE_BPS = 300

/** Distro godown locations → GST state code (first two digits of a GSTIN). */
export const DISTRO_LOCATION_STATE: Record<string, string> = {
    Ranchi: "20",
    Jamshedpur: "20",
}

export type GstMode = "cgst_sgst" | "igst" | "gst"

export type GstBreakup = {
    rateBps: number
    taxablePaise: number
    gstPaise: number
    mode: GstMode
    cgstPaise: number
    sgstPaise: number
    igstPaise: number
}

export type GstStamp = GstBreakup & {
    gstin: string
}

/** First two digits of an Indian GSTIN are the state code. */
export function stateCodeFromGstin(gstin?: string | null): string | null {
    if (!gstin) return null
    const cleaned = gstin.trim().toUpperCase()
    const m = /^(\d{2})/.exec(cleaned)
    return m ? m[1] : null
}

export function stateCodeFromDistroLocation(location?: string | null): string | null {
    if (!location) return null
    return DISTRO_LOCATION_STATE[location] ?? null
}

/** Prefer buyer GSTIN state code; otherwise a mapped fallback (e.g. distro location). */
export function resolveBuyerStateCode(buyerGstin?: string | null, fallbackStateCode?: string | null): string | null {
    return stateCodeFromGstin(buyerGstin) ?? (fallbackStateCode?.trim() || null)
}

/**
 * Split an inclusive total into taxable + GST.
 * Rounds taxable so taxable + gst === totalPaise exactly.
 */
export function computeGstBreakup(
    totalPaise: number,
    opts?: {
        rateBps?: number
        sellerStateCode?: string | null
        buyerStateCode?: string | null
    },
): GstBreakup {
    const total = Math.max(0, Math.round(totalPaise || 0))
    const rateBps = Math.max(0, Math.round(opts?.rateBps ?? DEFAULT_GST_RATE_BPS))
    const denom = 10000 + rateBps
    const taxablePaise = rateBps === 0 ? total : Math.round((total * 10000) / denom)
    const gstPaise = total - taxablePaise

    const seller = opts?.sellerStateCode?.trim() || null
    const buyer = opts?.buyerStateCode?.trim() || null

    if (seller && buyer && seller === buyer) {
        const cgstPaise = Math.floor(gstPaise / 2)
        const sgstPaise = gstPaise - cgstPaise
        return {
            rateBps,
            taxablePaise,
            gstPaise,
            mode: "cgst_sgst",
            cgstPaise,
            sgstPaise,
            igstPaise: 0,
        }
    }

    if (seller && buyer && seller !== buyer) {
        return {
            rateBps,
            taxablePaise,
            gstPaise,
            mode: "igst",
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: gstPaise,
        }
    }

    return {
        rateBps,
        taxablePaise,
        gstPaise,
        mode: "gst",
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
    }
}

/** Build a stamp from seller GSTIN + inclusive total (+ optional buyer state). */
export function stampGstInvoice(input: {
    gstin?: string | null
    totalPaise: number
    rateBps?: number
    buyerStateCode?: string | null
}): GstStamp | null {
    const gstin = (input.gstin || "").trim().toUpperCase()
    if (!gstin) return null
    const breakup = computeGstBreakup(input.totalPaise, {
        rateBps: input.rateBps,
        sellerStateCode: stateCodeFromGstin(gstin),
        buyerStateCode: input.buyerStateCode ?? null,
    })
    return { gstin, ...breakup }
}

export function gstReceiptLines(stamp: Pick<GstBreakup, "mode" | "rateBps" | "gstPaise" | "cgstPaise" | "sgstPaise" | "igstPaise">): { label: string; paise: number }[] {
    const half = (stamp.rateBps / 2 / 100).toFixed(stamp.rateBps % 200 === 0 ? 0 : 1)
    const full = (stamp.rateBps / 100).toFixed(stamp.rateBps % 100 === 0 ? 0 : 1)
    if (stamp.mode === "cgst_sgst") {
        return [
            { label: `CGST ${half}%`, paise: stamp.cgstPaise },
            { label: `SGST ${half}%`, paise: stamp.sgstPaise },
        ]
    }
    if (stamp.mode === "igst") {
        return [{ label: `IGST ${full}%`, paise: stamp.igstPaise }]
    }
    return [{ label: `GST ${full}%`, paise: stamp.gstPaise }]
}
