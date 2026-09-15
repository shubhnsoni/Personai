import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

vi.mock("next/navigation", () => ({
    usePathname: () => "/workspace",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/components/navigation/transition-link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@clerk/nextjs", () => ({
    useClerk: () => ({ signOut: vi.fn() }),
}))
vi.mock("next-themes", () => ({
    useTheme: () => ({ theme: "dark", setTheme: vi.fn(), resolvedTheme: "dark" }),
}))

describe("workspace shell matches Studio", () => {
    it("uses a left Studio-style rail with Logo, cyan active, and dashboard + public links", async () => {
        const { WorkspaceShell } = await import("@/app/workspace/components/workspace-shell")
        const html = renderToString(
            <WorkspaceShell name="Nilesh Kumar" slug="neal">
                <p>body</p>
            </WorkspaceShell>,
        )
        expect(html).toMatch(/studio-shell/)
        expect(html).toMatch(/Workspace/)
        expect(html).toMatch(/aria-label="Introify home"/)
        expect(html).toMatch(/My AIs/)
        expect(html).toMatch(/Create/)
        expect(html).toMatch(/Jobs/)
        expect(html).toMatch(/Profile/)
        expect(html).toMatch(/Explore/)
        expect(html).toMatch(/Earnings/)
        expect(html).toMatch(/href="\/workspace\/more"/)
        expect(html).toMatch(/href="\/dashboard"/)
        expect(html).toMatch(/>Studio</)
        expect(html).toMatch(/\/neal/)
        expect(html).toMatch(/#00D7FF/)
        expect(html).toMatch(/Open menu/)
        expect(html).not.toMatch(/Phase 1/)
        expect(html).not.toMatch(/w-brand-mark/)
    })

    it("drops rose chrome tokens in favour of Studio cyan", () => {
        const css = readFileSync(resolve("src/app/workspace/globals.css"), "utf8")
        expect(css).not.toMatch(/--w-rausch:\s*#e11d48/)
        expect(css).toMatch(/#00D7FF/)
        expect(css).not.toMatch(/html\s*\{/)
        expect(css).not.toMatch(/\nbody\s*\{/)
        expect(css).not.toMatch(/w-topbar/)
        expect(css).not.toMatch(/w-bottom-nav/)
    })
})

describe("workspace nav active paths", () => {
    it("treats only the home path as My AIs and nests later tools under More", async () => {
        const { isWorkspaceActivePath, workspaceNavItems } = await import("@/app/workspace/components/workspace-nav")
        const home = workspaceNavItems.find((item) => item.href === "/workspace")!
        const more = workspaceNavItems.find((item) => item.href === "/workspace/more")!
        const jobs = workspaceNavItems.find((item) => item.href === "/workspace/jobs")!
        expect(isWorkspaceActivePath("/workspace", home)).toBe(true)
        expect(isWorkspaceActivePath("/workspace/create", home)).toBe(false)
        expect(isWorkspaceActivePath("/workspace/more", more)).toBe(true)
        expect(isWorkspaceActivePath("/workspace/connections", more)).toBe(true)
        expect(isWorkspaceActivePath("/workspace/explore", more)).toBe(false)
        expect(isWorkspaceActivePath("/workspace/result/abc", jobs)).toBe(true)
    })
})

