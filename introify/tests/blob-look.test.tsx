import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_BLOUB_PICK } from "@/lib/bloub/catalog"

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/welcome-orb", () => ({ WelcomeOrb: ({ theme, look, skin }: { theme?: string; look?: string; skin?: string }) => <div data-testid="orb" data-theme={theme} data-look={look} data-skin={skin} /> }))

const { BlobLookStudio } = await import("@/components/onboarding/blob-look")
const { BloubCustomizerSheet } = await import("@/components/dashboard/bloub-customizer-sheet")

describe("included bots on onboarding and profile", () => {
    it("lets anyone pick Blob and names 8-Bit as premium during onboarding", () => {
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
        fireEvent.click(screen.getByRole("button", { name: "Blob" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "bloub", theme: "classic" }))
        fireEvent.click(screen.getByRole("button", { name: "8-Bit, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ look: "pixel", skin: "bit" }))
        expect(screen.queryByRole("button", { name: "Neo" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Neo, premium" })).toBeNull()
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
        expect(sheet?.className).toMatch(/max-h-\[calc\(100dvh-3rem-env\(safe-area-inset-top,0px\)\)\]/)
        expect(sheet?.className).toMatch(/\boverflow-y-auto\b/)
        expect(screen.getByRole("tablist", { name: "Bot customisation" })).toBeTruthy()
        expect(screen.getByText("Customise bot")).toBeTruthy()
        expect(screen.getByText("Chat themes")).toBeTruthy()
        expect(screen.getByRole("slider", { name: "Colour" })).toBeTruthy()
        expect(screen.queryByText("Your colour, mood and aura.")).toBeNull()
    })

    it("exposes Blob, 8-Bit, CRT and Spark in the profile customizer", () => {
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
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        fireEvent.click(screen.getByRole("button", { name: "Blob" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "bloub" }))
        fireEvent.click(screen.getByRole("button", { name: "CRT, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ skin: "crt" }))
        expect(screen.getByRole("button", { name: "Spark, premium" })).toBeTruthy()
        expect(screen.queryByRole("button", { name: "Neo" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Neo, premium" })).toBeNull()
    })

    it("selects Retro LCD as a chat theme during onboarding", () => {
        const onChange = vi.fn()
        const props = { name: "North Studio", value: DEFAULT_BLOUB_PICK, onChange, phase: "edit" as const, onContinue: vi.fn(), onSave: vi.fn(), onModify: vi.fn(), busy: false }
        const { rerender } = render(<BlobLookStudio {...props} />)
        fireEvent.click(screen.getByRole("button", { name: "Retro LCD theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ look: "bloub", theme: "retro-lcd", shape: "cercle" })
        rerender(<BlobLookStudio {...props} value={{ ...DEFAULT_BLOUB_PICK, theme: "retro-lcd" }} />)
        expect(screen.getByRole("button", { name: "Retro LCD theme" }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.queryByRole("slider", { name: "Colour" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Classic theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ look: "bloub", theme: "classic" })
    })

    it("keeps Retro LCD as a free chat theme in the profile customizer", () => {
        const onChange = vi.fn()
        const { rerender } = render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "Retro LCD theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ look: "bloub", theme: "retro-lcd", shape: "cercle" })
        rerender(<BloubCustomizerSheet open onClose={() => {}} value={{ ...DEFAULT_BLOUB_PICK, theme: "retro-lcd" }} onChange={onChange} premium={false} />)
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        expect(screen.getByRole("button", { name: "Blob" }).getAttribute("aria-pressed")).toBe("false")
        fireEvent.click(screen.getByRole("button", { name: "Blob" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ look: "bloub", theme: "classic" }))
    })

    it("locks themed premium chat themes for Free and applies them when entitled", () => {
        const onChange = vi.fn()
        const props = { open: true, onClose: () => {}, onChange }
        const { rerender } = render(<BloubCustomizerSheet {...props} value={DEFAULT_BLOUB_PICK} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "Astral Nebula theme, premium" }))
        fireEvent.click(screen.getByRole("button", { name: "Holographic HUD theme, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ theme: "astral-nebula" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ theme: "holographic-hud" }))

        rerender(<BloubCustomizerSheet {...props} value={DEFAULT_BLOUB_PICK} premium />)
        fireEvent.click(screen.getByRole("button", { name: "Astral Nebula theme" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "astral-nebula", look: "bloub" }))
        fireEvent.click(screen.getByRole("button", { name: "Holographic HUD theme" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "holographic-hud" }))
        fireEvent.click(screen.getByRole("button", { name: "Liquid Chrome theme" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "liquid-chrome" }))
    })

    it("shows every premium chat theme in the look tab", () => {
        render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={() => {}} premium />)
        expect(screen.getByRole("button", { name: "Astral Nebula theme" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Holographic HUD theme" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Liquid Chrome theme" })).toBeTruthy()
    })

    it("applies CRT when entitled", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        fireEvent.click(screen.getByRole("button", { name: "CRT" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "pixel", skin: "crt" }))
        fireEvent.click(screen.getByRole("button", { name: "Spark" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "pixel", skin: "spark" }))
    })
})
