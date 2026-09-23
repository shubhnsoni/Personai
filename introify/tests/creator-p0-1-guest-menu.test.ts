import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    CREATOR_GUEST_MENU_EMPTY_TITLE,
    CREATOR_GUEST_MENU_LABEL_PORTFOLIO,
    CREATOR_GUEST_MENU_LABEL_WORK,
    SHOP_GUEST_EMPTY_TITLE,
    SHOP_OWNER_EMPTY_CTA,
    creatorGuestMenuEmptyCopy,
    creatorGuestMenuLabel,
    isCreatorPortfolioMenuRole,
    shopCatalogGuestEmptyCopy,
} from "@/lib/creator/guest-menu"
import { isHotelRole } from "@/lib/hotels"
import { catalogLabel, isRestaurant } from "@/lib/menu"

const root = process.cwd()

describe("CREATOR P0-1 guest /menu helpers", () => {
    it("treats DESIGNER / DEVELOPER / SHOW_PORTFOLIO as portfolio menu kits", () => {
        expect(isCreatorPortfolioMenuRole("DESIGNER")).toBe(true)
        expect(isCreatorPortfolioMenuRole("DEVELOPER")).toBe(true)
        expect(isCreatorPortfolioMenuRole("EDITOR")).toBe(true)
        expect(isCreatorPortfolioMenuRole("INTERIOR")).toBe(true)
        expect(isCreatorPortfolioMenuRole("JOB_SEEKER")).toBe(true)
        expect(isCreatorPortfolioMenuRole("CREATOR", "SHOW_PORTFOLIO")).toBe(true)
        expect(isCreatorPortfolioMenuRole("DESIGNER", "BOOK_CALL")).toBe(true)
        expect(isCreatorPortfolioMenuRole("SHOP")).toBe(false)
        expect(isCreatorPortfolioMenuRole("CREATOR", "COLLECT_LEADS")).toBe(false)
        expect(isCreatorPortfolioMenuRole("CONSULTANT", "TAKE_APPOINTMENTS")).toBe(false)
        expect(isCreatorPortfolioMenuRole("HOTEL")).toBe(false)
        expect(isCreatorPortfolioMenuRole("RESTAURANT")).toBe(false)
    })

    it("labels empty portfolio kits Portfolio/Work, not Shop", () => {
        expect(creatorGuestMenuLabel("DESIGNER")).toBe(CREATOR_GUEST_MENU_LABEL_PORTFOLIO)
        expect(creatorGuestMenuLabel("DEVELOPER")).toBe(CREATOR_GUEST_MENU_LABEL_PORTFOLIO)
        expect(creatorGuestMenuLabel("JOB_SEEKER")).toBe(CREATOR_GUEST_MENU_LABEL_WORK)
        expect(catalogLabel("DESIGNER")).toBe("Shop") // populated path may still use Shop
        expect(catalogLabel("SHOP")).toBe("Shop")
    })

    it("guest empty copy never includes owner Import CTA", () => {
        const maya = creatorGuestMenuEmptyCopy({ displayName: "Maya Lane", role: "DESIGNER", primaryGoal: "BOOK_CALL" })
        expect(maya.title).toBe(CREATOR_GUEST_MENU_EMPTY_TITLE)
        expect(maya.title).toMatch(/No products published yet/i)
        expect(maya.detail).toMatch(/Ask Maya about their work/i)
        expect(maya.chatLabel).toMatch(/Ask Maya/i)
        expect(JSON.stringify(maya)).not.toMatch(/Import a catalog or add a product/)

        const kadru = creatorGuestMenuEmptyCopy({
            displayName: "Kadru Lab",
            role: "DEVELOPER",
            primaryGoal: "SHOW_PORTFOLIO",
        })
        expect(kadru.title).toBe(CREATOR_GUEST_MENU_EMPTY_TITLE)
        expect(JSON.stringify(kadru)).not.toMatch(/Import a catalog/)

        const shopGuest = shopCatalogGuestEmptyCopy("Demo Shop")
        expect(shopGuest.title).toBe(SHOP_GUEST_EMPTY_TITLE)
        expect(JSON.stringify(shopGuest)).not.toMatch(/Import a catalog/)
        expect(SHOP_OWNER_EMPTY_CTA).toBe("Import a catalog or add a product")
    })
})

describe("CREATOR P0-1 menu route wiring", () => {
    it("branches empty portfolio kits to CreatorGuestMenu from ShopPage", () => {
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/isCreatorPortfolioMenuRole/)
        expect(shopPage).toMatch(/CreatorGuestMenu/)
        expect(shopPage).toMatch(/digitalProducts\.length === 0/)
        expect(shopPage).toMatch(/ShopCatalog/)
        expect(shopPage).toMatch(/isRestaurant/)
        expect(shopPage).not.toMatch(/Import a catalog or add a product/)

        const surface = readFileSync(join(root, "src/components/creator/creator-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/data-creator-guest-menu/)
        expect(surface).toMatch(/creatorGuestMenuLabel|Portfolio/)
        expect(surface).toMatch(/Ask .* about their work|chatLabel/)
        expect(surface).toMatch(/max-w-5xl/)
        expect(surface).not.toMatch(/Import a catalog or add a product/)
        expect(surface).not.toMatch(/ShopCatalog/)
        expect(surface).not.toMatch(/\bSHOP\b/)
        // Desktop catalog shell — do not introduce phone-shell-only max-w-lg layouts.
        expect(surface.includes("max-w-lg") && !surface.includes("max-w-5xl")).toBe(false)
    })

    it("public ShopCatalog defaults to guest empty; owner Import CTA remains for ownerOps", () => {
        const shopCatalog = readFileSync(join(root, "src/components/shop/shop-catalog.tsx"), "utf8")
        const guestLib = readFileSync(join(root, "src/lib/creator/guest-menu.ts"), "utf8")
        expect(shopCatalog).toMatch(/ownerOps/)
        expect(shopCatalog).toMatch(/Import a catalog or add a product/)
        expect(shopCatalog).toMatch(/shopCatalogGuestEmptyCopy|data-shop-catalog-empty="guest"/)
        expect(guestLib).toMatch(/SHOP_GUEST_EMPTY_TITLE|No products published yet/)
    })

    it("leaves hotel / restaurant menu wiring intact", () => {
        const menuPage = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menuPage).toMatch(/isHotelRole/)
        expect(menuPage).toMatch(/HotelGuestMenu|HotelMenuPage/)
        expect(menuPage).toMatch(/return ShopPage\(props\)/)
        expect(isHotelRole("HOTEL")).toBe(true)
        expect(isRestaurant("RESTAURANT")).toBe(true)
        expect(isRestaurant("DESIGNER")).toBe(false)
        expect(catalogLabel("RESTAURANT")).toBe("Menu")
    })
})
