// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    CATALOG_BRAND_MIN_CHARS,
    catalogShopBrandNameClassName,
    catalogShopHoursDesktopChipClassName,
    catalogShopHoursUnderBrandClassName,
    truncateCatalogBrandName,
} from "@/lib/catalog-header-identity"

describe("truncateCatalogBrandName", () => {
    it("keeps short names intact", () => {
        expect(truncateCatalogBrandName("MK Jewellers", 40)).toBe("MK Jewellers")
        expect(truncateCatalogBrandName("  Firayalal Nxt  ", 20)).toBe("Firayalal Nxt")
    })

    it("never collapses long brands to a 2-letter stem like Ra…", () => {
        const out = truncateCatalogBrandName("Raghuvanshi Stores", 4)
        expect(out.startsWith("Ra…")).toBe(false)
        expect(out.replace(/…$/, "").length).toBeGreaterThanOrEqual(CATALOG_BRAND_MIN_CHARS)
        expect(out).toMatch(/^Raghuvan/)
    })

    it("honours a larger budget when provided", () => {
        expect(truncateCatalogBrandName("Raghuvanshi Stores", 12)).toBe("Raghuvanshi…")
    })

    it("prefers a word boundary near the cut when possible", () => {
        expect(truncateCatalogBrandName("Raghuvanshi Stores Grocery", 18)).toBe("Raghuvanshi Stores…")
        expect(truncateCatalogBrandName("Raghuvanshi Stores Grocery", 14)).toBe("Raghuvanshi…")
    })

    it("returns empty for blank input", () => {
        expect(truncateCatalogBrandName("   ", 10)).toBe("")
    })
})

describe("shop non-compact identity class contract", () => {
    it("allows 1–2 line brand names on mobile and truncates from sm up", () => {
        expect(catalogShopBrandNameClassName).toMatch(/line-clamp-2/)
        expect(catalogShopBrandNameClassName).toMatch(/sm:truncate/)
    })

    it("stacks hours under the brand on mobile and keeps the desktop chip from competing below sm", () => {
        expect(catalogShopHoursUnderBrandClassName).toMatch(/sm:hidden/)
        expect(catalogShopHoursDesktopChipClassName).toMatch(/hidden/)
        expect(catalogShopHoursDesktopChipClassName).toMatch(/sm:inline/)
    })
})

describe("CatalogHeader wiring (source)", () => {
    const src = readFileSync(
        join(process.cwd(), "src/components/shop/catalog-header.tsx"),
        "utf8",
    )

    it("uses identity helpers for non-compact shop brand + hours placement", () => {
        expect(src).toContain("catalogShopBrandNameClassName")
        expect(src).toContain("catalogShopHoursUnderBrandClassName")
        expect(src).toContain("catalogShopHoursDesktopChipClassName")
        expect(src).toContain("basis-[7rem]")
        expect(src).toContain("min-h-14")
    })

    it("preserves compact LiveOrder vs non-compact GuestShopOrders split from P1-1", () => {
        expect(src).toContain("compact ? <LiveOrderHeaderButton slug={slug} /> : <GuestShopOrdersButton slug={slug} />")
    })

    it("keeps theme/share/chat/WhatsApp controls in a non-shrinking cluster", () => {
        expect(src).toContain('className="flex shrink-0 items-center gap-2"')
        expect(src).toContain("aria-label=\"WhatsApp\"")
        expect(src).toContain("Share ${name}")
        expect(src).toContain("Chat with ${name}")
        expect(src).toContain("themeToggle ? <ModeToggle />")
    })
})
