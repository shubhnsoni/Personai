import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"

vi.mock("next/navigation", () => ({
    usePathname: () => "/workspace",
}))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

describe("workspace shell later-phase access", () => {
    it("keeps the primary four and adds a More link to later tools", async () => {
        const { WorkspaceShell } = await import("@/app/workspace/components/workspace-shell")
        const html = renderToString(
            <WorkspaceShell name="Nilesh Kumar" slug="neal">
                <p>body</p>
            </WorkspaceShell>,
        )
        expect(html).toMatch(/My AIs/)
        expect(html).toMatch(/Create/)
        expect(html).toMatch(/Jobs/)
        expect(html).toMatch(/Profile/)
        expect(html).toMatch(/href="\/workspace\/more"/)
        expect(html).not.toMatch(/Phase 1/)
    })
})
