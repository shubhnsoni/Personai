import { describe, expect, it } from "vitest"
import { citySlug, goodreturnsUrl } from "@/lib/metal/city"
import { parseGoodreturnsHtml, parseMajorCitiesHtml } from "@/lib/metal/fetch-city-rate"
import { rupeesPerGramToPaisePer10g } from "@/lib/metal/math"
import { goldBoardFromConfig, goldTapeStale, orderTapeCities, writeGoldBoard } from "@/lib/metal/board"
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
        expect(goldBoardFromConfig(next)?.collapsed).toBe(false)
        expect(goldBoardFromConfig(next)?.shopTape).toBe(true)
        expect(goldBoardFromConfig(next)?.pdpTape).toBe(true)
    })

    it("round-trips collapse flags and the city tape", () => {
        const fetchedAt = new Date().toISOString()
        const next = writeGoldBoard("{}", {
            city: "Ranchi",
            citySlug: "ranchi",
            asOf: fetchedAt,
            source: "city-feed",
            k24PaisePer10g: 15_415_000,
            k22PaisePer10g: 14_130_000,
            k18PaisePer10g: 11_561_000,
            collapsed: true,
            shopTape: false,
            pdpTape: true,
            tape: {
                fetchedAt,
                cities: [
                    { city: "Ranchi", citySlug: "ranchi", k24PaisePer10g: 15_415_000, k22PaisePer10g: 14_130_000, k18PaisePer10g: 11_561_000 },
                    { city: "Mumbai", citySlug: "mumbai", k24PaisePer10g: 15_415_000, k22PaisePer10g: 14_130_000, k18PaisePer10g: 11_561_000 },
                ],
            },
        })
        const board = goldBoardFromConfig(next)
        expect(board?.collapsed).toBe(true)
        expect(board?.shopTape).toBe(false)
        expect(board?.pdpTape).toBe(true)
        expect(board?.tape?.cities.map((c) => c.citySlug)).toEqual(["ranchi", "mumbai"])
        expect(goldTapeStale(board)).toBe(false)
        expect(orderTapeCities(board!.tape!.cities, "mumbai")[0].citySlug).toBe("mumbai")
    })
})

const CITIES_TABLE = `
<tbody class="major_cities_container">
<tr class="city-row"><td><a href="chennai.html" title="Chennai">Chennai</a></td><td>&#x20b9;15,415</td><td>&#x20b9;14,130</td><td>&#x20b9;11,900</td></tr>
<tr class="city-row"><td><a href="mumbai.html" title="Mumbai">Mumbai</a></td><td>&#x20b9;15,415</td><td>&#x20b9;14,130</td><td>&#x20b9;11,561</td></tr>
</tbody>
<tbody class="tablebody">
<tr class="city-row"><td><a href="bahrain.html" title="Bahrain">Bahrain</a></td><td>54.10</td><td>50.40</td><td>41.20</td></tr>
</tbody>
`

describe("major city tape", () => {
    it("parses the India-page city table and skips country rows", () => {
        const cities = parseMajorCitiesHtml(CITIES_TABLE)
        expect(cities.map((c) => c.city)).toEqual(["Chennai", "Mumbai"])
        expect(cities[0].k22PaisePer10g).toBe(rupeesPerGramToPaisePer10g(14130))
        expect(cities[1].k18PaisePer10g).toBe(rupeesPerGramToPaisePer10g(11561))
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

    it("does not treat medicine batch JSON as a size variant", () => {
        const json = JSON.stringify({
            medicine: { batch: "PCM2408", expiry: "2027-08-01", mrpPaise: 3200 },
        })
        expect(parseVariants(json)).toEqual([])
        expect(parseVariants(JSON.stringify({ metal: { grossMg: 1000, purityBps: 9160, makingPaise: 0 } }))).toEqual([])
    })
})
