import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { AdminShell } from "@/components/admin/admin-shell"
import { AdminKitsList } from "@/components/admin/admin-kits-list"

vi.mock("@clerk/nextjs", () => ({
    useClerk: () => ({ signOut: vi.fn() }),
}))

describe("AdminShell", () => {
    afterEach(() => {
        document.body.replaceChildren()
    })

    it("shows Kits in the console nav and a visible Sign out control", () => {
        const html = renderToString(<AdminShell email="ops@example.com">body</AdminShell>)
        expect(html).toContain("Kits")
        expect(html).toContain('href="/admin/kits"')
        expect(html).not.toContain('href="/qa"')
        expect(html).toContain("Sign out")
        expect(html).toContain('aria-label="Sign out"')
        expect(html).toContain("Studio")
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
