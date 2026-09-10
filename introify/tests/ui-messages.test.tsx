import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { HomeLanding } from "@/components/landing/home-landing"
import { SHIPPED_UI_LOCALES } from "@/lib/ui-locale"
import { UI_MESSAGES } from "@/lib/ui-messages"

function keysOf(value: unknown, prefix = ""): string[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => keysOf(item, `${prefix}[${index}]`))
    }
    if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
            keysOf(nested, prefix ? `${prefix}.${key}` : key),
        )
    }
    return [prefix]
}

describe("UI message catalogs", () => {
    it("keeps English and Hindi catalogs aligned", () => {
        const english = keysOf(UI_MESSAGES.en)
        for (const locale of SHIPPED_UI_LOCALES) {
            expect(keysOf(UI_MESSAGES[locale]), locale).toEqual(english)
        }
        expect(UI_MESSAGES.hi.home.hero.cta).toMatch(/परिचय/)
        expect(UI_MESSAGES.hi.chrome.nav.pricing).toBe("कीमत")
    })

    it("renders the Hindi homepage from the catalog, not leftover English chrome", () => {
        render(<HomeLanding locale="hi" />)
        expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/व्यापार/)
        expect(screen.getAllByRole("link", { name: "Introify होम" }).every(link => link.getAttribute("href") === "/hi")).toBe(true)
        expect(screen.getAllByRole("link", { name: "प्रॉडक्ट" }).every(link => link.getAttribute("href") === "/hi#product")).toBe(true)
        expect(screen.getByLabelText("भाषा")).toBeTruthy()
        expect(screen.queryByRole("heading", { level: 1, name: /Big things/ })).toBeNull()
        expect(screen.getByRole("main").id).toBe("main-content")
    })
})
