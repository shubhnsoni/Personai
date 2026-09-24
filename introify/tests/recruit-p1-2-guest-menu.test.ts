import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    RECRUIT_GUEST_MENU_EMPTY_TITLE_CALLS,
    RECRUIT_GUEST_MENU_EMPTY_TITLE_ROLES,
    RECRUIT_GUEST_MENU_LABEL_ROLES,
    isRecruitmentAgencyMenuRole,
    recruitGuestMenuEmptyCopy,
    recruitGuestMenuLabel,
    shouldUseRecruitGuestMenuEmpty,
} from "@/lib/recruitment/guest-menu"
import { catalogLabel } from "@/lib/menu"
import { shouldUseEventsGuestMenuEmpty } from "@/lib/events/guest-menu"
import { shouldUseRealestateGuestMenuEmpty } from "@/lib/realestate/guest-menu"
import { shouldUseFieldGuestMenuEmpty } from "@/lib/fieldjobs/guest-menu"
import { shouldUseCreatorGuestMenuEmpty } from "@/lib/creator/guest-menu"
import { NITA_RECRUITERS } from "@/lib/demo-shops/studio"

const root = process.cwd()

describe("RECRUIT P1-2 shouldUseRecruitGuestMenuEmpty", () => {
    it("is true for RECRUITMENT_AGENCY COLLECT_LEADS (+ Nita fixture)", () => {
        expect(shouldUseRecruitGuestMenuEmpty("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseRecruitGuestMenuEmpty("RECRUITMENT_AGENCY", "BOOK_CALL")).toBe(true)
        expect(isRecruitmentAgencyMenuRole("RECRUITMENT_AGENCY")).toBe(true)
        expect(isRecruitmentAgencyMenuRole(NITA_RECRUITERS.flavor)).toBe(true)
        expect(shouldUseRecruitGuestMenuEmpty(NITA_RECRUITERS.flavor, NITA_RECRUITERS.goal)).toBe(true)
        expect(NITA_RECRUITERS.products || []).toEqual([])
    })

    it("is false for SHOP / food / bakery / field / events / realestate / creator / SELL_PRODUCTS recruit", () => {
        expect(shouldUseRecruitGuestMenuEmpty("SHOP")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("RESTAURANT")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("CAFE")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("BAKERY")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("FIELD_SERVICE", "TAKE_APPOINTMENTS")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("CREATOR", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("RECRUITMENT_AGENCY", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseFieldGuestMenuEmpty("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseEventsGuestMenuEmpty("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseRealestateGuestMenuEmpty("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(false)
    })
})

describe("RECRUIT P1-2 guest menu labels + empty copy (Nita)", () => {
    it("Roles / No open roles listed; Book a call CTA; never Shop or products; no gym/salon/clinic bleed", () => {
        expect(recruitGuestMenuLabel("RECRUITMENT_AGENCY")).toBe(RECRUIT_GUEST_MENU_LABEL_ROLES)
        expect(recruitGuestMenuLabel(NITA_RECRUITERS.flavor)).toBe(RECRUIT_GUEST_MENU_LABEL_ROLES)
        expect(recruitGuestMenuLabel("RECRUITMENT_AGENCY")).not.toBe("Shop")
        expect(catalogLabel("SHOP")).toBe("Shop")
        expect(catalogLabel("RECRUITMENT_AGENCY")).toBe("Shop")

        const nita = recruitGuestMenuEmptyCopy({
            displayName: NITA_RECRUITERS.name,
            role: NITA_RECRUITERS.flavor,
            primaryGoal: NITA_RECRUITERS.goal,
        })
        expect(nita.title).toBe(RECRUIT_GUEST_MENU_EMPTY_TITLE_ROLES)
        expect(nita.title).toMatch(/No open roles listed/i)
        expect(RECRUIT_GUEST_MENU_EMPTY_TITLE_CALLS).toMatch(/Calls are on Book a call/i)
        expect(nita.bookLabel).toMatch(/Book a call/i)
        expect(JSON.stringify(nita).toLowerCase()).not.toMatch(/products?/)
        expect(JSON.stringify(nita)).not.toMatch(/\bSHOP\b/)
        expect(JSON.stringify(nita)).not.toMatch(/No products published/)
        expect(JSON.stringify(nita).toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b|\bsession/)
        expect(nita.detail.toLowerCase()).toMatch(/book a call|hiring|role/)
    })
})

describe("RECRUIT P1-2 shop/menu wiring", () => {
    it("shop page uses shouldUseRecruitGuestMenuEmpty + RecruitmentGuestMenu before ShopCatalog", () => {
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/shouldUseRecruitGuestMenuEmpty/)
        expect(shopPage).toMatch(/RecruitmentGuestMenu/)
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
        const recruitIdx = shopPage.indexOf("shouldUseRecruitGuestMenuEmpty(profile.roleTemplate")
        const reIdx = shopPage.indexOf("shouldUseRealestateGuestMenuEmpty(profile.roleTemplate")
        const eventsIdx = shopPage.indexOf("shouldUseEventsGuestMenuEmpty(profile.roleTemplate")
        const creatorIdx = shopPage.indexOf("shouldUseCreatorGuestMenuEmpty(profile.roleTemplate")
        const shopCatalogIdx = shopPage.indexOf("<ShopCatalog")
        expect(fieldIdx).toBeGreaterThan(0)
        expect(recruitIdx).toBeGreaterThan(fieldIdx)
        expect(reIdx).toBeGreaterThan(recruitIdx)
        expect(eventsIdx).toBeGreaterThan(reIdx)
        expect(creatorIdx).toBeGreaterThan(eventsIdx)
        expect(shopCatalogIdx).toBeGreaterThan(creatorIdx)
        expect(shopPage).toMatch(/digitalProducts\.length === 0/)

        const menuPage = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menuPage).toMatch(/ShopPage/)

        const surface = readFileSync(join(root, "src/components/recruitment/recruitment-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/data-recruit-guest-menu/)
        expect(surface).toMatch(/RECRUIT_GUEST_MENU_LABEL_ROLES|recruitGuestMenuLabel/)
        expect(surface).toMatch(/\/\$\{slug\}\/book/)
        expect(surface).not.toMatch(/\bSHOP\b/)
        expect(surface.toLowerCase()).not.toMatch(/no products published/)
        expect(surface).not.toMatch(/ShopCatalog/)

        const guestLib = readFileSync(join(root, "src/lib/recruitment/guest-menu.ts"), "utf8")
        expect(guestLib).toMatch(/RECRUIT_GUEST_MENU_EMPTY_TITLE_ROLES/)
        expect(guestLib).toMatch(/RECRUIT_GUEST_MENU_EMPTY_TITLE_CALLS/)
        expect(guestLib).toMatch(/shouldUseRecruitGuestMenuEmpty/)
        expect(guestLib).not.toMatch(/No products published/)

        const index = readFileSync(join(root, "src/lib/recruitment/index.ts"), "utf8")
        expect(index).toMatch(/shouldUseRecruitGuestMenuEmpty/)
        expect(index).toMatch(/RECRUIT_GUEST_MENU_LABEL_ROLES/)
    })

    it("food/cafe/shop still use Shop/Menu chrome path (no recruit guest empty)", () => {
        expect(shouldUseRecruitGuestMenuEmpty("CAFE", "SELL_PRODUCTS")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("RESTAURANT", "TAKE_ORDERS")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("BAKERY")).toBe(false)
        expect(shouldUseRecruitGuestMenuEmpty("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogLabel("RESTAURANT")).toBe("Menu")
        expect(catalogLabel("SHOP")).toBe("Shop")
    })
})