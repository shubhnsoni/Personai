import { describe, expect, it } from "vitest"
import {
    fitmentLine,
    fitsShopVehicle,
    fitsVehicle,
    parseFitment,
    writeFitment,
    yearsInCatalog,
} from "@/lib/autoparts/fitment"

describe("auto parts fitment", () => {
    it("round-trips make, model, and year range", () => {
        const json = writeFitment(null, { make: "Maruti", model: "Swift", yearFrom: 2018, yearTo: 2024 })
        expect(parseFitment(json)).toEqual({ make: "Maruti", model: "Swift", yearFrom: 2018, yearTo: 2024 })
        expect(fitmentLine(json)).toBe("Maruti Swift 2018–2024")
    })
    it("matches a year inside the range and rejects others", () => {
        const f = { make: "Hyundai", model: "i20", yearFrom: 2015, yearTo: 2023 }
        expect(fitsVehicle(f, "hyundai", "i20", 2018)).toBe(true)
        expect(fitsVehicle(f, "Hyundai", "i20", 2014)).toBe(false)
        expect(fitsVehicle(f, "Maruti", "i20", 2018)).toBe(false)
    })
    it("clears fitment without wiping sibling variantsJson keys", () => {
        const withMed = writeFitment(
            JSON.stringify({ medicine: { batch: "X", expiry: "2027-01-01", mrpPaise: 100 } }),
            { make: "Maruti", model: "Alto", yearFrom: 2012, yearTo: 2020 },
        )
        const cleared = writeFitment(withMed, null)
        const o = JSON.parse(cleared)
        expect(o.fitment).toBeUndefined()
        expect(o.medicine).toEqual({ batch: "X", expiry: "2027-01-01", mrpPaise: 100 })
    })
    it("shop filter ANDs make chip with year range", () => {
        const f = { make: "Maruti", model: "Swift", yearFrom: 2018, yearTo: 2024 }
        expect(fitsShopVehicle(f, { make: "Maruti" })).toBe(true)
        expect(fitsShopVehicle(f, { make: "Hyundai" })).toBe(false)
        expect(fitsShopVehicle(f, { year: 2020 })).toBe(true)
        expect(fitsShopVehicle(f, { year: 2010 })).toBe(false)
        expect(fitsShopVehicle(f, { make: "Maruti", year: 2020 })).toBe(true)
        expect(fitsShopVehicle(f, { make: "Maruti", year: 2010 })).toBe(false)
        expect(fitsShopVehicle(f, { make: "Hyundai", year: 2020 })).toBe(false)
    })
    it("lists unique years covered by catalog ranges", () => {
        expect(yearsInCatalog([
            { make: "A", model: "B", yearFrom: 2018, yearTo: 2020 },
            { make: "C", model: "D", yearFrom: 2019, yearTo: 2021 },
        ])).toEqual([2021, 2020, 2019, 2018])
    })
})
