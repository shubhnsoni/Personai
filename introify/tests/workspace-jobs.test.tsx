import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { jobsEmptyCopy } from "@/lib/creation-jobs"

vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/auth-sync", () => ({
    syncUser: vi.fn(async () => ({ activeProfile: { id: "p1", slug: "neal", displayName: "Nilesh Kumar" } })),
}))
vi.mock("@/lib/creation-jobs", async () => {
    const actual = await vi.importActual<typeof import("@/lib/creation-jobs")>("@/lib/creation-jobs")
    return {
        ...actual,
        listProfileJobRuns: vi.fn(async () => []),
    }
})
vi.mock("@/lib/creations", () => ({
    listCreations: vi.fn(async () => [{ id: "c1", name: "ANI" }]),
}))

describe("workspace jobs empty state", () => {
    it("points at an existing AI instead of asking people to create one", () => {
        expect(jobsEmptyCopy(1).cta).toBe("Open an AI")
        expect(jobsEmptyCopy(1).href).toBe("/workspace")
        expect(jobsEmptyCopy(0).cta).toBe("Create an AI first")
    })

    it("renders that copy when AIs already exist", async () => {
        const { default: JobsPage } = await import("@/app/workspace/jobs/page")
        const html = renderToString(await JobsPage())
        expect(html).toMatch(/Open an AI/)
        expect(html).not.toMatch(/Create an AI first/)
    })
})
