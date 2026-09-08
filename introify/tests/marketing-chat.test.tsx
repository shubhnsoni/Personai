import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatShowcase } from "@/components/landing/chat-showcase"

afterEach(() => {
    vi.useRealTimers()
})

describe("scripted marketing conversations", () => {
    it("keeps the preview clearly illustrative and advances only when requested", () => {
        vi.useFakeTimers()
        render(<ChatShowcase />)
        expect(screen.getByRole("heading", { name: "Good introductions start conversations." })).toBeTruthy()
        expect(screen.getByText(/scripted, illustrative examples/)).toBeTruthy()
        expect(screen.getByText(/AI chat is not currently active/)).toBeTruthy()
        expect(screen.getByText(/Nothing is sent, booked or purchased/)).toBeTruthy()
        expect(screen.getByText(/I love your sketches/)).toBeTruthy()
        vi.advanceTimersByTime(60_000)
        expect(screen.getByText("Exchange 1 of 3")).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
        expect(screen.getByText("Do I need to buy lots of materials?")).toBeTruthy()
        expect(screen.queryByText(/I love your sketches/)).toBeNull()
        expect(screen.getByText("Exchange 2 of 3")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
        expect(screen.getByText(/Where can I find the details/)).toBeTruthy()
        expect(screen.getByRole("button", { name: "Example complete" }).hasAttribute("disabled")).toBe(true)
        fireEvent.click(screen.getByRole("button", { name: "Replay" }))
        expect(screen.getByText("Exchange 1 of 3")).toBeTruthy()
        expect(screen.getByText(/I love your sketches/)).toBeTruthy()
        expect(screen.getByRole("button", { name: "Next exchange" }).hasAttribute("disabled")).toBe(false)
    })

    it("resets the exchange when switching scenarios and keeps every tab associated with its panel", () => {
        render(<ChatShowcase />)
        fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
        for (const tab of screen.getAllByRole("tab")) {
            expect(document.getElementById(tab.getAttribute("aria-controls") || "")?.getAttribute("role")).toBe("tabpanel")
        }
        const consultation = screen.getByRole("tab", { name: /Service consultation/ })
        fireEvent.click(consultation)
        expect(consultation.getAttribute("aria-selected")).toBe("true")
        expect(consultation.tabIndex).toBe(0)
        const panel = screen.getByRole("tabpanel", { name: /Service consultation/ })
        expect(panel.getAttribute("aria-labelledby")).toBe(consultation.id)
        expect(within(panel).getByText(/I’m opening a small bakery/)).toBeTruthy()
        expect(within(panel).getByText("Exchange 1 of 3")).toBeTruthy()
        fireEvent.click(screen.getByRole("tab", { name: /Local café/ }))
        expect(screen.getByText(/Do you have vegetarian options/)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
        expect(screen.getByText(/check directly with the café about ingredients and cross-contact/)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
        expect(screen.getByText(/this conversation doesn’t reserve a table/)).toBeTruthy()
    })

    it("supports vertical tab keyboard navigation, wrapping, Home and End", () => {
        render(<ChatShowcase />)
        const tabs = screen.getAllByRole("tab")
        tabs[0].focus()
        for (const [key, expected] of [["ArrowUp", 2], ["ArrowDown", 0], ["ArrowDown", 1], ["End", 2], ["Home", 0]] as const) {
            fireEvent.keyDown(document.activeElement!, { key })
            expect(document.activeElement).toBe(tabs[expected])
            expect(tabs[expected].getAttribute("aria-selected")).toBe("true")
            expect(tabs.filter(tab => tab.tabIndex === 0)).toHaveLength(1)
            expect(screen.getByText("Exchange 1 of 3")).toBeTruthy()
        }
    })

    it("uses only local examples and provides no form that sends messages or creates bookings", () => {
        const fetch = vi.fn()
        vi.stubGlobal("fetch", fetch)
        const { container } = render(<ChatShowcase />)
        for (const tab of screen.getAllByRole("tab")) {
            fireEvent.click(tab)
            fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
            fireEvent.click(screen.getByRole("button", { name: "Next exchange" }))
            fireEvent.click(screen.getByRole("button", { name: "Replay" }))
        }
        expect(fetch).not.toHaveBeenCalled()
        expect(container.querySelector("form, input, textarea, [contenteditable='true']")).toBeNull()
        expect(screen.queryByRole("button", { name: /send|book|purchase/i })).toBeNull()
    })
})
