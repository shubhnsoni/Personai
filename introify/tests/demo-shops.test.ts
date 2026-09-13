// @vitest-environment node
import { describe, expect, it } from "vitest"
import { TRY_KITS } from "@/lib/try-kits"
import { DEMO_SHOPS, demoShopByFlavor, demoShopBySlug, missingTryKitFlavors } from "@/lib/demo-shops"
import { AR_DISHES, SKYDINE_AR_BY_TITLE } from "@/lib/demo-shops/ar"
import { dishThumb, SKYDINE_CAFE } from "@/lib/demo-shops/cafe"

describe("field demo catalogs", () => {
    it("covers every try-kit flavor with a unique slug", () => {
        expect(missingTryKitFlavors()).toEqual([])
        const slugs = DEMO_SHOPS.map((shop) => shop.slug)
        expect(new Set(slugs).size).toBe(slugs.length)
        for (const kit of TRY_KITS) {
            const shop = demoShopByFlavor(kit.role)
            expect(shop?.engine).toBeTruthy()
            expect(shop?.documents.length).toBeGreaterThanOrEqual(2)
            expect(shop?.bio.length).toBeGreaterThan(80)
            expect(shop?.customInstructions.length).toBeGreaterThan(40)
            expect(shop?.hours).toHaveLength(7)
        }
    })

    it("gives every SkyDine dish a menu photo that matches the plate", () => {
        expect(dishThumb("Soup", "Cream Of Tomato")).toMatch(/soup-veg/)
        expect(dishThumb("Soup", "Chicken Manchow Soup")).toMatch(/soup-chicken/)
        expect(dishThumb("Pizza", "Margherita Pizza")).toMatch(/pizza/)
        expect(SKYDINE_CAFE.products?.every((p) => Boolean(p.thumbnailUrl))).toBe(true)
        expect(SKYDINE_CAFE.products?.some((p) => p.thumbnailUrl?.includes("blu-cafe"))).toBe(false)
        expect(SKYDINE_CAFE.products?.some((p) => p.thumbnailUrl?.includes("plates.jpg"))).toBe(false)
    })

    it("builds SkyDine around the Hinoo menu and AR plates", () => {
        expect(SKYDINE_CAFE.slug).toBe("skydine-cafe")
        expect(SKYDINE_CAFE.products?.length).toBeGreaterThan(80)
        const arTitles = Object.keys(SKYDINE_AR_BY_TITLE)
        for (const title of arTitles) {
            expect(SKYDINE_CAFE.products?.some((p) => p.title === title && p.arKey === SKYDINE_AR_BY_TITLE[title])).toBe(true)
            expect(AR_DISHES[SKYDINE_AR_BY_TITLE[title]]).toBeTruthy()
        }
        expect(SKYDINE_CAFE.venue.address?.postalCode).toBe("834002")
        expect(SKYDINE_CAFE.whatsapp).toBe("919262268837")
    })

    it("does not use rushed catalogue language", () => {
        const blob = JSON.stringify(DEMO_SHOPS)
        expect(blob).not.toMatch(/lorem|placeholder|fictional|todo|tbd/i)
    })

    it("includes Aura Fitness Ranchi and Fit24 as extra gym pages", () => {
        const aura = demoShopBySlug("aura-fitness-ranchi")
        const fit = demoShopBySlug("fit24-ranchi")
        expect(aura?.flavor).toBe("GYM")
        expect(aura?.name).toBe("Aura Fitness Ranchi")
        expect(aura?.venue.address?.line1).toMatch(/Maru Tower/)
        expect(aura?.whatsapp).toBe("917766005931")
        expect(aura?.shopLogoUrl).toMatch(/aura-fitness-ranchi/)
        expect(aura?.hours[1]?.startTime).toBe("06:00")
        expect(aura?.products?.some((p) => p.title.includes("Whey") && p.thumbnailUrl?.includes("whey"))).toBe(true)
        expect(fit?.flavor).toBe("GYM")
        expect(fit?.name).toBe("Fit24")
        expect(fit?.shopLogoUrl).toMatch(/fit24/)
        expect(fit?.services?.some((s) => /night/i.test(s.name))).toBe(true)
    })

    it("publishes Nilesh Kumar from the LinkedIn vanity /in/neal at /neal", () => {
        const shop = demoShopBySlug("neal")
        expect(shop?.name).toBe("Nilesh Kumar")
        expect(shop?.headline).toMatch(/Ex-Razorpay/)
        expect(shop?.venue.address?.locality).toBe("Bengaluru")
        expect(shop?.whatsapp).toBeUndefined()
        expect(shop?.documents.some((doc) => doc.rawText.includes("linkedin.com/in/neal"))).toBe(true)
        expect(shop?.customInstructions).toMatch(/Never invent a phone number/)
        expect(shop?.experiences?.some((row) => row.company === "Deel" && /Operation Lead/.test(row.role))).toBe(true)
        expect(shop?.experiences?.some((row) => row.company === "Razorpay")).toBe(true)
        expect(shop?.experiences?.some((row) => row.company === "upGrad Jeet")).toBe(true)
    })

    it("includes Churuwala's Upper Bazar with the 1949 counter details", () => {
        const shop = demoShopBySlug("churuwala-upper-bazar")
        expect(shop?.name).toBe("Churuwala's")
        expect(shop?.venue.address?.line1).toMatch(/Upper Bazar/)
        expect(shop?.gstin).toBe("20AGJPS6768E1Z7")
        expect(shop?.shopLogoUrl).toMatch(/churuwala/)
        expect(shop?.products?.some((p) => /kachori/i.test(p.title))).toBe(true)
    })
})
