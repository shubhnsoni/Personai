import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_BLOUB_PICK, bloubBotPick, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS } from "@/lib/bloub/catalog"

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/welcome-orb", () => ({ WelcomeOrb: ({ theme }: { theme?: string }) => <div data-testid="orb" data-theme={theme} /> }))

const { BlobLookStudio } = await import("@/components/onboarding/blob-look")
const { BloubCustomizerSheet } = await import("@/components/dashboard/bloub-customizer-sheet")

describe("included bots on onboarding and profile", () => {
    it("lets anyone pick Zen or Sol during onboarding and names other bots as premium", () => {
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
        fireEvent.click(screen.getByRole("button", { name: "Sol" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ shape: "galet" }))
        fireEvent.click(screen.getByRole("button", { name: "Sky, premium" }))
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
        expect(sheet?.className).toMatch(/max-h-\[calc\(100dvh-3rem-env\(safe-area-inset-top,0px\)\)\]/)
        expect(sheet?.className).toMatch(/\boverflow-y-auto\b/)
        expect(screen.getByRole("tablist", { name: "Bot customisation" })).toBeTruthy()
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
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        fireEvent.click(screen.getByRole("button", { name: "Sol" }))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ shape: "galet" }))
        fireEvent.click(screen.getByRole("button", { name: "Sky, premium" }))
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
        expect(screen.getByRole("button", { name: "Zen" }).getAttribute("aria-pressed")).toBe("false")
        expect(screen.queryByRole("button", { name: "Turquoise" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Classic theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "classic" })
        fireEvent.click(screen.getByRole("button", { name: "Sol" }))
        expect(onChange).toHaveBeenLastCalledWith(bloubBotPick(INCLUDED_BLOUB_BOTS[1]))
    })

    it("keeps the Retro bot and theme available in the Free profile customizer", () => {
        const onChange = vi.fn()
        const { rerender } = render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "Retro LCD theme" }))
        expect(onChange).toHaveBeenLastCalledWith({ theme: "retro-lcd", shape: "cercle" })
        rerender(<BloubCustomizerSheet open onClose={() => {}} value={{ ...DEFAULT_BLOUB_PICK, theme: "retro-lcd" }} onChange={onChange} premium={false} />)
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        expect(screen.getByRole("button", { name: "Retro LCD" }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByRole("button", { name: "Zen" }).getAttribute("aria-pressed")).toBe("false")
        expect(screen.queryByRole("button", { name: "Turquoise" })).toBeNull()
        expect(screen.getAllByTestId("orb").filter(node => node.getAttribute("data-theme") === "retro-lcd").length).toBeGreaterThan(1)
        fireEvent.click(screen.getByRole("button", { name: "Zen" }))
        expect(onChange).toHaveBeenLastCalledWith(bloubBotPick(INCLUDED_BLOUB_BOTS[0]))
    })

    it("locks themed premium bots for Free and applies full configurations when entitled", () => {
        const onChange = vi.fn()
        const props = { open: true, onClose: () => {}, onChange }
        const { rerender } = render(<BloubCustomizerSheet {...props} value={DEFAULT_BLOUB_PICK} premium={false} />)
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        fireEvent.click(screen.getByRole("button", { name: "Nyx, premium" }))
        fireEvent.click(screen.getByRole("button", { name: "Ion, premium" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ theme: "astral-nebula" }))
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ theme: "holographic-hud" }))

        rerender(<BloubCustomizerSheet {...props} value={DEFAULT_BLOUB_PICK} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        fireEvent.click(screen.getByRole("button", { name: "Nyx" }))
        const nyx = PREMIUM_BLOUB_BOTS.find(bot => bot.label === "Nyx")!
        expect(onChange).toHaveBeenLastCalledWith(bloubBotPick(nyx))
        fireEvent.click(screen.getByRole("button", { name: "Ion" }))
        const ion = PREMIUM_BLOUB_BOTS.find(bot => bot.label === "Ion")!
        expect(onChange).toHaveBeenLastCalledWith(bloubBotPick(ion))
        fireEvent.click(screen.getByRole("button", { name: "Vex" }))
        const vex = PREMIUM_BLOUB_BOTS.find(bot => bot.label === "Vex")!
        expect(onChange).toHaveBeenLastCalledWith({ theme: "liquid-chrome", shape: "cercle", expression: "blase", color: "gris", aura: "breathe" })
        expect(bloubBotPick(vex)).toEqual({ theme: "liquid-chrome", shape: "cercle", expression: "blase", color: "gris", aura: "breathe" })
    })

    it("shows every premium orb's own theme in the bot grid previews", () => {
        render(<BloubCustomizerSheet open onClose={() => {}} value={DEFAULT_BLOUB_PICK} onChange={() => {}} premium />)
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        const orbs = screen.getAllByTestId("orb")
        for (const theme of ["astral-nebula", "holographic-hud", "liquid-chrome"]) {
            expect(orbs.some(node => node.getAttribute("data-theme") === theme)).toBe(true)
        }
    })
})
