import { describe, expect, it } from "vitest"
import {
    DEFAULT_GST_RATE_BPS,
    computeGstBreakup,
    gstReceiptLines,
    stampGstInvoice,
    stateCodeFromDistroLocation,
    stateCodeFromGstin,
} from "@/lib/billing/gst"

describe("GST breakup math", () => {
    it("defaults to 18% inclusive split that sums to total", () => {
        const b = computeGstBreakup(11800)
        expect(b.rateBps).toBe(DEFAULT_GST_RATE_BPS)
        expect(b.taxablePaise + b.gstPaise).toBe(11800)
        expect(b.taxablePaise).toBe(10000)
        expect(b.gstPaise).toBe(1800)
        expect(b.mode).toBe("gst")
    })

    it("uses CGST+SGST when seller and buyer state match", () => {
        const b = computeGstBreakup(11800, { sellerStateCode: "20", buyerStateCode: "20" })
        expect(b.mode).toBe("cgst_sgst")
        expect(b.cgstPaise + b.sgstPaise).toBe(b.gstPaise)
        expect(b.igstPaise).toBe(0)
        const lines = gstReceiptLines(b)
        expect(lines).toHaveLength(2)
        expect(lines[0].label).toMatch(/^CGST/)
        expect(lines[1].label).toMatch(/^SGST/)
    })

    it("uses IGST when states differ", () => {
        const b = computeGstBreakup(11800, { sellerStateCode: "20", buyerStateCode: "27" })
        expect(b.mode).toBe("igst")
        expect(b.igstPaise).toBe(1800)
        expect(b.cgstPaise).toBe(0)
    })

    it("falls back to a single GST line when state is unknown", () => {
        const b = computeGstBreakup(11800, { sellerStateCode: "20", buyerStateCode: null })
        expect(b.mode).toBe("gst")
        expect(gstReceiptLines(b)[0].label).toMatch(/^GST/)
    })
})

describe("GST invoice stamp", () => {
    it("reads state from GSTIN and stamps with distro location", () => {
        expect(stateCodeFromGstin("20AABCU9603R1ZM")).toBe("20")
        expect(stateCodeFromDistroLocation("Ranchi")).toBe("20")
        const stamp = stampGstInvoice({
            gstin: "20AABCU9603R1ZM",
            totalPaise: 11800,
            buyerStateCode: stateCodeFromDistroLocation("Jamshedpur"),
        })
        expect(stamp?.gstin).toBe("20AABCU9603R1ZM")
        expect(stamp?.mode).toBe("cgst_sgst")
        expect(stamp?.taxablePaise).toBe(10000)
    })

    it("returns null when profile has no GSTIN", () => {
        expect(stampGstInvoice({ gstin: null, totalPaise: 5000 })).toBeNull()
    })
})
