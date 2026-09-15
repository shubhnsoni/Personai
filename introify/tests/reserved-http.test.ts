import { describe, expect, it } from "vitest"
import {
    authAliasDestination,
    deadPublicPath,
    hiMarketingRewrite,
    isProfileCatchAllPath,
    profileSlugFromPath,
} from "@/lib/reserved-http"
import { isReservedSlug } from "@/lib/slugs"

describe("reserved public HTTP paths", () => {
    it("sends Clerk aliases to canonical auth routes", () => {
        expect(authAliasDestination("/signup")).toBe("/sign-up")
        expect(authAliasDestination("/login")).toBe("/sign-in")
        expect(authAliasDestination("/signin")).toBe("/sign-in")
        expect(authAliasDestination("/sign-up")).toBeNull()
    })

    it("marks unfinished marketing words as dead rather than profile slugs", () => {
        for (const path of ["/blog", "/docs", "/help", "/faq", "/features", "/legal"]) {
            expect(deadPublicPath(path)).toBe(true)
            expect(isReservedSlug(path.slice(1))).toBe(true)
        }
        expect(deadPublicPath("/pricing")).toBe(false)
        expect(deadPublicPath("/maya")).toBe(false)
    })

    it("rewrites Hindi marketing URLs onto the real pages", () => {
        expect(hiMarketingRewrite("/hi/pricing")).toBe("/pricing")
        expect(hiMarketingRewrite("/hi/contact")).toBe("/contact")
        expect(hiMarketingRewrite("/hi")).toBeNull()
    })

    it("treats unknown single segments as profile catch-alls", () => {
        expect(isProfileCatchAllPath("/maya")).toBe(true)
        expect(isProfileCatchAllPath("/this-is-not-a-page-xyz")).toBe(true)
        expect(isProfileCatchAllPath("/pricing")).toBe(false)
        expect(isProfileCatchAllPath("/workspace")).toBe(false)
        expect(profileSlugFromPath("/maya")).toBe("maya")
        expect(profileSlugFromPath("/blog")).toBeNull()
    })
})
