import { useState } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BloubCustomizerSheet } from "@/components/dashboard/bloub-customizer-sheet"
import { BlobLookStudio } from "@/components/onboarding/blob-look"
import { ChatAvatar } from "@/components/chat/chat-avatar"
import { BLOUB_AURAS, BLOUB_MOODS, COSMIC_THEMES, DEFAULT_BLOUB_PICK, type BloubPick } from "@/lib/bloub/catalog"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"

beforeEach(() => { installMatchMedia({ [REDUCE_MOTION]: true }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const initial: BloubPick = {
    ...DEFAULT_BLOUB_PICK,
    theme: "cosmic-comic",
    expression: "timide",
    aura: "pulse",
    orbitProfile: true,
}

function CustomizerHost({ onPatch }: { onPatch: (next: Partial<BloubPick>) => void }) {
    const [value, setValue] = useState(initial)
    return <>
        <output data-testid="saved-bot">{JSON.stringify(value)}</output>
        <BloubCustomizerSheet open onClose={() => undefined} value={value} profileImageUrl="/portrait.jpg"
            onChange={(next) => { onPatch(next); setValue((current) => ({ ...current, ...next })) }} />
    </>
}

function OnboardingHost({ onPatch }: { onPatch: (next: Partial<BloubPick>) => void }) {
    const [value, setValue] = useState(DEFAULT_BLOUB_PICK)
    const [phase, setPhase] = useState<"edit" | "preview">("edit")
    return <>
        <output data-testid="saved-bot">{JSON.stringify(value)}</output>
        <BlobLookStudio name="North Studio" value={value} phase={phase} busy={false}
            onContinue={() => setPhase("preview")} onModify={() => setPhase("edit")} onSave={() => undefined}
            onChange={(next) => { onPatch(next); setValue((current) => ({ ...current, ...next })) }} />
    </>
}

describe("Nova owner controls", () => {
    it("selects Nova and its Comic treatment in onboarding and carries both into the page preview", () => {
        const onPatch = vi.fn()
        const { container } = render(<OnboardingHost onPatch={onPatch} />)
        expect(screen.getAllByRole("button", { name: "Nova" })).toHaveLength(1)
        fireEvent.click(screen.getByRole("button", { name: "Nova" }))
        expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "cosmic-space" }))
        expect(screen.getByRole("button", { name: "Space theme" }).getAttribute("aria-pressed")).toBe("true")
        fireEvent.click(screen.getByRole("button", { name: "Shy" }))
        fireEvent.click(screen.getByRole("button", { name: "Pulse" }))
        fireEvent.click(screen.getByRole("button", { name: "Comic theme" }))
        expect(onPatch).toHaveBeenLastCalledWith({ theme: "cosmic-comic" })
        expect(screen.getByRole("button", { name: "Comic theme" }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByRole("button", { name: "Nova" }).getAttribute("aria-pressed")).toBe("true")
        expect(JSON.parse(screen.getByTestId("saved-bot").textContent!)).toMatchObject({ theme: "cosmic-comic", expression: "timide", aura: "pulse" })
        fireEvent.click(screen.getByRole("button", { name: "Nova" }))
        expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "cosmic-comic" }))
        fireEvent.click(screen.getByRole("button", { name: "Looks right" }))
        const page = container.querySelector('[data-bot-theme="cosmic-comic"]')!
        expect(page).not.toBeNull()
        expect(page.querySelector(".cosmic-orb--cosmic-comic")).not.toBeNull()
    })

    it("has one Nova card selected for Comic and retains Comic when the card is selected again", () => {
        const onPatch = vi.fn()
        render(<CustomizerHost onPatch={onPatch} />)
        const nova = screen.getAllByRole("button", { name: "Nova" })
        expect(nova).toHaveLength(1)
        expect(nova[0].getAttribute("aria-pressed")).toBe("true")
        expect(screen.queryByRole("button", { name: "Space" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Comic" })).toBeNull()
        fireEvent.click(nova[0])
        expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "cosmic-comic" }))
        expect(JSON.parse(screen.getByTestId("saved-bot").textContent!)).toMatchObject({ theme: "cosmic-comic", orbitProfile: true })
        expect(screen.getByRole("button", { name: "Nova" }).getAttribute("aria-pressed")).toBe("true")
    })

    it("changes Space and Comic with accessible buttons while keeping the mood, aura and profile orbit", () => {
        const onPatch = vi.fn()
        render(<CustomizerHost onPatch={onPatch} />)
        fireEvent.click(screen.getByRole("tab", { name: "Look" }))
        const themes = screen.getByText("Chat themes").closest("section")!
        expect(within(themes).getAllByRole("button")).toHaveLength(2)
        expect(screen.getByRole("button", { name: "Comic theme" }).getAttribute("aria-pressed")).toBe("true")
        for (const [name, theme] of [["Space", "cosmic-space"], ["Comic", "cosmic-comic"]] as const) {
            const button = screen.getByRole("button", { name: `${name} theme` })
            fireEvent.click(button)
            expect(onPatch).toHaveBeenLastCalledWith({ theme })
            expect(button.getAttribute("aria-pressed")).toBe("true")
            expect(JSON.parse(screen.getByTestId("saved-bot").textContent!)).toMatchObject({ theme, expression: "timide", aura: "pulse", orbitProfile: true })
            const preview = screen.getByRole("dialog").querySelector("[data-profile-orbit]")!
            expect(preview.querySelector(`.cosmic-orb--${theme}`)).not.toBeNull()
            expect(preview.querySelector("img")?.getAttribute("src")).toBe("/portrait.jpg")
            expect(preview.querySelector(".pl-orb-scene")?.getAttribute("data-expression")).toBe("timide")
            expect(preview.querySelector(".bot-aura")?.getAttribute("data-aura")).toBe("pulse")
        }
        fireEvent.click(screen.getByRole("tab", { name: "Bots" }))
        expect(screen.getByRole("button", { name: "Nova" }).getAttribute("aria-pressed")).toBe("true")
    })

    it.each(COSMIC_THEMES)("exposes all saved moods and aura options for %s", (theme) => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={vi.fn()} value={{ ...initial, theme }} profileImageUrl="/portrait.jpg" onChange={onChange} />)
        fireEvent.click(screen.getByRole("tab", { name: "Mood" }))
        const moods = screen.getByText("Mood", { selector: "p" }).closest("section")!
        const auras = screen.getByText("Aura", { selector: "p" }).closest("section")!
        expect(within(moods).getAllByRole("button")).toHaveLength(6)
        expect(moods.querySelectorAll(`.cosmic-orb--${theme}`)).toHaveLength(6)
        for (const { id, label } of BLOUB_MOODS) {
            fireEvent.click(within(moods).getByRole("button", { name: label }))
            expect(onChange).toHaveBeenLastCalledWith({ expression: id })
        }
        expect(within(auras).getAllByRole("button")).toHaveLength(3)
        for (const { id, label } of BLOUB_AURAS) {
            fireEvent.click(within(auras).getByRole("button", { name: label }))
            expect(onChange).toHaveBeenLastCalledWith({ aura: id })
        }
    })
})

