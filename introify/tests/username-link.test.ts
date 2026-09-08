import { describe, expect, it } from "vitest"
import { formatShopLink, publicShopUrl } from "@/lib/public-url"
import { subdomainRoute, tenantFromHost } from "@/lib/subdomain-host"
import { normalizeUsername, suggestedUsername, usernameError } from "@/lib/username"

describe("username", () => {
    it("normalizes display names and blocks reserved words", () => {
        expect(suggestedUsername("Mehta Jewellers")).toBe("mehta-jewellers")
        expect(normalizeUsername("  Ada_Lovelace!! ")).toBe("ada-lovelace")
        expect(usernameError("ab")).toMatch(/3/)
        expect(usernameError("admin")).toMatch(/reserved/)
        expect(usernameError("try-gold")).toMatch(/prefix/)
        expect(usernameError("mehta-jewellers")).toBeNull()
    })
})

describe("public shop links", () => {
    const origin = { protocol: "https:", hostname: "introify.com", port: "" }
    it("builds path and subdomain URLs", () => {
        expect(publicShopUrl("mehta", "PATH", origin)).toBe("https://introify.com/mehta")
        expect(publicShopUrl("mehta", "SUBDOMAIN", origin)).toBe("https://mehta.introify.com")
        expect(formatShopLink("mehta", "PATH", origin)).toBe("introify.com/mehta")
        expect(formatShopLink("mehta", "SUBDOMAIN", origin)).toBe("mehta.introify.com")
    })
})

describe("subdomain routing", () => {
    it("reads a shop tenant off the host", () => {
        expect(tenantFromHost("mehta.introify.com", "introify.com")).toBe("mehta")
        expect(tenantFromHost("mehta.localhost:3000", "localhost")).toBe("mehta")
        expect(tenantFromHost("www.introify.com", "introify.com")).toBeNull()
        expect(tenantFromHost("introify.com", "introify.com")).toBeNull()
    })

    it("rewrites shop pages and leaves api alone", () => {
        expect(subdomainRoute("/", "mehta")).toEqual({ type: "rewrite", pathname: "/mehta" })
        expect(subdomainRoute("/shop/ring", "mehta")).toEqual({ type: "rewrite", pathname: "/mehta/shop/ring" })
        expect(subdomainRoute("/api/chat", "mehta")).toEqual({ type: "skip" })
        expect(subdomainRoute("/mehta/shop", "mehta")).toEqual({ type: "redirect", pathname: "/shop" })
    })
})
