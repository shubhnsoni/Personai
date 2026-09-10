import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_BLOUB_PICK } from "@/lib/bloub/catalog"

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/welcome-orb", () => ({ WelcomeOrb: ({ theme }: { theme?: string }) => <div data-testid="orb" data-theme={theme} /> }))

const { BlobLookStudio } = await import("@/components/onboarding/blob-look")
const { BloubCustomizerSheet } = await import("@/components/dashboard/bloub-customizer-sheet")

describe("included bots on onboarding and profile", () => {
    it("lets anyone pick Circle or Pebble during onboarding and names other bots as premium", () => {
        const onChange = vi.fn()
        render(
            <BlobLookStudio
                name="North Studio"
                value={DEFAULT_BLOUB_PICK}
                onChange={onChange}
                phase="edit"
                onContinue={() => {}}
                onSave={() => {}}
                onModify={() => {}}
                busy={false}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: "Pebble" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ shape: "galet" }))
        fireEvent.click(screen.getByRole("button", { name: "Cloud, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ shape: "nuage" }))
    })

    it("does not pin Customise bot to a full-width bottom drawer on desktop", () => {
        render(
            <BloubCustomizerSheet
                open
                onClose={() => {}}
                value={DEFAULT_BLOUB_PICK}
                onChange={() => {}}
                premium={false}
            />,
        )
        const shell = document.querySelector("[data-sheet-shell]")
        expect(shell).toBeTruthy()
        expect(shell?.className, "phone still docks to the bottom").toMatch(/\bitems-end\b/)
        expect(shell?.className, "desktop must centre, not stick to the bottom").toMatch(/\bmd:items-center\b/)
        const sheet = document.querySelector('[data-slot="sheet-content"]')
        expect(sheet?.className).not.toMatch(/\bsm:max-w-none\b/)
        expect(sheet?.className).not.toMatch(/\binset-x-0\b/)
        expect(screen.getByText("Customise bot")).toBeTruthy()
    })

    it("exposes the same two included bots in the profile customizer", () => {
        const onChange = vi.fn()
        render(
            <BloubCustomizerSheet
                open
                onClose={() => {}}
                value={DEFAULT_BLOUB_PICK}
                onChange={onChange}
                premium={false}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: "Pebble" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ shape: "galet" }))
        fireEvent.click(screen.getByRole("button", { name: "Cloud, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ shape: "nuage" }))
    })

    it("selects Retro LCD and its matching theme during onboarding", () => {
        const onChange = vi.fn()
        const props = { name: "North Studio", value: DEFAULT_BLOUB_PICK, onChange, phase: "edit" as const, onContinue: vi.fn(), onSave: vi.fn(), onModify: vi.fn(), busy: false }
        const { rerender } = render(<BlobLookStudio {...props} />)
        fireEvent.click(screen.getByRole("button", { name: "Retro LCD" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "retro-lcd", shape: "cercle" })
        rerender(<BlobLookStudio {...props} value={{ ...DEFAULT_BLOUB_PICK, theme: "retro-lcd" }} />)
        expect(screen.getByRole("button", { name: "Retro LCD" }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByRole("button", { name: "Circle" }).getAttribute("aria-pressed")).toBe("false")
        expect(screen.queryByRole("button", { name: "Turquoise" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Classic theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "classic" })
        fireEvent.click(screen.getByRole("button", { name: "Pebble" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "classic", shape: "galet" })
    })

    it("keeps the Retro bot and theme available in the Free profile customizer", () => {
        const onChange = vi.fn()
        const { rerender } = render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "Retro LCD theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "retro-lcd", shape: "cercle" })
        rerender(<BloubCustomizerSheet open onClose={() => {}} value={{ ...DEFAULT_BLOUB_PICK, theme: "retro-lcd" }} onChange={onChange} premium={false} />)
        expect(screen.getByRole("button", { name: "Retro LCD" }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByRole("button", { name: "Circle" }).getAttribute("aria-pressed")).toBe("false")
        expect(screen.queryByRole("button", { name: "Turquoise" })).toBeNull()
        expect(screen.getAllByTestId("orb").filter(node => node.getAttribute("data-theme") === "retro-lcd").length).toBeGreaterThan(1)
        fireEvent.click(screen.getByRole("button", { name: "Circle" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "classic", shape: "cercle" })
    })
})
