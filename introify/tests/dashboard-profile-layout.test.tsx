import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"

let pathname = "/dashboard"

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("@clerk/nextjs", () => ({
    useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock("next-themes", () => ({
    useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}))

const { DashboardLayoutClient } = await import("@/components/dashboard/dashboard-layout-client")

function mainClass(html: string) {
    const match = html.match(/<main class="([^"]*)"/)
    if (!match) throw new Error("studio main missing")
    return match[1]
}

function renderStudio() {
    return renderToString(
        <DashboardLayoutClient slug="studio" role="SHOP">
            child
        </DashboardLayoutClient>,
    )
}

describe("studio profile scrollport", () => {
    it("keeps top padding on ordinary studio pages", () => {
        pathname = "/dashboard"
        expect(mainClass(renderStudio())).toMatch(/\bpt-4\b/)
    })

    it("makes profile a flush fill pane so the tab rail can sit on the header edge", () => {
        pathname = "/dashboard/profile"
        const cls = mainClass(renderStudio())
        expect(cls).toMatch(/\bp-0\b/)
        expect(cls).toMatch(/\bflex\b/)
        expect(cls).toMatch(/\boverflow-hidden\b/)
        expect(cls).not.toMatch(/\bpt-4\b/)
        expect(cls).not.toMatch(/\bpx-3\b/)
    })
})
