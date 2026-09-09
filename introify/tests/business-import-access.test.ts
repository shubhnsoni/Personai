// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    role: "SHOP" as string | null, permitted: true, access: vi.fn(), fetch: vi.fn(), enrich: vi.fn(),
    related: vi.fn(), menu: vi.fn(), rupees: vi.fn(), discover: vi.fn(), listingName: vi.fn(),
}))
vi.mock("@/lib/security", () => ({
    requireProfileAccess: mocks.access,
    unwrapOwnershipResult: (result: { ok: boolean; value?: unknown }) => { if (!result.ok) throw new Error("access_refused"); return result.value },
}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/import-llm", () => ({ extractWithModel: mocks.enrich }))
vi.mock("@/app/actions/courses", () => ({ createCourse: vi.fn(), createCourseLesson: vi.fn(), createCourseModule: vi.fn() }))
vi.mock("@/app/actions/products", () => ({ createProduct: vi.fn() }))
vi.mock("@/app/actions/events", () => ({ createEvent: vi.fn() }))
vi.mock("@/app/actions/communities", () => ({ createCommunity: vi.fn() }))
vi.mock("@/app/actions/lead-magnets", () => ({ createLeadMagnet: vi.fn() }))
vi.mock("@/app/actions/content", () => ({ addContent: vi.fn() }))
vi.mock("@/app/actions/services", () => ({ addService: vi.fn() }))
vi.mock("@/lib/import-extract", async original => ({
    ...await original<typeof import("@/lib/import-extract")>(),
    relatedPageUrls: mocks.related,
}))
vi.mock("@/lib/menu-import", async original => ({
    ...await original<typeof import("@/lib/menu-import")>(),
    extractMenuFromHtml: mocks.menu, extractRupeeMenu: mocks.rupees,
    discoverMenuUrls: mocks.discover, googleListingName: mocks.listingName,
}))

import { ingestText, ingestUrl } from "@/app/actions/import"
import { isRestaurantImportUrl, restaurantImportsAllowed, RESTAURANT_IMPORT_MESSAGE } from "@/lib/import-business-access"
import { item } from "@/lib/import-extract"

const productHtml = '<html><title>Ceramic studio</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Ceramic cup","description":"Handmade cup","offers":{"price":"24","priceCurrency":"USD"}}</script></html>'
const page = () => new Response(productHtml, { headers: { "content-type": "text/html" } })

beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = "SHOP"
    mocks.permitted = true
    mocks.access.mockImplementation(async () => ({ ok: mocks.permitted, value: { profile: { id: "owned-business", roleTemplate: mocks.role } } }))
    mocks.fetch.mockImplementation(async () => page())
    mocks.enrich.mockResolvedValue([])
    mocks.related.mockReturnValue([])
    mocks.menu.mockReturnValue([item("product", "Masala chai", 0.9, { price: 40 })])
    mocks.rupees.mockReturnValue([])
    mocks.discover.mockReturnValue([])
    mocks.listingName.mockReturnValue("Ceramic studio")
    vi.stubGlobal("fetch", mocks.fetch)
    vi.spyOn(console, "info").mockImplementation(() => {})
})

