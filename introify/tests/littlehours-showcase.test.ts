import { describe, expect, it } from "vitest"
import { resolveKitRole } from "@/lib/role-alias"
import { isRestaurant } from "@/lib/menu"
import { surfacesFor, shopNavLabel } from "@/lib/surfaces"
import {
    LITTLEHOURS_SLUG,
    littleHoursExpectedFlavor,
    planLittleHoursAlign,
    isLittleHoursSlug,
} from "@/lib/showcase-profiles"
import { TRY_KITS } from "@/lib/try-kits"

describe("littlehours café showcase (P1-6)", () => {
    it("seeds CAFE · BOOK_TABLE so resolveKitRole still hits the RESTAURANT engine", () => {
        const expected = littleHoursExpectedFlavor()
        expect(expected.roleTemplate).toBe("CAFE")
        expect(expected.primaryGoal).toBe("BOOK_TABLE")
        expect(resolveKitRole(expected.roleTemplate)).toBe("RESTAURANT")
        expect(isRestaurant(expected.roleTemplate)).toBe(true)
        expect(surfacesFor("CAFE")).toEqual(surfacesFor("RESTAURANT"))
        expect(shopNavLabel("CAFE")).toBe("Menu")
    })

    it("matches the try-cafe kit flavor/goal (not WHATSAPP)", () => {
        const cafeKit = TRY_KITS.find((kit) => kit.slug === "try-cafe")
        expect(cafeKit?.role).toBe("CAFE")
        expect(cafeKit?.goal).toBe("BOOK_TABLE")
        expect(littleHoursExpectedFlavor().primaryGoal).not.toBe("WHATSAPP")
    })

    it("plans heal for legacy RESTAURANT·WHATSAPP payload", () => {
        const plan = planLittleHoursAlign({
            slug: LITTLEHOURS_SLUG,
            profile: {
                id: "p1",
                roleTemplate: "RESTAURANT",
                primaryGoal: "WHATSAPP",
                isPublic: true,
            },
        })
        expect(plan.action).toBe("heal-role-goal")
        expect(plan.expectedRole).toBe("CAFE")
        expect(plan.expectedGoal).toBe("BOOK_TABLE")
    })

    it("is ok when already CAFE · BOOK_TABLE", () => {
        expect(
            planLittleHoursAlign({
                slug: LITTLEHOURS_SLUG,
                profile: {
                    id: "p2",
                    roleTemplate: "CAFE",
                    primaryGoal: "BOOK_TABLE",
                    isPublic: true,
                },
            }).action,
        ).toBe("ok")
    })

    it("no-ops unrelated slugs and skips foreign engines without inventing credentials", () => {
        expect(
            planLittleHoursAlign({
                slug: "formandfield",
                profile: null,
            }).action,
        ).toBe("noop-unrelated")
        expect(isLittleHoursSlug("skydine-cafe")).toBe(false)
        expect(isLittleHoursSlug("littlehours")).toBe(true)

        expect(
            planLittleHoursAlign({
                slug: LITTLEHOURS_SLUG,
                profile: null,
            }).action,
        ).toBe("noop-missing")

        expect(
            planLittleHoursAlign({
                slug: LITTLEHOURS_SLUG,
                profile: {
                    id: "p3",
                    roleTemplate: "CONSULTANT",
                    primaryGoal: "BOOK_CALL",
                    isPublic: true,
                },
            }).action,
        ).toBe("skip-foreign-role")
    })

    it("heals CAFE · WHATSAPP drift and RESTAURANT · BOOK_TABLE alias mismatch", () => {
        expect(
            planLittleHoursAlign({
                slug: LITTLEHOURS_SLUG,
                profile: {
                    id: "p4",
                    roleTemplate: "CAFE",
                    primaryGoal: "WHATSAPP",
                    isPublic: true,
                },
            }).action,
        ).toBe("heal-role-goal")

        expect(
            planLittleHoursAlign({
                slug: LITTLEHOURS_SLUG,
                profile: {
                    id: "p5",
                    roleTemplate: "RESTAURANT",
                    primaryGoal: "BOOK_TABLE",
                    isPublic: true,
                },
            }).action,
        ).toBe("heal-role-goal")
    })
})
