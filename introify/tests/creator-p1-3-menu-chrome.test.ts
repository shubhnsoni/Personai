import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    CREATOR_GUEST_MENU_EMPTY_TITLE,
    CREATOR_GUEST_MENU_LABEL_PORTFOLIO,
    CREATOR_GUEST_MENU_LABEL_SERVICES,
    CREATOR_GUEST_MENU_LABEL_WORK,
    creatorGuestMenuEmptyCopy,
    creatorGuestMenuLabel,
    isCreatorPortfolioMenuRole,
    isCreatorProMenuRole,
    shouldUseCreatorGuestMenuEmpty,
} from "@/lib/creator/guest-menu"
import { catalogLabel } from "@/lib/menu"

const root = process.cwd()

describe("CREATOR P1-3 shouldUseCreatorGuestMenuEmpty", () => {
    it("is true for CREATOR / COACH / CONSULTANT and portfolio kits", () => {
        expect(shouldUseCreatorGuestMenuEmpty("CREATOR", "COLLECT_LEADS")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("COACH")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("CONSULTANT")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("DEVELOPER")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("DESIGNER", "BOOK_CALL")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("NGO")).toBe(true) // CREATOR alias
        expect(shouldUseCreatorGuestMenuEmpty("TUTOR")).toBe(true) // COACH alias
        expect(shouldUseCreatorGuestMenuEmpty("CLINIC")).toBe(true) // CONSULTANT alias
        expect(shouldUseCreatorGuestMenuEmpty("JOB_SEEKER")).toBe(true)
        expect(shouldUseCreatorGuestMenuEmpty("CREATOR", "SHOW_PORTFOLIO")).toBe(true)
    })

    it("is false for SHOP / HOTEL / restaurant / pharmacy", () => {
        expect(shouldUseCreatorGuestMenuEmpty("SHOP")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("HOTEL")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("RESTAURANT")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("PHARMACY")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("CAFE")).toBe(false)
        expect(shouldUseCreatorGuestMenuEmpty("KIRANA")).toBe(false)
    })

    it("keeps isCreatorPortfolioMenuRole narrow (P0-1 compat)", () => {
        expect(isCreatorPortfolioMenuRole("CREATOR", "COLLECT_LEADS")).toBe(false)
        expect(isCreatorPortfolioMenuRole("CONSULTANT")).toBe(false)
        expect(isCreatorPortfolioMenuRole("COACH")).toBe(false)
        expect(isCreatorPortfolioMenuRole("DESIGNER")).toBe(true)
        expect(isCreatorProMenuRole("CREATOR")).toBe(true)
        expect(isCreatorProMenuRole("COACH")).toBe(true)
        expect(isCreatorProMenuRole("CONSULTANT")).toBe(true)
        expect(isCreatorProMenuRole("DESIGNER")).toBe(false)
        expect(isCreatorProMenuRole("SHOP")).toBe(false)
    })
})

describe("CREATOR P1-3 guest menu labels", () => {
    it("labels CONSULTANT/COACH Services; DESIGNER Portfolio; JOB_SEEKER Work; never Shop", () => {
        expect(creatorGuestMenuLabel("CONSULTANT")).toBe(CREATOR_GUEST_MENU_LABEL_SERVICES)
        expect(creatorGuestMenuLabel("COACH")).toBe(CREATOR_GUEST_MENU_LABEL_SERVICES)
        expect(creatorGuestMenuLabel("CLINIC")).toBe(CREATOR_GUEST_MENU_LABEL_SERVICES)
        expect(creatorGuestMenuLabel("TUTOR")).toBe(CREATOR_GUEST_MENU_LABEL_SERVICES)
        expect(creatorGuestMenuLabel("DESIGNER")).toBe(CREATOR_GUEST_MENU_LABEL_PORTFOLIO)
        expect(creatorGuestMenuLabel("DEVELOPER")).toBe(CREATOR_GUEST_MENU_LABEL_PORTFOLIO)
        expect(creatorGuestMenuLabel("CREATOR", "COLLECT_LEADS")).toBe(CREATOR_GUEST_MENU_LABEL_PORTFOLIO)
        expect(creatorGuestMenuLabel("JOB_SEEKER")).toBe(CREATOR_GUEST_MENU_LABEL_WORK)
        expect(creatorGuestMenuLabel("CREATOR")).not.toBe("Shop")
        expect(creatorGuestMenuLabel("CONSULTANT")).not.toBe("Shop")
        expect(creatorGuestMenuLabel("COACH")).not.toBe("Shop")
        // Populated path may still use catalogLabel Shop
        expect(catalogLabel("DESIGNER")).toBe("Shop")
        expect(catalogLabel("CONSULTANT")).toBe("Shop")
        expect(catalogLabel("CREATOR")).toBe("Shop")
    })
})

