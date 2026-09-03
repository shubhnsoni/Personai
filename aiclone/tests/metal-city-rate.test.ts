import { describe, expect, it } from "vitest"
import { citySlug, goodreturnsUrl } from "@/lib/metal/city"
import { parseGoodreturnsHtml } from "@/lib/metal/fetch-city-rate"
import { rupeesPerGramToPaisePer10g } from "@/lib/metal/math"
import { goldBoardFromConfig, writeGoldBoard } from "@/lib/metal/board"
import { parseProductMetal, writeProductMetal } from "@/lib/metal/product"
import { parseVariants } from "@/lib/commerce"

const MUMBAI_HTML = `
Today's gold price in Mumbai stands at **₹15,535** per gram for 24 karat gold (99.9% purity), **₹14,240** per gram for 22 karat gold (91.6% purity), and **₹11,651** per gram for 18 karat gold (75% purity).
`

const MUMBAI_LIVE = `<p>Today's gold price in Mumbai stands at <strong>&#x20b9;15,535</strong> per gram for 24 karat gold (99.9&percnt; purity), <strong>&#x20b9;14,240</strong> per gram for 22 karat gold (91.6&percnt; purity), and <strong>&#x20b9;11,651</strong> per gram for 18 karat gold (75&percnt; purity).</p>`

describe("city gold feed", () => {
    it("aliases Bengaluru and maps India", () => {
        expect(citySlug("Bengaluru")).toBe("bangalore")
        expect(citySlug("India")).toBe("india")
        expect(goodreturnsUrl("india")).toBe("https://www.goodreturns.in/gold-rates/")
        expect(goodreturnsUrl("mumbai")).toContain("/mumbai.html")
    })

    it("parses GoodReturns lead copy into paise / 10 g", () => {
        const expected = {
            k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
            k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
            k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
        }
        expect(parseGoodreturnsHtml(MUMBAI_HTML)).toEqual(expected)
        expect(parseGoodreturnsHtml(MUMBAI_LIVE)).toEqual(expected)
    })
})

describe("gold board JSON", () => {
    it("round-trips next to extras and venue", () => {
        const raw = JSON.stringify({ extras: { surfaces: ["shop"] }, venue: { address: { locality: "Ranchi" } } })
        const next = writeGoldBoard(raw, {
            city: "Mumbai",
            citySlug: "mumbai",
            asOf: "2026-09-03T10:06:00.000Z",
            source: "city-feed",
            k24PaisePer10g: 15_535_000,
            k22PaisePer10g: 14_240_000,
            k18PaisePer10g: 11_651_000,
        })
        const parsed = JSON.parse(next) as { extras: unknown; venue: unknown; goldBoard: { city: string } }
        expect(parsed.extras).toEqual({ surfaces: ["shop"] })
        expect(parsed.venue).toEqual({ address: { locality: "Ranchi" } })
        expect(goldBoardFromConfig(next)?.city).toBe("Mumbai")
        expect(goldBoardFromConfig(next)?.k22PaisePer10g).toBe(14_240_000)
    })
})

describe("product metal bag", () => {
    it("keeps size variants next to metal", () => {
        const json = writeProductMetal(JSON.stringify([{ name: "2.2" }]), {
            grossMg: 10000,
            purityBps: 9160,
            makingPaise: 50000,
        })
        expect(parseProductMetal(json)?.grossMg).toBe(10000)
        expect(parseVariants(json).map((v) => v.name)).toEqual(["2.2"])
    })

    it("still reads a plain variants array", () => {
        expect(parseVariants(JSON.stringify([{ name: "Red" }]))).toEqual([{ name: "Red", stock: undefined }])
        expect(parseProductMetal(JSON.stringify([{ name: "Red" }]))).toBeNull()
    })
})
