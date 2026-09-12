import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BLOUB_THEMES, DEFAULT_BLOUB_PICK, PLANET_THEMES } from "@/lib/bloub/catalog"

vi.mock("@/components/welcome-orb", () => ({
    WelcomeOrb: ({ orbitProfile, profileImageUrl }: { orbitProfile?: boolean; profileImageUrl?: string }) => (
        <div data-testid="bot-preview" data-orbit-profile={String(orbitProfile === true)} data-profile-image={profileImageUrl} />
    ),
}))

import { BloubCustomizerSheet } from "@/components/dashboard/bloub-customizer-sheet"

describe("owner profile orbit controls", () => {
    it("asks for a profile photo before enabling orbit and opens the existing upload action", () => {
        const onChange = vi.fn()
        const setup = vi.fn()
        render(<BloubCustomizerSheet open onClose={vi.fn()} value={DEFAULT_BLOUB_PICK} onChange={onChange} onSetupProfilePhoto={setup} />)
        fireEvent.click(screen.getByRole("switch", { name: "Profile in orbit" }))
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByRole("status").textContent).toContain("Set up your profile photo")
        fireEvent.click(screen.getByRole("button", { name: "Set up profile photo" }))
        expect(setup).toHaveBeenCalledOnce()
    })

    it("allows orbit with a photo and supplies the selected photo to the live preview", () => {
        const onChange = vi.fn()
        const common = { open: true, onClose: vi.fn(), onChange, profileImageUrl: "/uploads/profile.webp" }
        const { rerender } = render(<BloubCustomizerSheet {...common} value={DEFAULT_BLOUB_PICK} />)
        fireEvent.click(screen.getByRole("switch", { name: "Profile in orbit" }))
        expect(onChange).toHaveBeenLastCalledWith({ orbitProfile: true })
        rerender(<BloubCustomizerSheet {...common} value={{ ...DEFAULT_BLOUB_PICK, orbitProfile: true }} />)
        const preview = screen.getAllByTestId("bot-preview")[0]
        expect(preview.dataset.orbitProfile).toBe("true")
        expect(preview.dataset.profileImage).toBe("/uploads/profile.webp")
        fireEvent.click(screen.getByRole("switch", { name: "Profile in orbit" }))
        expect(onChange).toHaveBeenLastCalledWith({ orbitProfile: false })
    })

    it("groups every planet under Azure as Looks in the Look tab and retains saved selections", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={vi.fn()} value={{ ...DEFAULT_BLOUB_PICK, theme: "planet-rose" }} onChange={onChange} />)
        expect(screen.getByRole("button", { name: "Azure" }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.queryByRole("button", { name: "Rose" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Saturn" })).toBeNull()
        fireEvent.click(screen.getByRole("tab", { name: "Mood" }))
        expect(screen.queryByRole("button", { name: "Rose look" })).toBeNull()
        expect(screen.queryByText("Azure moods")).toBeNull()
        fireEvent.click(screen.getByRole("tab", { name: "Look" }))
        expect(screen.getByText("Looks")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Rose look" }).getAttribute("aria-pressed")).toBe("true")
        for (const theme of PLANET_THEMES) {
            const label = BLOUB_THEMES.find((item) => item.id === theme)!.label
            fireEvent.click(screen.getByRole("button", { name: `${label} look` }))
            expect(onChange).toHaveBeenLastCalledWith({ theme })
        }
        expect(PLANET_THEMES).toHaveLength(12)
    })
})
