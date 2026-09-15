import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"

vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/auth-sync", () => ({
    syncUser: vi.fn(async () => ({ activeProfile: { id: "p1", slug: "neal", displayName: "Nilesh Kumar" } })),
}))
vi.mock("@/lib/workspace-market", () => ({
    exploreCreations: vi.fn(async () => []),
}))

describe("workspace explore craft", () => {
    it("offers outcome examples as chips, not a dumped sentence", async () => {
        const { default: ExplorePage } = await import("@/app/workspace/explore/page")
        const html = renderToString(await ExplorePage({ searchParams: Promise.resolve({}) }))
        expect(html).toMatch(/Animate my logo/)
        expect(html).toMatch(/q=Animate/)
        expect(html).not.toMatch(/Animate my logo\. Analyze restaurant inventory\. Review a GitHub PR/)
        expect(html).toMatch(/No matching skills yet/)
    })
})
