import { describe, expect, it } from "vitest"
import { chooseActiveProfile } from "@/lib/workspace-access"

const t = (iso: string) => new Date(iso)

describe("chooseActiveProfile", () => {
    const neal = { id: "neal", slug: "neal", updatedAt: t("2026-01-02T00:00:00Z") }
    const hotel = { id: "hotel", slug: "try-hotel", updatedAt: t("2026-01-03T00:00:00Z") }

    it("keeps an explicitly selected owned try-* kit without TRY_NOW", () => {
        expect(chooseActiveProfile([neal, hotel], "hotel", false)?.slug).toBe("try-hotel")
    })

    it("keeps an explicitly selected non-try business", () => {
        expect(chooseActiveProfile([neal, hotel], "neal", false)?.slug).toBe("neal")
    })

    it("auto-picks non-try when no cookie and not trying so guest kits do not steal dashboard", () => {
        expect(chooseActiveProfile([neal, hotel], undefined, false)?.slug).toBe("neal")
    })

    it("auto-picks newest including try when TRY_NOW / trying is set", () => {
        expect(chooseActiveProfile([neal, hotel], undefined, true)?.slug).toBe("try-hotel")
    })

    it("falls back to a try kit only when it is the only accessible profile", () => {
        expect(chooseActiveProfile([hotel], undefined, false)?.slug).toBe("try-hotel")
    })
})