import { describe, expect, it } from "vitest"
import { expiryState, isExpiredMedicine, medicineLine, parseMedicine, writeMedicine } from "@/lib/pharmacy/batch"

describe("pharmacy batch", () => {
    it("round-trips batch and expiry", () => {
        const json = writeMedicine(null, { batch: "B12", expiry: "2027-03-01", mrpPaise: 4500 })
        expect(parseMedicine(json)).toEqual({ batch: "B12", expiry: "2027-03-01", mrpPaise: 4500 })
    })
    it("flags expired and soon-to-expire stock", () => {
        const now = new Date("2026-09-04T00:00:00Z")
        expect(expiryState("2026-01-01", now)).toBe("expired")
        expect(expiryState("2026-10-01", now)).toBe("soon")
        expect(expiryState("2028-01-01", now)).toBe("ok")
    })
    it("hides expired from the public shop line", () => {
        const now = new Date("2026-09-04T00:00:00Z")
        const gone = writeMedicine(null, { batch: "X", expiry: "2026-01-20", mrpPaise: 100 })
        const ok = writeMedicine(null, { batch: "Y", expiry: "2027-08-01", mrpPaise: 100 })
        expect(isExpiredMedicine(gone, now)).toBe(true)
        expect(isExpiredMedicine(ok, now)).toBe(false)
        expect(medicineLine(ok, now)).toBe("Batch Y")
        expect(medicineLine(gone, now)).toBe("Expired 2026-01-20")
    })
})
