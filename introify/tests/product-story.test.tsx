import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CharacterChooser, ConversationPreview } from "@/components/landing/story-experiences"

afterEach(cleanup)
describe("product story interactions", () => {
    it("lets visitors reveal and replay a conversation without submitting a real customer message", () => {
        render(<ConversationPreview />)
        expect(screen.queryByText(/Maya designs brand identities/)).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Can you help with a new website?" }))
        expect(screen.getByText(/Maya designs brand identities/)).toBeTruthy()
        expect(screen.getByRole("link", { name: "Make a page like this" }).getAttribute("href")).toBe("/sign-up")
        fireEvent.click(screen.getByRole("button", { name: "Try again" }))
        expect(screen.queryByText(/Maya designs brand identities/)).toBeNull()
    })
    it("switches the selected character and accessible description, with Pearl in the approved lineup", () => {
        render(<CharacterChooser />)
        const ion = screen.getByRole("button", { name: /Ion, an Introify AI guide Ion/ })
        const pearl = screen.getByRole("button", { name: /Pearl, an Introify AI guide Pearl/ })
        expect(ion.getAttribute("aria-pressed")).toBe("true")
        fireEvent.click(pearl)
        expect(pearl.getAttribute("aria-pressed")).toBe("true")
        expect(ion.getAttribute("aria-pressed")).toBe("false")
        expect(screen.getByText("A softer side of smart.")).toBeTruthy()
        expect(screen.queryByRole("button", { name: /Glow|Telly/ })).toBeNull()
    })
})
