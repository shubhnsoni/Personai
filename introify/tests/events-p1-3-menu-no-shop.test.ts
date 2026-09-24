import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    EVENTS_GUEST_MENU_EMPTY_TITLE_PACKAGES,
    EVENTS_GUEST_MENU_EMPTY_TITLE_PORTFOLIO,
    EVENTS_GUEST_MENU_LABEL_PACKAGES,
    EVENTS_GUEST_MENU_LABEL_PORTFOLIO,
    eventsGuestMenuEmptyCopy,
    eventsGuestMenuLabel,
    isEventsStudioMenuRole,
    shouldUseEventsGuestMenuEmpty,
} from "@/lib/events/guest-menu"
import { catalogLabel } from "@/lib/menu"
import { shouldUseCreatorGuestMenuEmpty } from "@/lib/creator/guest-menu"
import { NEXT_LEVEL_EVENTS, LETS_CLICK } from "@/lib/demo-shops/studio"

const root = process.cwd()

describe("EVENTS P1-3 shouldUseEventsGuestMenuEmpty", () => {
    it("is true for EVENTS_STUDIO / PHOTOGRAPHER COLLECT_LEADS (+ aliases)", () => {
        expect(shouldUseEventsGuestMenuEmpty("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseEventsGuestMenuEmpty("PHOTOGRAPHER", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseEventsGuestMenuEmpty("CATERER", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseEventsGuestMenuEmpty("TRAVEL", "BOOK_CALL")).toBe(true)
        expect(isEventsStudioMenuRole("PHOTOGRAPHER")).toBe(true)
        expect(isEventsStudioMenuRole(NEXT_LEVEL_EVENTS.flavor)).toBe(true)
        expect(isEventsStudioMenuRole(LETS_CLICK.flavor)).toBe(true)
        expect(shouldUseEventsGuestMenuEmpty(NEXT_LEVEL_EVENTS.flavor, NEXT_LEVEL_EVENTS.goal)).toBe(true)
        expect(shouldUseEventsGuestMenuEmpty(LETS_CLICK.flavor, LETS_CLICK.goal)).toBe(true)
    })

    it("is false for SHOP / food / creator / pharmacy / SELL_PRODUCTS events", () => {
        expect(shouldUseEventsGuestMenuEmpty("SHOP")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("RESTAURANT")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("CAFE")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("CREATOR", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("PHARMACY")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("EVENTS_STUDIO", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("CREATOR", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(false)
    })
})

describe("EVENTS P1-3 guest menu labels + empty copy (NLE + LC)", () => {
    it("NLE Packages / no packages; LC Portfolio coming soon; never Shop or products", () => {
        expect(eventsGuestMenuLabel("EVENTS_STUDIO")).toBe(EVENTS_GUEST_MENU_LABEL_PACKAGES)
        expect(eventsGuestMenuLabel(NEXT_LEVEL_EVENTS.flavor)).toBe(EVENTS_GUEST_MENU_LABEL_PACKAGES)
        expect(eventsGuestMenuLabel("PHOTOGRAPHER")).toBe(EVENTS_GUEST_MENU_LABEL_PORTFOLIO)
        expect(eventsGuestMenuLabel(LETS_CLICK.flavor)).toBe(EVENTS_GUEST_MENU_LABEL_PORTFOLIO)
        expect(eventsGuestMenuLabel("EVENTS_STUDIO")).not.toBe("Shop")
        expect(eventsGuestMenuLabel("PHOTOGRAPHER")).not.toBe("Shop")
        expect(catalogLabel("SHOP")).toBe("Shop")
        expect(catalogLabel("EVENTS_STUDIO")).toBe("Shop")

        const nle = eventsGuestMenuEmptyCopy({
            displayName: NEXT_LEVEL_EVENTS.name,
            role: NEXT_LEVEL_EVENTS.flavor,
            primaryGoal: NEXT_LEVEL_EVENTS.goal,
        })
        expect(nle.title).toBe(EVENTS_GUEST_MENU_EMPTY_TITLE_PACKAGES)
        expect(nle.title).toMatch(/No packages published/i)
        expect(JSON.stringify(nle).toLowerCase()).not.toMatch(/products?/)
        expect(JSON.stringify(nle)).not.toMatch(/\bSHOP\b/)
        expect(JSON.stringify(nle)).not.toMatch(/No products published/)

        const lc = eventsGuestMenuEmptyCopy({
            displayName: LETS_CLICK.name,
            role: LETS_CLICK.flavor,
            primaryGoal: LETS_CLICK.goal,
        })
        expect(lc.title).toBe(EVENTS_GUEST_MENU_EMPTY_TITLE_PORTFOLIO)
        expect(lc.title).toMatch(/Portfolio coming soon/i)
        expect(JSON.stringify(lc).toLowerCase()).not.toMatch(/products?/)
        expect(JSON.stringify(lc)).not.toMatch(/\bSHOP\b/)
        expect(JSON.stringify(lc)).not.toMatch(/No products published/)
    })
})

describe("EVENTS P1-3 shop/menu wiring", () => {
    it("shop page uses shouldUseEventsGuestMenuEmpty + EventsGuestMenu before ShopCatalog", () => {
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/shouldUseEventsGuestMenuEmpty/)
        expect(shopPage).toMatch(/EventsGuestMenu/)
        expect(shopPage).toMatch(/shouldUseCreatorGuestMenuEmpty/)
        expect(shopPage).toMatch(/CreatorGuestMenu/)
        expect(shopPage).toMatch(/ShopCatalog/)
        const eventsIdx = shopPage.indexOf("shouldUseEventsGuestMenuEmpty")
        const creatorIdx = shopPage.indexOf("shouldUseCreatorGuestMenuEmpty(profile.roleTemplate")
        const shopCatalogIdx = shopPage.indexOf("<ShopCatalog")
        expect(eventsIdx).toBeGreaterThan(0)
        expect(creatorIdx).toBeGreaterThan(eventsIdx)
        expect(shopCatalogIdx).toBeGreaterThan(creatorIdx)

        const menuPage = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menuPage).toMatch(/ShopPage/)

        const surface = readFileSync(join(root, "src/components/events/events-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/data-events-guest-menu/)
        expect(surface).toMatch(/EVENTS_GUEST_MENU_LABEL_PACKAGES|EVENTS_GUEST_MENU_LABEL_PORTFOLIO|eventsGuestMenuLabel/)
        expect(surface).not.toMatch(/\bSHOP\b/)
        expect(surface.toLowerCase()).not.toMatch(/no products published/)
        expect(surface).not.toMatch(/ShopCatalog/)

        const guestLib = readFileSync(join(root, "src/lib/events/guest-menu.ts"), "utf8")
        expect(guestLib).toMatch(/EVENTS_GUEST_MENU_EMPTY_TITLE_PACKAGES/)
        expect(guestLib).toMatch(/EVENTS_GUEST_MENU_EMPTY_TITLE_PORTFOLIO/)
        expect(guestLib).toMatch(/shouldUseEventsGuestMenuEmpty/)
        expect(guestLib).not.toMatch(/No products published/)

        const index = readFileSync(join(root, "src/lib/events/index.ts"), "utf8")
        expect(index).toMatch(/shouldUseEventsGuestMenuEmpty/)
        expect(index).toMatch(/EVENTS_GUEST_MENU_LABEL_PACKAGES/)
    })

    it("food/cafe still use Menu chrome path (no events guest empty)", () => {
        expect(shouldUseEventsGuestMenuEmpty("CAFE", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("RESTAURANT", "TAKE_ORDERS")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("BAKERY")).toBe(false)
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogLabel("RESTAURANT")).toBe("Menu")
        expect(catalogLabel("SHOP")).toBe("Shop")
    })
})