describe("CREATOR P1-3 empty copy", () => {
    it("never includes Import; Services detail for consultant/coach", () => {
        const consultant = creatorGuestMenuEmptyCopy({
            displayName: "Leela Rao",
            role: "CONSULTANT",
            primaryGoal: "TAKE_APPOINTMENTS",
        })
        expect(consultant.title).toBe(CREATOR_GUEST_MENU_EMPTY_TITLE)
        expect(consultant.detail).toMatch(/Ask Leela about services/i)
        expect(consultant.chatLabel).toMatch(/services/i)
        expect(JSON.stringify(consultant)).not.toMatch(/Import a catalog/)

        const coach = creatorGuestMenuEmptyCopy({ displayName: "Ari Coach", role: "COACH" })
        expect(coach.detail).toMatch(/Ask Ari about services/i)
        expect(JSON.stringify(coach)).not.toMatch(/Import a catalog/)

        const designer = creatorGuestMenuEmptyCopy({
            displayName: "Maya Lane",
            role: "DESIGNER",
            primaryGoal: "BOOK_CALL",
        })
        expect(designer.detail).toMatch(/Ask Maya about their work/i)
        expect(JSON.stringify(designer)).not.toMatch(/Import a catalog/)

        const creator = creatorGuestMenuEmptyCopy({
            displayName: "Nova Creator",
            role: "CREATOR",
            primaryGoal: "COLLECT_LEADS",
        })
        expect(creator.detail).toMatch(/Ask Nova about their work/i)
        expect(JSON.stringify(creator)).not.toMatch(/Import a catalog/)
    })
})

describe("CREATOR P1-3 shop page wiring", () => {
    it("uses shouldUseCreatorGuestMenuEmpty + CreatorGuestMenu; ShopCatalog for populated", () => {
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/shouldUseCreatorGuestMenuEmpty/)
        expect(shopPage).toMatch(/CreatorGuestMenu/)
        expect(shopPage).toMatch(/digitalProducts\.length === 0/)
        expect(shopPage).toMatch(/ShopCatalog/)
        expect(shopPage).toMatch(/catalogLabel/)
        expect(shopPage).not.toMatch(/Import a catalog or add a product/)

        const surface = readFileSync(join(root, "src/components/creator/creator-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/data-creator-guest-menu/)
        expect(surface).toMatch(/max-w-5xl/)
        expect(surface).toMatch(/creatorGuestMenuLabel|Portfolio|Services/)
        expect(surface).not.toMatch(/Import a catalog or add a product/)
        expect(surface).not.toMatch(/ShopCatalog/)
        expect(surface).not.toMatch(/\bSHOP\b/)

        const guestLib = readFileSync(join(root, "src/lib/creator/guest-menu.ts"), "utf8")
        expect(guestLib).toMatch(/CREATOR_GUEST_MENU_LABEL_SERVICES/)
        expect(guestLib).toMatch(/shouldUseCreatorGuestMenuEmpty/)
        expect(guestLib).toMatch(/isCreatorProMenuRole/)
        expect(guestLib).toMatch(/isCreatorPortfolioMenuRole/)

        const index = readFileSync(join(root, "src/lib/creator/index.ts"), "utf8")
        expect(index).toMatch(/shouldUseCreatorGuestMenuEmpty/)
        expect(index).toMatch(/CREATOR_GUEST_MENU_LABEL_SERVICES/)
        expect(index).toMatch(/isCreatorProMenuRole/)
    })
})
