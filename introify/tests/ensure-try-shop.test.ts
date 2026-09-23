import { describe, expect, it } from "vitest"
import { TRY_KITS } from "@/lib/try-kits"
import { demoShopBySlug, SHOP_SHOPS } from "@/lib/demo-shops"
import {
    isTryShopShowcaseSlug,
    planTryShopEnsure,
    TRY_SHOP,
    TRY_SHOP_SHOWCASE_SLUGS,
    TRY_STORE,
} from "@/lib/demo-shops/ensure-try-shop"

describe("try shop showcases", () => {
    it("lists try-shop in TRY_KITS and registers try-shop + try-store showcase slugs", () => {
        const slugs = TRY_KITS.map((kit) => kit.slug)
        expect(slugs).toEqual(expect.arrayContaining(["try-shop"]))
        expect(TRY_SHOP_SHOWCASE_SLUGS).toEqual(["try-shop", "try-store"])
        const shopKit = TRY_KITS.find((kit) => kit.slug === "try-shop")
        expect(shopKit?.role).toBe("SHOP")
    })

    it("registers DemoShop clones so demoShopBySlug resolves try-shop and try-store", () => {
        expect(demoShopBySlug("try-shop")?.slug).toBe("try-shop")
        expect(demoShopBySlug("try-store")?.slug).toBe("try-store")
        expect(SHOP_SHOPS.some((shop) => shop.slug === "try-shop")).toBe(true)
        expect(SHOP_SHOPS.some((shop) => shop.slug === "try-store")).toBe(true)
        expect(TRY_SHOP.flavor).toBe("SHOP")
        expect(TRY_STORE.flavor).toBe("KIRANA")
        expect(TRY_SHOP.products?.length).toBeGreaterThan(0)
        expect(TRY_STORE.products?.length).toBeGreaterThan(0)
    })

    it("keeps try-store grocery catalog (staples / dal) without inventing jewellery SKUs", () => {
        const titles = (TRY_STORE.products || []).map((p) => p.title.toLowerCase())
        const categories = (TRY_STORE.products || []).map((p) => (p.category || "").toLowerCase())
        expect(titles.some((t) => t.includes("atta") || t.includes("dal"))).toBe(true)
        expect(categories).toEqual(expect.arrayContaining(["dal", "staples"]))
        expect(titles.some((t) => t.includes("gold") || t.includes("saree"))).toBe(false)
    })

    it("treats only try-shop and try-store as ensure targets", () => {
        expect(isTryShopShowcaseSlug("try-shop")).toBe(true)
        expect(isTryShopShowcaseSlug("try-store")).toBe(true)
        expect(isTryShopShowcaseSlug("try-grocery")).toBe(false)
        expect(isTryShopShowcaseSlug("try-boutique")).toBe(false)
        expect(isTryShopShowcaseSlug("try-restaurant")).toBe(false)
        expect(isTryShopShowcaseSlug("raghuvanshi-stores")).toBe(false)
        expect(isTryShopShowcaseSlug("armonia-lalpur")).toBe(false)
        expect(isTryShopShowcaseSlug(null)).toBe(false)
    })

    it("no-ops for unrelated slugs without inventing credentials", () => {
        const plan = planTryShopEnsure({
            slug: "try-cafe",
            profile: null,
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(plan.action).toBe("noop-unrelated")
        expect(plan.clerkId).toBeNull()
        expect(plan.email).toBeNull()
    })

    it("returns existing matching-role profiles without create", () => {
        const shop = planTryShopEnsure({
            slug: "try-shop",
            profile: { id: "p1", slug: "try-shop", roleTemplate: "SHOP", isPublic: true },
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(shop.action).toBe("return-existing")
        expect(shop.expectedFlavor).toBe("SHOP")

        const store = planTryShopEnsure({
            slug: "try-store",
            profile: { id: "p2", slug: "try-store", roleTemplate: "KIRANA", isPublic: true },
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(store.action).toBe("return-existing")
        expect(store.expectedFlavor).toBe("KIRANA")
    })

    it("skips foreign roles and workspace / user collisions safely", () => {
        expect(
            planTryShopEnsure({
                slug: "try-shop",
                profile: { id: "p3", slug: "try-shop", roleTemplate: "CONSULTANT", isPublic: true },
                workspaceExists: false,
                userByClerk: null,
                userByEmail: null,
            }).action,
        ).toBe("skip-foreign-role")

        expect(
            planTryShopEnsure({
                slug: "try-store",
                profile: { id: "p4", slug: "try-store", roleTemplate: "RESTAURANT", isPublic: true },
                workspaceExists: false,
                userByClerk: null,
                userByEmail: null,
            }).action,
        ).toBe("skip-foreign-role")

        expect(
            planTryShopEnsure({
                slug: "try-shop",
                profile: null,
                workspaceExists: true,
                userByClerk: null,
                userByEmail: null,
            }).action,
        ).toBe("skip-workspace")

        expect(
            planTryShopEnsure({
                slug: "try-shop",
                profile: null,
                workspaceExists: false,
                userByClerk: { id: "u1", email: "other@example.com", clerkId: "mock-clerk-id-try-shop" },
                userByEmail: null,
            }).action,
        ).toBe("skip-user-clash")

        expect(
            planTryShopEnsure({
                slug: "try-store",
                profile: null,
                workspaceExists: false,
                userByClerk: null,
                userByEmail: { id: "u2", email: "try-store@introify.com", clerkId: "someone-else" },
            }).action,
        ).toBe("skip-user-clash")
    })

    it("plans create with dedicated mock credentials when missing", () => {
        const shop = planTryShopEnsure({
            slug: "try-shop",
            profile: null,
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(shop.action).toBe("create")
        expect(shop.clerkId).toBe("mock-clerk-id-try-shop")
        expect(shop.email).toBe("try-shop@introify.com")
        expect(shop.expectedFlavor).toBe("SHOP")

        const store = planTryShopEnsure({
            slug: "try-store",
            profile: null,
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(store.action).toBe("create")
        expect(store.clerkId).toBe("mock-clerk-id-try-store")
        expect(store.email).toBe("try-store@introify.com")
        expect(store.expectedFlavor).toBe("KIRANA")
    })

    it("accepts KIRANA / BOUTIQUE / OPTICS on try-shop as matching SHOP engine", () => {
        for (const role of ["KIRANA", "BOUTIQUE", "OPTICS", "FLORIST", "PRINT_SHOP"] as const) {
            expect(
                planTryShopEnsure({
                    slug: "try-shop",
                    profile: { id: "px", slug: "try-shop", roleTemplate: role, isPublic: true },
                    workspaceExists: false,
                    userByClerk: null,
                    userByEmail: null,
                }).action,
            ).toBe("return-existing")
        }
    })

    it("accepts SHOP engine on try-store (kirana flavor) as matching", () => {
        expect(
            planTryShopEnsure({
                slug: "try-store",
                profile: { id: "p5", slug: "try-store", roleTemplate: "SHOP", isPublic: true },
                workspaceExists: false,
                userByClerk: null,
                userByEmail: null,
            }).action,
        ).toBe("return-existing")
    })
})
