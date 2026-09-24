import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    FIELD_GUEST_MENU_EMPTY_TITLE_PARTS,
    FIELD_GUEST_MENU_EMPTY_TITLE_SERVICES,
    FIELD_GUEST_MENU_LABEL_PARTS,
    fieldGuestMenuEmptyCopy,
    fieldGuestMenuLabel,
    isFieldServiceMenuRole,
    shouldUseFieldGuestMenuEmpty,
} from "@/lib/fieldjobs/guest-menu"
import { catalogLabel } from "@/lib/menu"
import { shouldUseEventsGuestMenuEmpty } from "@/lib/events/guest-menu"
import { shouldUseRealestateGuestMenuEmpty } from "@/lib/realestate/guest-menu"
import { shouldUseCreatorGuestMenuEmpty } from "@/lib/creator/guest-menu"
import {
    GOODWILL_PLUMBING,
    JHARKHAND_FIELD_CREW,
    VICKY_ELECTRICAL,
    COOLING_WORLD,
    BHOLA_GARAGE,
} from "@/lib/demo-shops/field"

const root = process.cwd()

describe("FIELD P1-2 shouldUseFieldGuestMenuEmpty", () => {
    it("is true for FIELD_SERVICE / PLUMBER / ELECTRICIAN / AC_REPAIR / GARAGE appointment kits (+ fixtures)", () => {
        expect(shouldUseFieldGuestMenuEmpty("FIELD_SERVICE", "TAKE_APPOINTMENTS")).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty("PLUMBER", "TAKE_APPOINTMENTS")).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty("ELECTRICIAN", "TAKE_APPOINTMENTS")).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty("AC_REPAIR", "TAKE_APPOINTMENTS")).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty("GARAGE", "TAKE_APPOINTMENTS")).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty("FIELD_SERVICE", "BOOK_CALL")).toBe(true)
        expect(isFieldServiceMenuRole("PLUMBER")).toBe(true)
        expect(isFieldServiceMenuRole("ELECTRICIAN")).toBe(true)
        expect(isFieldServiceMenuRole("AC_REPAIR")).toBe(true)
        expect(isFieldServiceMenuRole("GARAGE")).toBe(true)
        expect(isFieldServiceMenuRole(GOODWILL_PLUMBING.flavor)).toBe(true)
        expect(isFieldServiceMenuRole(JHARKHAND_FIELD_CREW.flavor)).toBe(true)
        expect(isFieldServiceMenuRole(VICKY_ELECTRICAL.flavor)).toBe(true)
        expect(isFieldServiceMenuRole(COOLING_WORLD.flavor)).toBe(true)
        expect(isFieldServiceMenuRole(BHOLA_GARAGE.flavor)).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty(GOODWILL_PLUMBING.flavor, GOODWILL_PLUMBING.goal)).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty(JHARKHAND_FIELD_CREW.flavor, JHARKHAND_FIELD_CREW.goal)).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty(VICKY_ELECTRICAL.flavor, VICKY_ELECTRICAL.goal)).toBe(true)
        // Stocked kits still match role gate; shop page keeps ShopCatalog when products.length > 0
        expect(shouldUseFieldGuestMenuEmpty(COOLING_WORLD.flavor, COOLING_WORLD.goal)).toBe(true)
        expect(shouldUseFieldGuestMenuEmpty(BHOLA_GARAGE.flavor, BHOLA_GARAGE.goal)).toBe(true)
        expect((COOLING_WORLD.products || []).length).toBeGreaterThan(0)
        expect((BHOLA_GARAGE.products || []).length).toBeGreaterThan(0)
        expect(GOODWILL_PLUMBING.products || []).toEqual([])
        expect(JHARKHAND_FIELD_CREW.products || []).toEqual([])
        expect(VICKY_ELECTRICAL.products || []).toEqual([])
    })

    it("is false for SHOP / food / bakery / events / realestate / creator / SELL_PRODUCTS field", () => {
        expect(shouldUseFieldGuestMenuEmpty("SHOP")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("RESTAURANT")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("CAFE")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("BAKERY")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("CREATOR", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("FIELD_SERVICE", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("PLUMBER", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("FIELD_SERVICE", "TAKE_APPOINTMENTS")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("FIELD_SERVICE", "TAKE_APPOINTMENTS")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("FIELD_SERVICE", "TAKE_APPOINTMENTS")).toBe(false)
    })
})

describe("FIELD P1-2 guest menu labels + empty copy (Goodwill / empty kits)", () => {
    it("Parts / No parts listed; Book a visit CTA; never Shop or products; no clinic/events bleed", () => {
        expect(fieldGuestMenuLabel("FIELD_SERVICE")).toBe(FIELD_GUEST_MENU_LABEL_PARTS)
        expect(fieldGuestMenuLabel(GOODWILL_PLUMBING.flavor)).toBe(FIELD_GUEST_MENU_LABEL_PARTS)
        expect(fieldGuestMenuLabel("PLUMBER")).not.toBe("Shop")
        expect(catalogLabel("SHOP")).toBe("Shop")
        expect(catalogLabel("FIELD_SERVICE")).toBe("Shop")
        expect(catalogLabel("AUTO_PARTS")).toBe("Parts")

        const goodwill = fieldGuestMenuEmptyCopy({
            displayName: GOODWILL_PLUMBING.name,
            role: GOODWILL_PLUMBING.flavor,
            primaryGoal: GOODWILL_PLUMBING.goal,
        })
        expect(goodwill.title).toBe(FIELD_GUEST_MENU_EMPTY_TITLE_PARTS)
        expect(goodwill.title).toMatch(/No parts listed/i)
        expect(FIELD_GUEST_MENU_EMPTY_TITLE_SERVICES).toMatch(/Services are on Book a visit/i)
        expect(goodwill.bookLabel).toMatch(/Book a visit/i)
        expect(JSON.stringify(goodwill).toLowerCase()).not.toMatch(/products?/)
        expect(JSON.stringify(goodwill)).not.toMatch(/\bSHOP\b/)
        expect(JSON.stringify(goodwill)).not.toMatch(/No products published/)
        expect(JSON.stringify(goodwill).toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b|\bsession/)
        expect(goodwill.detail.toLowerCase()).toMatch(/book a visit|site visit|service/)

        const jharkhand = fieldGuestMenuEmptyCopy({
            displayName: JHARKHAND_FIELD_CREW.name,
            role: JHARKHAND_FIELD_CREW.flavor,
            primaryGoal: JHARKHAND_FIELD_CREW.goal,
        })
        expect(jharkhand.title).toBe(FIELD_GUEST_MENU_EMPTY_TITLE_PARTS)
        expect(JSON.stringify(jharkhand)).not.toMatch(/No products published/)
    })
})

describe("FIELD P1-2 shop/menu wiring", () => {
    it("shop page uses shouldUseFieldGuestMenuEmpty + FieldGuestMenu before ShopCatalog", () => {
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/shouldUseFieldGuestMenuEmpty/)
        expect(shopPage).toMatch(/FieldGuestMenu/)
        expect(shopPage).toMatch(/shouldUseRealestateGuestMenuEmpty/)
        expect(shopPage).toMatch(/RealestateGuestMenu/)
        expect(shopPage).toMatch(/shouldUseEventsGuestMenuEmpty/)
        expect(shopPage).toMatch(/EventsGuestMenu/)
        expect(shopPage).toMatch(/shouldUseCreatorGuestMenuEmpty/)
        expect(shopPage).toMatch(/CreatorGuestMenu/)
        expect(shopPage).toMatch(/ShopCatalog/)
        const fieldIdx = shopPage.indexOf("shouldUseFieldGuestMenuEmpty(profile.roleTemplate")
        const reIdx = shopPage.indexOf("shouldUseRealestateGuestMenuEmpty(profile.roleTemplate")
        const eventsIdx = shopPage.indexOf("shouldUseEventsGuestMenuEmpty(profile.roleTemplate")
        const creatorIdx = shopPage.indexOf("shouldUseCreatorGuestMenuEmpty(profile.roleTemplate")
        const shopCatalogIdx = shopPage.indexOf("<ShopCatalog")
        expect(fieldIdx).toBeGreaterThan(0)
        expect(reIdx).toBeGreaterThan(fieldIdx)
        expect(eventsIdx).toBeGreaterThan(reIdx)
        expect(creatorIdx).toBeGreaterThan(eventsIdx)
        expect(shopCatalogIdx).toBeGreaterThan(creatorIdx)
        // Stocked field kits fall through when products exist
        expect(shopPage).toMatch(/digitalProducts\.length === 0/)

        const menuPage = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menuPage).toMatch(/ShopPage/)

        const surface = readFileSync(join(root, "src/components/field/field-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/data-field-guest-menu/)
        expect(surface).toMatch(/FIELD_GUEST_MENU_LABEL_PARTS|fieldGuestMenuLabel/)
        expect(surface).toMatch(/\/\$\{slug\}\/book/)
        expect(surface).not.toMatch(/\bSHOP\b/)
        expect(surface.toLowerCase()).not.toMatch(/no products published/)
        expect(surface).not.toMatch(/ShopCatalog/)

        const guestLib = readFileSync(join(root, "src/lib/fieldjobs/guest-menu.ts"), "utf8")
        expect(guestLib).toMatch(/FIELD_GUEST_MENU_EMPTY_TITLE_PARTS/)
        expect(guestLib).toMatch(/FIELD_GUEST_MENU_EMPTY_TITLE_SERVICES/)
        expect(guestLib).toMatch(/shouldUseFieldGuestMenuEmpty/)
        expect(guestLib).not.toMatch(/No products published/)

        const index = readFileSync(join(root, "src/lib/fieldjobs/index.ts"), "utf8")
        expect(index).toMatch(/shouldUseFieldGuestMenuEmpty/)
        expect(index).toMatch(/FIELD_GUEST_MENU_LABEL_PARTS/)
    })

    it("food/cafe/shop still use Shop/Menu chrome path (no field guest empty)", () => {
        expect(shouldUseFieldGuestMenuEmpty("CAFE", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("RESTAURANT", "TAKE_ORDERS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("BAKERY")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogLabel("RESTAURANT")).toBe("Menu")
        expect(catalogLabel("SHOP")).toBe("Shop")
    })
})