describe("restaurant import source access", () => {
    it.each(["RESTAURANT", "CAFE", "CLOUD_KITCHEN", "DHABA"])("recognizes the existing %s restaurant role", role => {
        expect(restaurantImportsAllowed(role)).toBe(true)
    })

    it.each(["SHOP", "PHARMACY", "CONSULTANT", "CUSTOM", "BAKERY", "CATERER", "unknown", null])("does not infer restaurant access for %s", role => {
        expect(restaurantImportsAllowed(role)).toBe(false)
    })

    it.each(["https://www.zomato.com/cafe", "https://link.zomato.com/menu", "https://swiggy.com/city/menu", "https://www.ubereats.com/store/cafe", "https://eats.uber.com/menu", "https://ZOMATO.com./cafe"])("matches vendor host %s", url => {
        expect(isRestaurantImportUrl(url)).toBe(true)
    })

    it.each(["https://zomato.com.example.org/products", "https://example.org/?url=https://swiggy.com", "https://ubereats.com@example.org/products", "https://maps.google.com/business", "invalid"])("does not misclassify %s", url => {
        expect(isRestaurantImportUrl(url)).toBe(false)
    })

    it.each(["SHOP", "PHARMACY", "CUSTOM", null])("rejects a direct server action call for %s before any fetch or AI request", async role => {
        mocks.role = role
        await expect(ingestUrl("restaurant-id-from-client", "https://zomato.com/cafe")).rejects.toThrow(RESTAURANT_IMPORT_MESSAGE)
        expect(mocks.access).toHaveBeenCalledWith({ claimedProfileId: "restaurant-id-from-client" })
        expect(mocks.fetch).not.toHaveBeenCalled()
        expect(mocks.enrich).not.toHaveBeenCalled()
    })

    it("rejects an unauthorized business before reading a source", async () => {
        mocks.role = "RESTAURANT"
        mocks.permitted = false
        await expect(ingestUrl("other-business", "https://swiggy.com/menu")).rejects.toThrow("access_refused")
        expect(mocks.fetch).not.toHaveBeenCalled()
    })

    it("blocks a shortened or ordinary website link redirecting into a restricted vendor", async () => {
        mocks.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://www.ubereats.com/store/cafe" } }))
        await expect(ingestUrl("owned-business", "https://example.org/products")).rejects.toThrow(RESTAURANT_IMPORT_MESSAGE)
        expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("https://example.org/products", expect.objectContaining({ redirect: "manual" }))
        expect(mocks.enrich).not.toHaveBeenCalled()
    })

    it("does not fetch restricted related pages or follow a related-page redirect into them", async () => {
        mocks.related.mockReturnValue(["https://swiggy.com/menu", "https://example.org/menu"])
        mocks.fetch.mockImplementation(async (url: string) => url.endsWith("/menu")
            ? new Response(null, { status: 307, headers: { location: "https://zomato.com/menu" } }) : page())
        const result = await ingestUrl("owned-business", "https://example.org/products")
        expect(result.items.some(row => row.title === "Ceramic cup")).toBe(true)
        expect(mocks.fetch.mock.calls.map(call => call[0])).toEqual(["https://example.org/products", "https://example.org/menu"])
    })

    it("imports an ordinary business Google page without menu extraction or vendor discovery", async () => {
        const result = await ingestUrl("owned-business", "https://maps.google.com/business/ceramics")
        expect(result.items.some(row => row.title === "Ceramic cup")).toBe(true)
        expect(mocks.fetch).toHaveBeenCalledOnce()
        expect(mocks.menu).not.toHaveBeenCalled()
        expect(mocks.discover).not.toHaveBeenCalled()
        expect(mocks.listingName).not.toHaveBeenCalled()
        expect(mocks.enrich).toHaveBeenCalledWith("owned-business", expect.any(String))
    })

    it.each(["RESTAURANT", "CAFE"])("keeps vendor menu extraction for an authorized %s", async role => {
        mocks.role = role
        const result = await ingestUrl("owned-business", "https://www.zomato.com/cafe")
        expect(result.items[0].title).toBe("Masala chai")
        expect(mocks.menu).toHaveBeenCalledOnce()
        expect(mocks.fetch).toHaveBeenCalledOnce()
    })

    it("preserves ordinary website imports through a relative redirect", async () => {
        mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/catalog" } }))
        const result = await ingestUrl("owned-business", "https://example.org/products")
        expect(result.items.some(row => row.title === "Ceramic cup")).toBe(true)
        expect(mocks.fetch.mock.calls.map(call => call[0])).toEqual(["https://example.org/products", "https://example.org/catalog"])
    })

    it("does not classify non-restaurant rupee-priced products as restaurant menu items", async () => {
        await ingestText("owned-business", "Title,Price\nCeramic cup,₹240\nCeramic plate,₹320", "shop")
        expect(mocks.rupees).not.toHaveBeenCalled()
        mocks.role = "CAFE"
        await ingestText("owned-business", "Masala chai ₹40\nCold coffee ₹80", "shop")
        expect(mocks.rupees).toHaveBeenCalledOnce()
    })
})
