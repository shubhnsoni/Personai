import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn() }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

const { CreationStudio } = await import("@/app/workspace/ai/[id]/creation-studio")

const creation = {
    id: "c1",
    name: "ANI",
    slug: "ani",
    purpose: "Logo motion",
    description: null,
    instructions: "Stay premium.",
    visibility: "UNLISTED",
    allowVisitorChat: true,
    createdAt: "2026-09-16T00:00:00.000Z",
    profileSlug: "neal",
    knowledge: [],
    jobs: [],
    _count: { runs: 0 },
}

beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mocks.fetch
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
})

describe("creation studio", () => {
    it("lets Unlisted AIs offer visitor chat and a shareable public link", () => {
        render(<CreationStudio creation={creation} />)
        expect(screen.queryByText(/^Creation$/)).toBeNull()
        const chat = screen.getByLabelText(/people with the link may chat/i) as HTMLInputElement
        expect(chat.disabled).toBe(false)
        expect(chat.checked).toBe(true)
        expect(screen.getByRole("link", { name: /open public page/i }).getAttribute("href")).toBe("/neal/ai/ani")
    })

    it("does not treat a successful save as an error", async () => {
        render(<CreationStudio creation={creation} />)
        fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
        await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/saved/i))
        expect(screen.getByRole("status").className).not.toMatch(/w-error/)
    })

    it("runs an offered job by id instead of creating a second unnamed job", async () => {
        mocks.fetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ job: { id: "job-1" } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { id: "run-1" } }) })
        render(<CreationStudio creation={creation} />)
        fireEvent.change(screen.getByPlaceholderText(/3 logo motion directions/i), { target: { value: "3 logo motion directions" } })
        fireEvent.change(screen.getByPlaceholderText(/forest mark/i), { target: { value: "Logo: a forest mark." } })
        fireEvent.change(screen.getByPlaceholderText("499"), { target: { value: "499" } })
        fireEvent.click(screen.getByLabelText(/offer this as a hireable job/i))
        fireEvent.click(screen.getByRole("button", { name: /run job/i }))
        await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
        const runBody = JSON.parse(mocks.fetch.mock.calls[1][1].body as string)
        expect(runBody.jobId).toBe("job-1")
        expect(runBody.prompt).toMatch(/forest mark/)
    })
})
