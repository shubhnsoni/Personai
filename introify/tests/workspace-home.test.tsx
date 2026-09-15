import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"

vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/auth-sync", () => ({
    syncUser: vi.fn(async () => ({ activeProfile: { id: "p1", slug: "neal", displayName: "Nilesh Kumar" } })),
}))
vi.mock("@/lib/creations", () => ({
    listCreations: vi.fn(async () => []),
}))

describe("workspace home", () => {
    it("does not advertise Phase 1 and gives an empty-state action", async () => {
        const { default: WorkspaceHome } = await import("@/app/workspace/page")
        const html = renderToString(await WorkspaceHome())
        expect(html).not.toMatch(/Phase 1/)
        expect(html).toMatch(/Create your first AI/)
        expect(html).toMatch(/workspace\/create/)
        expect(html).toMatch(/Start with a conversation/)
    })
})
