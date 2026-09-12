import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub)
import type { Profile, WelcomeAnimationPreset } from "@prisma/client"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/app/actions/profile", () => ({
    updateProfile: vi.fn(),
    getProfileAiAccess: vi.fn(async () => ({ modes: ["fast"], autoMemory: false, customInstructions: false, customBranding: false })),
    createWorkExperience: vi.fn(),
    updateWorkExperience: vi.fn(),
    deleteWorkExperience: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
}))
vi.mock("@/app/actions/listing", () => ({ previewListing: vi.fn(), applyListing: vi.fn() }))
vi.mock("@/app/actions/story", () => ({
    listStoryFrames: vi.fn(async () => []),
    addStoryFrame: vi.fn(),
    deleteStoryFrame: vi.fn(),
    moveStoryFrame: vi.fn(),
    setAboutWalkIn: vi.fn(),
    updateStoryFrame: vi.fn(),
}))
vi.mock("@/components/welcome-orb", () => ({ WelcomeOrb: () => <div data-testid="orb" /> }))
vi.mock("@/components/profile/qr-card", () => ({ QrCard: () => <div>QR</div> }))
vi.mock("@/components/dashboard/bloub-customizer-sheet", () => ({ BloubCustomizerSheet: () => null }))
vi.mock("@/components/ui/switch", () => ({ Switch: () => <button type="button">toggle</button> }))

import { ProfileEditor } from "@/components/dashboard/profile-editor"

function profile(roleTemplate = "SHOP"): Profile & { workExperiences: []; projects: [] } {
    return {
        id: "profile-1",
        slug: "studio",
        displayName: "North Studio",
        headline: "A calm studio for founders",
        bio: "",
        roleTemplate,
        primaryGoal: "SELL_PRODUCTS",
        language: "English",
        timezone: "Asia/Kolkata",
        animationStyleId: "orb-1",
        isPublic: true,
        linkStyle: "PATH",
        welcomeMessageOverride: "",
        contentDisplayMode: "POPUP",
        personalityConfig: "{}",
        aiModel: "fast",
        imageUrl: "",
        shopLogoUrl: "",
        chatAvatarMode: "ORB",
        autoMemoryEnabled: false,
        liveChatEnabled: false,
        liveChatSlaMinutes: 10,
        whatsapp: "",
        upiId: "",
        gstin: "",
        deliveryNote: "",
        workExperiences: [],
        projects: [],
    } as unknown as Profile & { workExperiences: []; projects: [] }
}

const presets = [{ id: "orb-1", name: "Cyan", config: JSON.stringify({ colors: ["#00D7FF", "#07104D"] }) }] as unknown as WelcomeAnimationPreset[]

describe("profile editor tabs", () => {
    it("keeps section labels visible and folds secondary fields", async () => {
        await act(async () => { render(<ProfileEditor profile={profile()} presets={presets} />) })
        const tabs = screen.getByRole("tablist", { name: "Profile sections" })
        const rail = tabs.parentElement
        expect(rail?.className).toMatch(/\bshrink-0\b/)
        expect(rail?.className).not.toMatch(/\bsticky\b/)
        expect(rail?.className).not.toMatch(/\bpt-1\b/)
        expect(rail?.className).not.toMatch(/\bpt-2\b/)
        expect(tabs.className).toMatch(/\brounded-none\b/)
        expect(tabs.textContent).toMatch(/General/)
        expect(tabs.textContent).toMatch(/About/)
        expect(tabs.textContent).toMatch(/Look/)
        expect(tabs.textContent).toMatch(/AI/)
        expect(tabs.textContent).toMatch(/Page/)
        expect(screen.queryByRole("tab", { name: "Experience" })).toBeNull()
        expect(screen.queryByRole("tab", { name: "Projects" })).toBeNull()
        expect(screen.queryByRole("tab", { name: "Work" })).toBeNull()
        expect(screen.getByLabelText("Name")).toBeTruthy()
        const socials = screen.getByText(/Social links/).closest("details")
        expect(socials?.open).toBeFalsy()
        fireEvent.click(screen.getByText(/Social links/))
        expect(socials?.open).toBe(true)
        expect(screen.getByLabelText("Instagram")).toBeTruthy()
    })

    it("puts experience and projects on one Work tab for portfolio kits", async () => {
        await act(async () => { render(<ProfileEditor profile={profile("DESIGNER")} presets={presets} defaultTab="work" />) })
        expect(screen.getByRole("tab", { name: "Work" })).toBeTruthy()
        expect(screen.queryByRole("tab", { name: "Experience" })).toBeNull()
        expect(screen.getByText("Add roles the assistant can talk about.")).toBeTruthy()
        expect(screen.getByText("Add work the assistant can walk through.")).toBeTruthy()
    })

    it("lets every kit choose popup vs side panel, not only portfolio kits", async () => {
        await act(async () => { render(<ProfileEditor profile={profile("SHOP")} presets={presets} defaultTab="public" />) })
        expect(await screen.findByText("Content opens as")).toBeTruthy()
        expect(screen.getAllByText("Popup").length).toBeGreaterThan(0)
    })

    it("does not dump every aura preset on Look", async () => {
        await act(async () => { render(<ProfileEditor profile={profile()} presets={presets} defaultTab="appearance" />) })
        expect(await screen.findByText("Welcome aura")).toBeTruthy()
        expect(screen.getByText("Blob")).toBeTruthy()
        expect(screen.getByRole("button", { name: "Customise" })).toBeTruthy()
        expect(screen.queryByText("Cyan")).toBeNull()
        expect(screen.queryByRole("button", { name: "Change look" })).toBeNull()
    })
})
