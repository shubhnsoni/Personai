import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { AdminShell } from "@/components/admin/admin-shell"
import { AdminKitsList } from "@/components/admin/admin-kits-list"
import { adminNavItems, isAdminActivePath } from "@/components/admin/admin-nav"

vi.mock("next/navigation", () => ({
    usePathname: () => "/admin",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("@clerk/nextjs", () => ({
    useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock("next-themes", () => ({
    useTheme: () => ({ theme: "dark", setTheme: vi.fn(), resolvedTheme: "dark" }),
}))

vi.mock("@/components/admin/admin-mobile-nav", () => ({
    AdminMobileNav: () => null,
}))

describe("AdminShell", () => {
    afterEach(() => {
        document.body.replaceChildren()
    })

    it("shows grouped platform nav, Kits, Studio, and Sign out", () => {
        const html = renderToString(<AdminShell email="ops@example.com">body</AdminShell>)
        expect(html).toContain("Kits")
        expect(html).toContain('href="/admin/kits"')
        expect(html).not.toContain('href="/qa"')
        expect(html).not.toContain("Growth")
        expect(html).toContain("Platform")
        expect(html).toContain("Observe")
        expect(html).toContain("Tenants")
        expect(html).toContain("Sign out")
        expect(html).toContain('aria-label="Sign out"')
        expect(html).toContain("Studio")
        expect(html).not.toContain('href="/dashboard/inbox"')
        expect(html).not.toContain('href="/dashboard/products"')
    })
})

describe("admin nav active paths", () => {
    const shops = adminNavItems.find((item) => item.href === "/admin/shops")!
    const today = adminNavItems.find((item) => item.href === "/admin")!

    it("does not treat shop detail as Today", () => {
        expect(isAdminActivePath("/admin", today)).toBe(true)
        expect(isAdminActivePath("/admin/shops", today)).toBe(false)
        expect(isAdminActivePath("/admin/shops/abc", shops)).toBe(true)
    })
})

describe("AdminKitsList", () => {
    it("lists try kits without requiring an existing shop", () => {
        const html = renderToString(<AdminKitsList owned={[]} activeId={null} />)
        expect(html).toContain("Jewellery store")
        expect(html).toContain("Restaurant")
        expect(html).toContain("Studio")
        expect(html).toContain("Onboarding")
        expect(html).toContain("/qa/onboard?role=JEWELRY_RETAIL")
    })
})
