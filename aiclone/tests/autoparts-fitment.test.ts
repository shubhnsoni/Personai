import { describe, expect, it } from "vitest"
import { fitmentLine, fitsVehicle, parseFitment, writeFitment } from "@/lib/autoparts/fitment"

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
})