describe("Nova in live chat avatars", () => {
    it.each(COSMIC_THEMES)("uses %s with runtime mood, one aura and the owner's profile satellite", (theme) => {
        const props = { size: 96, name: "Ada", theme, expression: "timide", aura: "breathe", orbitProfile: true, mode: "IMAGE" }
        const { container, rerender } = render(<ChatAvatar {...props} imageUrl="/portrait.jpg" mood="listening" />)
        expect(container.querySelector(`[data-chat-avatar="photo"]`)).toBeNull()
        expect(container.querySelector(`.cosmic-orb--${theme}`)).not.toBeNull()
        expect(container.querySelector("[data-profile-orbit] img")?.getAttribute("src")).toBe("/portrait.jpg")
        expect(container.querySelector(".pl-orb-scene")?.getAttribute("data-mood")).toBe("listening")
        expect(container.querySelector(".pl-orb-scene")?.getAttribute("data-expression")).toBe("attentif")
        expect(container.querySelectorAll('.bot-aura[data-aura="breathe"]')).toHaveLength(1)
        rerender(<ChatAvatar {...props} mood="idle" />)
        expect(container.querySelector("[data-profile-orbit]")).toBeNull()
        expect(container.querySelector(`.cosmic-orb--${theme}`)).not.toBeNull()
        expect(container.querySelector(".pl-orb-scene")?.getAttribute("data-expression")).toBe("timide")
        expect(container.textContent).toBe("")
    })
})
