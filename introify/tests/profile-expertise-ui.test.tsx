import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
    getExpertise: vi.fn(),
    getGaps: vi.fn(),
    resolveGaps: vi.fn(),
    saveFramework: vi.fn(),
    saveIntroduction: vi.fn(),
    setTracking: vi.fn(),
    setVisibility: vi.fn(),
    setMemberAccess: vi.fn(),
    setPurchaseRule: vi.fn(),
}))

vi.mock("@/app/actions/profile-expertise", () => ({
    getProfileExpertise: mocks.getExpertise,
    getKnowledgeGaps: mocks.getGaps,
    resolveKnowledgeGaps: mocks.resolveGaps,
    saveProfileFramework: mocks.saveFramework,
    saveProfileIntroduction: mocks.saveIntroduction,
    setKnowledgeGapTracking: mocks.setTracking,
}))
vi.mock("@/app/actions/knowledge-access", () => ({
    setKnowledgeVisibility: mocks.setVisibility,
    setKnowledgeMemberAccess: mocks.setMemberAccess,
    setKnowledgePurchaseRule: mocks.setPurchaseRule,
}))

import { FrameworkRunner } from "@/components/profile/framework-runner"
import { IntentIntroduction } from "@/components/profile/intent-introduction"
import { ProfileExpertiseStudio } from "@/components/dashboard/profile-expertise-studio"
import type { FrameworkDraft } from "@/lib/profile-import-contract"

const definition: FrameworkDraft = {
    title: "Fit check", description: "Check fit.", sourceIds: ["s1"],
    questions: [
        { id: "q1", label: "Do you ship?", guidance: "" },
        { id: "q2", label: "Do you iterate?", guidance: "Weekly" },
    ],
}

const expertise = {
    frameworks: [{ id: "fw-1", profileId: "prof-1", title: "Fit check", description: "Check fit.", definition, status: "DRAFT", scoringApproved: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    introductions: [{ id: "in-1", profileId: "prof-1", intent: "Hire me", text: "Intro.", status: "DRAFT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    documents: [{ id: "doc-1", title: "Client notes", type: "TEXT", sourceType: "PROFILE_IMPORT", visibility: "CLIENT", publicationState: "PUBLISHED", publishable: true }],
    grants: [],
    rules: [],
    offers: { products: [{ id: "prod-1", title: "Playbook", isActive: true }], services: [{ id: "svc-1", name: "Call", isActive: true }] },
    settings: { knowledgeGapTracking: true, advancedAnalytics: true },
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getExpertise.mockResolvedValue(expertise)
    mocks.getGaps.mockResolvedValue({ since: new Date().toISOString(), truncated: false, groups: [{ question: "Do you travel?", occurrences: 2, signalIds: ["g1", "g2"], lastSeen: new Date().toISOString() }] })
})

describe("FrameworkRunner", () => {
    it("runs a local radio self-assessment with the lead scoring and reset", async () => {
        render(<FrameworkRunner title="Fit check" description="Check fit." definition={definition} />)
        expect(screen.getByText(/Self-assessment, not a validated professional diagnosis/)).toBeTruthy()
        expect(screen.getAllByRole("radio")).toHaveLength(8)

        fireEvent.click(screen.getAllByRole("radio", { name: "Yes" })[0])
        fireEvent.click(screen.getAllByRole("radio", { name: "No" })[1])
        await waitFor(() => expect(screen.getByText(/Local score: 50/)).toBeTruthy())
        fireEvent.click(screen.getByRole("button", { name: "Reset" }))
        await waitFor(() => expect(screen.getByText(/Answer the questions/)).toBeTruthy())
    })
})

describe("IntentIntroduction", () => {
    it("lets a visitor pick an intent explicitly", () => {
        render(<IntentIntroduction entries={[{ id: "i1", intent: "Hire me", text: "I build things." }]} defaultText="Welcome!" />)
        expect(screen.getByText("Welcome!")).toBeTruthy()
        const chip = screen.getByRole("button", { name: "Hire me" })
        expect(chip.getAttribute("aria-pressed")).toBe("false")
        fireEvent.click(chip)
        expect(chip.getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByText("I build things.")).toBeTruthy()
    })
})

describe("ProfileExpertiseStudio", () => {
    it("edits a framework and requires scoring approval before publish", async () => {
        render(<ProfileExpertiseStudio profileId="prof-1" />)
        await waitFor(() => expect(screen.getByLabelText("Framework title")).toBeTruthy())

        const publish = screen.getByRole("button", { name: "Publish framework" }) as HTMLButtonElement
        expect(publish.disabled).toBe(true)
        fireEvent.click(screen.getByText(/I approve the fixed equal-weight scoring/))
        fireEvent.change(screen.getByLabelText("Question 1"), { target: { value: "Edited?" } })
        await waitFor(() => expect(publish.disabled).toBe(false))
        fireEvent.click(publish)
        await waitFor(() => expect(mocks.saveFramework).toHaveBeenCalledWith("prof-1", "fw-1", expect.objectContaining({ publish: true, scoringApproved: true })))
        expect((mocks.saveFramework.mock.calls[0][2].definition as FrameworkDraft).questions[0].label).toBe("Edited?")
    })

    it("grants client access and links a purchase rule", async () => {
        render(<ProfileExpertiseStudio profileId="prof-1" />)
        await waitFor(() => expect(screen.getByLabelText("Client email")).toBeTruthy())
        fireEvent.change(screen.getByLabelText("Client email"), { target: { value: "b@x.co" } })
        fireEvent.click(screen.getByRole("button", { name: "Grant access" }))
        await waitFor(() => expect(mocks.setMemberAccess).toHaveBeenCalledWith("prof-1", "doc-1", { email: "b@x.co", allow: true, expiresAt: null }))
        fireEvent.click(screen.getByRole("button", { name: "Playbook" }))
        await waitFor(() => expect(mocks.setPurchaseRule).toHaveBeenCalledWith("prof-1", "doc-1", { kind: "PRODUCT", itemId: "prod-1", enabled: true }))
    })

    it("shows the gap queue and resolves groups", async () => {
        const onAdd = vi.fn()
        render(<ProfileExpertiseStudio profileId="prof-1" onAddKnowledge={onAdd} />)
        await waitFor(() => expect(screen.getByText("Do you travel?")).toBeTruthy())
        expect(screen.getByText(/Questions with no matching knowledge source/)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Mark answered" }))
        await waitFor(() => expect(mocks.resolveGaps).toHaveBeenCalledWith("prof-1", ["g1", "g2"], "ANSWERED"))
        fireEvent.click(screen.getByRole("button", { name: "Add knowledge draft" }))
        expect(onAdd).toHaveBeenCalledWith("Do you travel?")
    })
})
