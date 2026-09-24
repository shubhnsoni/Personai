import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    REALESTATE_GUEST_MENU_EMPTY_TITLE_LISTINGS,
    REALESTATE_GUEST_MENU_EMPTY_TITLE_PROPERTIES,
    REALESTATE_GUEST_MENU_LABEL_LISTINGS,
    isRealestateBrokerageMenuRole,
    realestateGuestMenuEmptyCopy,
    realestateGuestMenuLabel,
    shouldUseRealestateGuestMenuEmpty,
} from "@/lib/realestate/guest-menu"
import { catalogLabel } from "@/lib/menu"
import { shouldUseEventsGuestMenuEmpty } from "@/lib/events/guest-menu"
import { shouldUseCreatorGuestMenuEmpty } from "@/lib/creator/guest-menu"
import { SHAKTI_PROPERTY } from "@/lib/demo-shops/studio"

const root = process.cwd()

describe("REALESTATE P1-3 shouldUseRealestateGuestMenuEmpty", () => {
    it("is true for REAL_ESTATE_BROKERAGE COLLECT_LEADS (+ Shakti fixture)", () => {
        expect(shouldUseRealestateGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseRealestateGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "BOOK_CALL")).toBe(true)
        expect(isRealestateBrokerageMenuRole("REAL_ESTATE_BROKERAGE")).toBe(true)
        expect(isRealestateBrokerageMenuRole(SHAKTI_PROPERTY.flavor)).toBe(true)
        expect(shouldUseRealestateGuestMenuEmpty(SHAKTI_PROPERTY.flavor, SHAKTI_PROPERTY.goal)).toBe(true)
    })

    it("is false for SHOP / food / bakery / events / creator / SELL_PRODUCTS realtor", () => {
        expect(shouldUseRealestateGuestMenuEmpty("SHOP")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("RESTAURANT")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("CAFE")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("BAKERY")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("CREATOR", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(false)
    })
})

describe("REALESTATE P1-3 guest menu labels + empty copy (Shakti)", () => {
    it("Listings / no listings; never Shop or products; no gym/salon/clinic/hotel bleed", () => {
        expect(realestateGuestMenuLabel("REAL_ESTATE_BROKERAGE")).toBe(REALESTATE_GUEST_MENU_LABEL_LISTINGS)
        expect(realestateGuestMenuLabel(SHAKTI_PROPERTY.flavor)).toBe(REALESTATE_GUEST_MENU_LABEL_LISTINGS)
        expect(realestateGuestMenuLabel("REAL_ESTATE_BROKERAGE")).not.toBe("Shop")
        expect(catalogLabel("SHOP")).toBe("Shop")
        expect(catalogLabel("REAL_ESTATE_BROKERAGE")).toBe("Shop")

        const shakti = realestateGuestMenuEmptyCopy({
            displayName: SHAKTI_PROPERTY.name,
            role: SHAKTI_PROPERTY.flavor,
            primaryGoal: SHAKTI_PROPERTY.goal,
        })
        expect(shakti.title).toBe(REALESTATE_GUEST_MENU_EMPTY_TITLE_LISTINGS)
        expect(shakti.title).toMatch(/No listings published/i)
        expect(REALESTATE_GUEST_MENU_EMPTY_TITLE_PROPERTIES).toMatch(/Properties coming soon/i)
        expect(JSON.stringify(shakti).toLowerCase()).not.toMatch(/products?/)
        expect(JSON.stringify(shakti)).not.toMatch(/\bSHOP\b/)
        expect(JSON.stringify(shakti)).not.toMatch(/No products published/)
        expect(JSON.stringify(shakti).toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b|\bsession/)
        expect(shakti.detail.toLowerCase()).toMatch(/listing|propert|viewing|flat|plot/)
        expect(shakti.chatLabel.toLowerCase()).toMatch(/propert/)
    })
})

describe("REALESTATE P1-3 shop/menu wiring", () => {
    it("shop page uses shouldUseRealestateGuestMenuEmpty + RealestateGuestMenu before ShopCatalog", () => {
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/shouldUseRealestateGuestMenuEmpty/)
        expect(shopPage).toMatch(/RealestateGuestMenu/)
        expect(shopPage).toMatch(/shouldUseEventsGuestMenuEmpty/)
        expect(shopPage).toMatch(/EventsGuestMenu/)
        expect(shopPage).toMatch(/shouldUseCreatorGuestMenuEmpty/)
        expect(shopPage).toMatch(/CreatorGuestMenu/)
        expect(shopPage).toMatch(/ShopCatalog/)
        const reIdx = shopPage.indexOf("shouldUseRealestateGuestMenuEmpty(profile.roleTemplate")
        const eventsIdx = shopPage.indexOf("shouldUseEventsGuestMenuEmpty(profile.roleTemplate")
        const creatorIdx = shopPage.indexOf("shouldUseCreatorGuestMenuEmpty(profile.roleTemplate")
        const shopCatalogIdx = shopPage.indexOf("<ShopCatalog")
        expect(reIdx).toBeGreaterThan(0)
        expect(eventsIdx).toBeGreaterThan(reIdx)
        expect(creatorIdx).toBeGreaterThan(eventsIdx)
        expect(shopCatalogIdx).toBeGreaterThan(creatorIdx)

        const menuPage = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menuPage).toMatch(/ShopPage/)

        const surface = readFileSync(join(root, "src/components/realestate/realestate-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/data-realestate-guest-menu/)
        expect(surface).toMatch(/REALESTATE_GUEST_MENU_LABEL_LISTINGS|realestateGuestMenuLabel/)
        expect(surface).not.toMatch(/\bSHOP\b/)
        expect(surface.toLowerCase()).not.toMatch(/no products published/)
        expect(surface).not.toMatch(/ShopCatalog/)

        const guestLib = readFileSync(join(root, "src/lib/realestate/guest-menu.ts"), "utf8")
        expect(guestLib).toMatch(/REALESTATE_GUEST_MENU_EMPTY_TITLE_LISTINGS/)
        expect(guestLib).toMatch(/shouldUseRealestateGuestMenuEmpty/)
        expect(guestLib).not.toMatch(/No products published/)

        const index = readFileSync(join(root, "src/lib/realestate/index.ts"), "utf8")
        expect(index).toMatch(/shouldUseRealestateGuestMenuEmpty/)
        expect(index).toMatch(/REALESTATE_GUEST_MENU_LABEL_LISTINGS/)
    })

    it("food/cafe/shop still use Shop/Menu chrome path (no realestate guest empty)", () => {
        expect(shouldUseRealestateGuestMenuEmpty("CAFE", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("RESTAURANT", "TAKE_ORDERS")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("BAKERY")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogLabel("RESTAURANT")).toBe("Menu")
        expect(catalogLabel("SHOP")).toBe("Shop")
    })
})