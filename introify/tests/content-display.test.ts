import { describe, expect, it } from "vitest"
import { parseContentDisplayMode } from "@/lib/content-display"

/**
 * Owner-chosen guest content chrome.
 *
 * Schema comment is `"SIDE_PANEL" | "POPUP"`. Anything else — empty, the old "chat" fixture,
 * a typo — must resolve to POPUP so an unknown value never invents a third layout.
 */
describe("parseContentDisplayMode", () => {
    it("keeps SIDE_PANEL", () => {
        expect(parseContentDisplayMode("SIDE_PANEL")).toBe("SIDE_PANEL")
    })

    it("keeps POPUP", () => {
        expect(parseContentDisplayMode("POPUP")).toBe("POPUP")
    })

    it("treats missing, empty, and unknown values as POPUP", () => {
        expect(parseContentDisplayMode(undefined)).toBe("POPUP")
        expect(parseContentDisplayMode(null)).toBe("POPUP")
        expect(parseContentDisplayMode("")).toBe("POPUP")
        expect(parseContentDisplayMode("chat")).toBe("POPUP")
        expect(parseContentDisplayMode("sidebar")).toBe("POPUP")
    })
})
