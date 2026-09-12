import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_BLOUB_PICK } from "@/lib/bloub/catalog"
import { ANIMOJI_FACES } from "@/lib/animoji"

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/welcome-orb", () => ({ WelcomeOrb: ({ theme, look, skin, expression, shape }: { theme?: string; look?: string; skin?: string; expression?: string; shape?: string }) => <div data-testid="orb" data-theme={theme} data-look={look} data-skin={skin} data-expression={expression} data-shape={shape} /> }))

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
        expect(screen.getByRole("tab", { name: "Bots" }).getAttribute("aria-selected")).toBe("true")
        expect(screen.getByRole("button", { name: "CRT, premium" })).toBeTruthy()
        expect(screen.queryByText("Your colour, mood and aura.")).toBeNull()
    })

    it("exposes Blob, 8-Bit, CRT and Spark plus themed bots, with Sol Lux Sky Dew as Blob shapes", () => {
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
        fireEvent.click(screen.getByRole("button", { name: "Blob" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "bloub" }))
        fireEvent.click(screen.getByRole("button", { name: "Glow" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "glass" }))
        fireEvent.click(screen.getByRole("button", { name: "Animoji" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "animoji", skin: "bounce" }))
        fireEvent.click(screen.getByRole("button", { name: "CRT, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ skin: "crt" }))
        expect(screen.getByRole("button", { name: "Spark, premium" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "LCD" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Nyx, premium" })).toBeTruthy()
        expect(screen.queryByRole("button", { name: "Zen" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Neo" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Ice" })).toBeNull()
        fireEvent.click(screen.getByRole("tab", { name: "Look" }))
        fireEvent.click(screen.getByRole("button", { name: "Sol" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "bloub", shape: "galet" }))
        fireEvent.click(screen.getByRole("button", { name: "Lux, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ shape: "squircle" }))
        expect(screen.getByRole("button", { name: "Sky, premium" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Dew, premium" })).toBeTruthy()
        const colour = screen.getByText("Colour")
        const theme = screen.getByText("Chat themes")
        expect(Boolean(colour.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    })

    it("lists all twenty-seven coded animoji faces, including Panda and Nerd", () => {
        render(
            <BloubCustomizerSheet
                open
                onClose={() => {}}
                value={{ ...DEFAULT_BLOUB_PICK, look: "animoji", skin: "bounce" }}
                onChange={() => {}}
                premium={false}
            />,
        )
        expect(ANIMOJI_FACES).toHaveLength(27)
        fireEvent.click(screen.getByRole("tab", { name: "Mood" }))
        expect(document.querySelector("[data-animoji-grid]")?.querySelectorAll("button")).toHaveLength(27)
        expect(screen.getByRole("button", { name: "Panda" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Nerd" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Frog" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Moon" })).toBeTruthy()
    })

    it("picks LCD as its own bot during onboarding and only shows that theme", () => {
        const onChange = vi.fn()
        const props = { name: "North Studio", value: DEFAULT_BLOUB_PICK, onChange, phase: "edit" as const, onContinue: vi.fn(), onSave: vi.fn(), onModify: vi.fn(), busy: false }
        const { rerender } = render(<BlobLookStudio {...props} />)
        fireEvent.click(screen.getByRole("button", { name: "LCD" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ look: "bloub", theme: "retro-lcd", shape: "cercle" }))
        rerender(<BlobLookStudio {...props} value={{ ...DEFAULT_BLOUB_PICK, theme: "retro-lcd" }} />)
        expect(screen.getByLabelText("Retro LCD theme")).toBeTruthy()
        expect(screen.queryByLabelText("Classic theme")).toBeNull()
        expect(screen.queryByRole("slider", { name: "Colour" })).toBeNull()
    })

    it("keeps LCD as a free bot in the profile customizer", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "LCD" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ look: "bloub", theme: "retro-lcd", shape: "cercle" }))
        fireEvent.click(screen.getByRole("button", { name: "Blob" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ look: "bloub", theme: "classic" }))
    })

    it("locks themed premium bots for Free and applies them when entitled", () => {
        const onChange = vi.fn()
        const props = { open: true, onClose: () => {}, onChange }
        const { rerender } = render(<BloubCustomizerSheet {...props} value={DEFAULT_BLOUB_PICK} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "Nyx, premium" }))
        fireEvent.click(screen.getByRole("button", { name: "Ion, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ theme: "astral-nebula" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ theme: "holographic-hud" }))

        rerender(<BloubCustomizerSheet {...props} value={DEFAULT_BLOUB_PICK} premium />)
        fireEvent.click(screen.getByRole("button", { name: "Nyx" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "astral-nebula", look: "bloub" }))
        fireEvent.click(screen.getByRole("button", { name: "Ion" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "holographic-hud" }))
        fireEvent.click(screen.getByRole("button", { name: "Vex" }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "liquid-chrome" }))
    })

    it("shows only the selected bot's own chat theme in Look", () => {
        const { rerender } = render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={() => {}} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Look" }))
        expect(screen.getByLabelText("Classic theme")).toBeTruthy()
        expect(screen.getByRole("slider", { name: "Colour" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Violet" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Sunrise" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Ice" })).toBeTruthy()
        expect(screen.queryByLabelText("Astral Nebula theme")).toBeNull()
        expect(screen.queryByLabelText("Holographic HUD theme")).toBeNull()
        expect(screen.queryByLabelText("Liquid Chrome theme")).toBeNull()
        rerender(<BloubCustomizerSheet open onClose={() => {}} value={{ ...DEFAULT_BLOUB_PICK, theme: "astral-nebula" }} onChange={() => {}} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Look" }))
        expect(screen.getByLabelText("Astral Nebula theme")).toBeTruthy()
        expect(screen.queryByLabelText("Classic theme")).toBeNull()
        expect(screen.queryByRole("slider", { name: "Colour" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Sol" })).toBeNull()
    })

    it("gives Glow the six former colour bots as Look colours", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={() => {}} value={{ ...DEFAULT_BLOUB_PICK, look: "glass" }} onChange={onChange} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Look" }))
        expect(screen.getByRole("button", { name: "Aqua" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Forest" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Ember" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Violet" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Sunrise" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Ice" })).toBeTruthy()
        expect(screen.queryByLabelText("Classic theme")).toBeNull()
        expect(screen.queryByRole("button", { name: "Sol" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Violet" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "glass", variant: "violet" }))
    })

    it("paints a different still face for each Blob mood", () => {
        render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={() => {}} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Mood" }))
        expect(screen.getByText("Calm").closest("button")?.querySelector("[data-expression='centre']")).toBeTruthy()
        expect(screen.getByText("Happy").closest("button")?.querySelector("[data-expression='heureux']")).toBeTruthy()
        expect(screen.getByText("Surprised").closest("button")?.querySelector("[data-expression='surpris']")).toBeTruthy()
        expect(screen.getByText("Shy").closest("button")?.querySelector("[data-expression='timide']")).toBeTruthy()
    })

    it("applies CRT when entitled", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium />)
        fireEvent.click(screen.getByRole("button", { name: "CRT" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "pixel", skin: "crt" }))
        fireEvent.click(screen.getByRole("button", { name: "Spark" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ look: "pixel", skin: "spark" }))
    })
})
