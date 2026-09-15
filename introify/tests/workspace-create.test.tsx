import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), fetch: vi.fn() }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

const { default: CreatePage } = await import("@/app/workspace/create/page")

beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mocks.fetch
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ creation: { id: "c1" } }) })
})

describe("workspace create conversation", () => {
    it("does not use a Phase 1 kicker and lets people skip the examples step", async () => {
        render(<CreatePage />)
        expect(screen.queryByText(/phase 1/i)).toBeNull()
        expect(screen.queryByText(/conversational create/i)).toBeNull()
        expect(screen.getByRole("heading", { name: /teach a new ai/i })).toBeTruthy()

        for (const label of [
            "What should this AI be good at?",
            "What do you normally do that it should understand?",
            "What will someone give it?",
            "What should it produce?",
        ]) {
            fireEvent.change(screen.getByLabelText(label), { target: { value: "enough detail" } })
            fireEvent.click(screen.getByRole("button", { name: /continue/i }))
        }

        expect(screen.getByLabelText(/examples or corrections/i)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /skip/i }))
        expect(screen.getByLabelText(/what should we call it/i)).toBeTruthy()
        fireEvent.change(screen.getByLabelText(/what should we call it/i), { target: { value: "ANI" } })
        fireEvent.click(screen.getByRole("button", { name: /save as private/i }))
        await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1))
        const body = JSON.parse(mocks.fetch.mock.calls[0][1].body as string)
        expect(body.name).toBe("ANI")
        expect(body.instructions).not.toMatch(/Examples/)
        expect(mocks.push).toHaveBeenCalledWith("/workspace/ai/c1")
    })

    it("lets people go back to a previous answer", () => {
        render(<CreatePage />)
        fireEvent.change(screen.getByLabelText("What should this AI be good at?"), { target: { value: "logo motion" } })
        fireEvent.click(screen.getByRole("button", { name: /continue/i }))
        fireEvent.click(screen.getByRole("button", { name: /back/i }))
        expect((screen.getByLabelText("What should this AI be good at?") as HTMLTextAreaElement).value).toBe("logo motion")
    })
})
