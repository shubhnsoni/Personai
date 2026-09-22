import { describe, expect, it } from "vitest"
import { TRY_KITS } from "@/lib/try-kits"
import { demoShopBySlug, FOOD_SHOPS } from "@/lib/demo-shops"
import {
    isTryFoodShowcaseSlug,
    planTryFoodEnsure,
    TRY_BAKERY,
    TRY_FOOD_SHOWCASE_SLUGS,
    TRY_RESTAURANT,
} from "@/lib/demo-shops/ensure-try-food"

describe("try food showcases", () => {
    it("lists try-restaurant and try-bakery in TRY_KITS", () => {
        const slugs = TRY_KITS.map((kit) => kit.slug)
        expect(slugs).toEqual(expect.arrayContaining(["try-restaurant", "try-bakery"]))
        expect(TRY_FOOD_SHOWCASE_SLUGS).toEqual(["try-restaurant", "try-bakery"])
    })

    it("registers DemoShop clones so demoShopBySlug resolves both kits", () => {
        expect(demoShopBySlug("try-restaurant")?.slug).toBe("try-restaurant")
        expect(demoShopBySlug("try-bakery")?.slug).toBe("try-bakery")
        expect(FOOD_SHOPS.some((shop) => shop.slug === "try-restaurant")).toBe(true)
        expect(FOOD_SHOPS.some((shop) => shop.slug === "try-bakery")).toBe(true)
        expect(TRY_RESTAURANT.flavor).toBe("RESTAURANT")
        expect(TRY_BAKERY.flavor).toBe("BAKERY")
        expect(TRY_RESTAURANT.products?.length).toBeGreaterThan(0)
        expect(TRY_BAKERY.products?.length).toBeGreaterThan(0)
    })

    it("treats only the two food showcase slugs as ensure targets", () => {
        expect(isTryFoodShowcaseSlug("try-restaurant")).toBe(true)
        expect(isTryFoodShowcaseSlug("try-bakery")).toBe(true)
        expect(isTryFoodShowcaseSlug("try-cafe")).toBe(false)
        expect(isTryFoodShowcaseSlug("try-hotel")).toBe(false)
        expect(isTryFoodShowcaseSlug("skydine-cafe")).toBe(false)
        expect(isTryFoodShowcaseSlug(null)).toBe(false)
    })

    it("no-ops for unrelated slugs without inventing credentials", () => {
        const plan = planTryFoodEnsure({
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
        const plan = planTryFoodEnsure({
            slug: "try-restaurant",
            profile: { id: "p1", slug: "try-restaurant", roleTemplate: "RESTAURANT", isPublic: true },
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(plan.action).toBe("return-existing")
        expect(plan.expectedFlavor).toBe("RESTAURANT")
    })

    it("skips foreign roles and workspace / user collisions safely", () => {
        expect(
            planTryFoodEnsure({
                slug: "try-bakery",
                profile: { id: "p2", slug: "try-bakery", roleTemplate: "CONSULTANT", isPublic: true },
                workspaceExists: false,
                userByClerk: null,
                userByEmail: null,
            }).action,
        ).toBe("skip-foreign-role")

        expect(
            planTryFoodEnsure({
                slug: "try-restaurant",
                profile: null,
                workspaceExists: true,
                userByClerk: null,
                userByEmail: null,
            }).action,
        ).toBe("skip-workspace")

        expect(
            planTryFoodEnsure({
                slug: "try-restaurant",
                profile: null,
                workspaceExists: false,
                userByClerk: { id: "u1", email: "other@example.com", clerkId: "mock-clerk-id-try-restaurant" },
                userByEmail: null,
            }).action,
        ).toBe("skip-user-clash")

        expect(
            planTryFoodEnsure({
                slug: "try-bakery",
                profile: null,
                workspaceExists: false,
                userByClerk: null,
                userByEmail: { id: "u2", email: "try-bakery@introify.com", clerkId: "someone-else" },
            }).action,
        ).toBe("skip-user-clash")
    })

    it("plans create with dedicated mock credentials when missing", () => {
        const restaurant = planTryFoodEnsure({
            slug: "try-restaurant",
            profile: null,
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(restaurant.action).toBe("create")
        expect(restaurant.clerkId).toBe("mock-clerk-id-try-restaurant")
        expect(restaurant.email).toBe("try-restaurant@introify.com")

        const bakery = planTryFoodEnsure({
            slug: "try-bakery",
            profile: null,
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(bakery.action).toBe("create")
        expect(bakery.clerkId).toBe("mock-clerk-id-try-bakery")
        expect(bakery.email).toBe("try-bakery@introify.com")
    })

    it("accepts cafe flavor on try-restaurant as matching food engine", () => {
        const plan = planTryFoodEnsure({
            slug: "try-restaurant",
            profile: { id: "p3", slug: "try-restaurant", roleTemplate: "CAFE", isPublic: true },
            workspaceExists: false,
            userByClerk: null,
            userByEmail: null,
        })
        expect(plan.action).toBe("return-existing")
    })
})
