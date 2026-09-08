import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"

vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("@clerk/nextjs", () => ({
    useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock("next-themes", () => ({
    useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}))

const { DashboardLayoutClient } = await import("@/components/dashboard/dashboard-layout-client")

describe("admin studio banner", () => {
    it("keeps a kits link when a platform admin is inside a try kit", () => {
        const html = renderToString(
            <DashboardLayoutClient slug="try-shop" role="SHOP" isAdmin>
                child
            </DashboardLayoutClient>,
        )
        expect(html).toContain("/admin/kits")
        expect(html).toContain("all kits")
        expect(html).toContain("/admin")
    })
})
