import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"
import { CUSTOMIZER_BOTS, DEFAULT_BLOUB_PICK, INCLUDED_BLOUB_BOTS, PLANET_THEMES, PREMIUM_BLOUB_BOTS, PREMIUM_BLOUB_THEMES, BLOUB_THEMES } from "@/lib/bloub/catalog"

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const { BloubCustomizerSheet } = await import("@/components/dashboard/bloub-customizer-sheet")
const { BlobLookStudio } = await import("@/components/onboarding/blob-look")

beforeEach(() => {
    installMatchMedia({ [REDUCE_MOTION]: true })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("Free plan bot catalogue", () => {
    it("includes only Blob, Glow, Animoji and LCD; everything else is Premium", () => {
        expect(CUSTOMIZER_BOTS.filter((bot) => !bot.premium).map((bot) => bot.label)).toEqual(["Blob", "Glow", "Animoji"])
        expect(CUSTOMIZER_BOTS.filter((bot) => bot.premium).map((bot) => bot.label)).toEqual(["8-Bit", "CRT", "Spark"])
        expect(INCLUDED_BLOUB_BOTS.map((bot) => bot.label)).toEqual(["LCD"])
        expect(PREMIUM_BLOUB_BOTS).toHaveLength(9)
        expect(PREMIUM_BLOUB_THEMES).toEqual(BLOUB_THEMES.map((item) => item.id).filter((id) => id !== "classic" && id !== "retro-lcd"))
    })

    it("stars every Premium bot for Free owners and none for Premium owners", () => {
        const { rerender } = render(<BloubCustomizerSheet open onClose={vi.fn()} value={DEFAULT_BLOUB_PICK} onChange={vi.fn()} premium={false} />)
        const expected = CUSTOMIZER_BOTS.filter((bot) => bot.premium).length + PREMIUM_BLOUB_BOTS.length
        expect(document.querySelectorAll("[data-premium-star]")).toHaveLength(expected)
        for (const bot of PREMIUM_BLOUB_BOTS) {
            expect(within(screen.getByRole("button", { name: `${bot.label}, premium` })).getByText("✦")).toBeTruthy()
        }
        expect(screen.getByRole("button", { name: "LCD" }).querySelector("[data-premium-star]")).toBeNull()
        rerender(<BloubCustomizerSheet open onClose={vi.fn()} value={DEFAULT_BLOUB_PICK} onChange={vi.fn()} premium />)
        expect(document.querySelectorAll("[data-premium-star]")).toHaveLength(0)
    })

    it("previews a Premium bot in a popup with an upgrade link instead of selecting it", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={vi.fn()} value={DEFAULT_BLOUB_PICK} onChange={onChange} premium={false} />)
        expect(document.querySelector("[data-premium-bot-preview]")).toBeNull()

        fireEvent.click(screen.getByRole("button", { name: "Pearl, premium" }))
        expect(onChange).not.toHaveBeenCalled()
        const dialog = document.querySelector<HTMLElement>("[data-premium-bot-preview]")!
        expect(dialog).not.toBeNull()
        expect(within(dialog).getByText("Premium bot")).toBeTruthy()
        expect(within(dialog).getByRole("heading", { name: "Pearl" })).toBeTruthy()
        expect(dialog.querySelector(".mo-orb--glass-bubble")).not.toBeNull()
        const link = within(dialog).getByRole("link", { name: /Unlock with Premium/ })
        expect(link.getAttribute("href")).toBe("/dashboard/billing")

        fireEvent.click(within(dialog).getByRole("button", { name: "Maybe later" }))
        expect(document.querySelector("[data-premium-bot-preview]")).toBeNull()
    })

    it("lets a Free owner browse every Azure world inside the preview", () => {
        render(<BloubCustomizerSheet open onClose={vi.fn()} value={DEFAULT_BLOUB_PICK} onChange={vi.fn()} premium={false} />)
        fireEvent.click(screen.getByRole("button", { name: "Azure, premium" }))
        const dialog = document.querySelector<HTMLElement>("[data-premium-bot-preview]")!
        const looks = within(dialog).getByRole("group", { name: "Azure looks" })
        expect(within(looks).getAllByRole("button")).toHaveLength(PLANET_THEMES.length)
        fireEvent.click(within(looks).getByRole("button", { name: "Saturn" }))
        expect(within(dialog).getByRole("heading", { name: "Azure · Saturn" })).toBeTruthy()
        expect(dialog.querySelector(".planet-orb--planet-saturn")).not.toBeNull()
        expect(within(looks).getByRole("button", { name: "Saturn" }).getAttribute("aria-pressed")).toBe("true")
    })

    it("previews pixel bots and points onboarding at pricing", () => {
        const onChange = vi.fn()
        render(<BlobLookStudio name="North" value={DEFAULT_BLOUB_PICK} onChange={onChange} phase="edit" onContinue={vi.fn()} onSave={vi.fn()} onModify={vi.fn()} busy={false} />)
        expect(document.querySelectorAll("[data-premium-star]").length).toBeGreaterThanOrEqual(12)
        fireEvent.click(screen.getByRole("button", { name: "CRT, premium" }))
        expect(onChange).not.toHaveBeenCalled()
        const dialog = document.querySelector<HTMLElement>("[data-premium-bot-preview]")!
        expect(within(dialog).getByRole("heading", { name: "CRT" })).toBeTruthy()
        expect(dialog.querySelector(".pl-pix.is-crt")).not.toBeNull()
        expect(within(dialog).getByRole("link", { name: /Unlock with Premium/ }).getAttribute("href")).toBe("/pricing")
    })
})
