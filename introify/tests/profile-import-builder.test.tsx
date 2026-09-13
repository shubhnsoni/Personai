import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ProfileBlueprint, ProfileImportPreview } from "@/lib/profile-import-contract"

const mocks = vi.hoisted(() => ({ generate: vi.fn(), apply: vi.fn(), getByRequest: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("@/app/actions/profile-import", () => ({
    generateProfileImport: mocks.generate,
    applyProfileImport: mocks.apply,
    getProfileImportByRequest: mocks.getByRequest,
}))

const { ProfileImportBuilder } = await import("@/components/profile/profile-import-builder")

const blueprint: ProfileBlueprint = {
    version: 1,
    profile: { displayName: "Ada", headline: "Engineer & coach", bio: "Builds things.", welcome: "Hi there", sourceIds: ["s1"] },
    needId: "time",
    addons: ["services", "portfolio"],
    socials: [],
    experiences: [{ company: "Acme", role: "Engineer", startDate: "2020", endDate: null, description: "Did work.", sourceIds: ["s1"] }],
    projects: [],
    services: [{ title: "Intro call", description: "A first call.", durationMinutes: 30, price: null, currency: "USD", basis: "suggested", sourceIds: ["s1"] }],
    products: [],
    knowledge: [{ title: "Draft outline", body: "Proposed outline.", visibility: "PRIVATE", basis: "suggested", sourceIds: [] }],
    introductions: [{ intent: "Hire me", text: "Intro.", sourceIds: ["s1"] }],
    frameworks: [{ title: "Checklist", description: "Self-check.", sourceIds: ["s1"], questions: [{ id: "q1", label: "Q1", guidance: "g" }, { id: "q2", label: "Q2", guidance: "g" }] }],
    missingInformation: ["Preferred contact channel"],
}

const preview: ProfileImportPreview = {
    id: "job-1",
    status: "READY",
    draft: blueprint,
    sources: [
        { id: "s1", label: "ada.dev", url: "https://ada.dev/", status: "read", discoveredFrom: null, warning: null },
        { id: "x2", label: "linkedin.com", url: "https://www.linkedin.com/in/ada", status: "blocked", discoveredFrom: null, warning: "Login required." },
        { id: "x3", label: "github.com", url: "https://github.com/ada", status: "candidate", discoveredFrom: "https://ada.dev/", warning: null },
    ],
    warnings: ["LinkedIn was blocked — paste its text next time."],
    appliedProfileId: null,
    slug: null,
}

async function generateDraft(context: Parameters<typeof ProfileImportBuilder>[0]["context"], onUse?: (p: ProfileImportPreview, d: ProfileBlueprint) => void) {
    render(<ProfileImportBuilder context={context} onUse={onUse} />)
    fireEvent.change(screen.getByLabelText("Profile links"), { target: { value: "https://ada.dev\nhttps://www.linkedin.com/in/ada" } })
    fireEvent.change(screen.getByLabelText("Pasted page text"), { target: { value: "full page text" } })
    const button = screen.getByRole("button", { name: /Generate full profile/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText("These are my profiles or I have permission to import them."))
    expect((screen.getByRole("button", { name: /Generate full profile/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: /Generate full profile/ }))
    await waitFor(() => expect(screen.getByLabelText("Headline")).toBeTruthy())
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.generate.mockResolvedValue(preview)
    mocks.apply.mockResolvedValue({ profileId: "prof-1", slug: "ada" })
})

describe("ProfileImportBuilder", () => {
    it("generates from links plus paste, then reviews without applying", async () => {
        const onUse = vi.fn()
        await generateDraft({}, onUse)
        expect(mocks.generate).toHaveBeenCalledTimes(1)
        expect(mocks.generate.mock.calls[0][1]).toMatchObject({ links: ["https://ada.dev", "https://www.linkedin.com/in/ada"], text: "full page text", discover: true })
        expect(mocks.apply).not.toHaveBeenCalled()
        expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada")
        expect((screen.getByLabelText("Bio") as HTMLTextAreaElement).value).toBe("Builds things.")
        expect(screen.getAllByText(/blocked/i).length).toBeGreaterThan(0)
        expect(screen.getByPlaceholderText("Set price")).toBeTruthy()
        expect(screen.getAllByText("Inactive draft").length).toBeGreaterThan(0)
        expect(screen.getByText(/Checklist draft/)).toBeTruthy()
        expect(screen.getByText(/Introduction for/)).toBeTruthy()
        expect(screen.getByText("Preferred contact channel")).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Use this draft" }))
        expect(onUse).toHaveBeenCalledWith(preview, expect.objectContaining({ version: 1 }))
        expect(mocks.apply).not.toHaveBeenCalled()
    })

    it("applies to an existing profile with overwrite off and features on", async () => {
        await generateDraft({ profileId: "prof-1" })
        const apply = screen.getByRole("button", { name: "Apply to my profile" })
        fireEvent.click(apply)
        await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith("prof-1", "job-1", expect.objectContaining({ version: 1 }), { overwriteProfile: false, applyFeatures: true }))
        await waitFor(() => expect(screen.getByText(/Applied to your profile/)).toBeTruthy())
    })

    it("keeps inputs and shows the error when generation fails", async () => {
        mocks.generate.mockRejectedValue(new Error("No readable source material."))
        render(<ProfileImportBuilder context={{}} />)
        fireEvent.change(screen.getByLabelText("Pasted page text"), { target: { value: "kept text" } })
        fireEvent.click(screen.getByText("These are my profiles or I have permission to import them."))
        fireEvent.click(screen.getByRole("button", { name: /Generate full profile/ }))
        await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No readable source"))
        expect((screen.getByLabelText("Pasted page text") as HTMLTextAreaElement).value).toBe("kept text")
    })

    it("recovers via explicit Check saved result and re-keys a changed input", async () => {
        mocks.generate.mockRejectedValueOnce(new Error("network dropped"))
        mocks.generate.mockResolvedValue(preview)
        render(<ProfileImportBuilder context={{}} />)
        fireEvent.change(screen.getByLabelText("Pasted page text"), { target: { value: "text one" } })
        fireEvent.click(screen.getByText("These are my profiles or I have permission to import them."))
        fireEvent.click(screen.getByRole("button", { name: /Generate full profile/ }))
        await waitFor(() => expect(screen.getByText("Check saved result")).toBeTruthy())

        expect(mocks.generate).toHaveBeenCalledTimes(1)
        const firstId = mocks.generate.mock.calls[0][1].requestId
        mocks.getByRequest.mockResolvedValue(preview)
        fireEvent.click(screen.getByText("Check saved result"))
        await waitFor(() => expect(screen.getByLabelText("Headline")).toBeTruthy())
        expect(mocks.generate).toHaveBeenCalledTimes(1)
        expect(mocks.getByRequest).toHaveBeenCalledWith({}, firstId)

        cleanup()
        sessionStorage.clear()
        mocks.generate.mockRejectedValue(new Error("boom"))
        render(<ProfileImportBuilder context={{}} />)
        fireEvent.change(screen.getByLabelText("Pasted page text"), { target: { value: "v1" } })
        fireEvent.click(screen.getByText("These are my profiles or I have permission to import them."))
        fireEvent.click(screen.getByRole("button", { name: /Generate full profile/ }))
        await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2))
        const secondId = mocks.generate.mock.calls[1][1].requestId
        fireEvent.change(screen.getByLabelText("Pasted page text"), { target: { value: "v2" } })
        fireEvent.click(screen.getByRole("button", { name: /Generate full profile/ }))
        await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(3))
        expect(mocks.generate.mock.calls[2][1].requestId).not.toBe(secondId)
    })

    it("re-keys when a discovered candidate joins the next generation", async () => {
        await generateDraft({})
        const firstId = mocks.generate.mock.calls[0][1].requestId
        fireEvent.click(screen.getByText("Add to links"))
        expect((screen.getByLabelText("Profile links") as HTMLTextAreaElement).value).toContain("github.com/ada")

        fireEvent.click(screen.getByRole("button", { name: /Generate full profile/ }))
        await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2))
        expect(mocks.generate.mock.calls[1][1].requestId).not.toBe(firstId)
        expect(mocks.generate.mock.calls[1][1].links).toContain("https://github.com/ada")
    })

    it("lets you edit knowledge bodies and validates the draft before use", async () => {
        const onUse = vi.fn()
        await generateDraft({}, onUse)
        fireEvent.change(screen.getByLabelText("Body"), { target: { value: "edited confidential outline" } })
        fireEvent.click(screen.getByRole("button", { name: "Use this draft" }))
        expect(onUse).toHaveBeenCalledWith(preview, expect.objectContaining({ knowledge: [expect.objectContaining({ body: "edited confidential outline" })] }))
    })

    it("does not double-dispatch while a generation is pending", async () => {
        let resolve: (v: ProfileImportPreview) => void = () => {}
        mocks.generate.mockImplementation(() => new Promise(r => { resolve = r }))
        render(<ProfileImportBuilder context={{}} />)
        fireEvent.change(screen.getByLabelText("Pasted page text"), { target: { value: "text" } })
        fireEvent.click(screen.getByText("These are my profiles or I have permission to import them."))
        const button = screen.getByRole("button", { name: /Generate full profile|Generating/ })
        fireEvent.click(button)
        fireEvent.click(button)
        expect(mocks.generate).toHaveBeenCalledTimes(1)
        resolve(preview)
        await waitFor(() => expect(screen.getByLabelText("Headline")).toBeTruthy())
    })
})
