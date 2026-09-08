import { describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MobileNav } from "@/components/marketing/mobile-nav"

const links = [["Stories", "/#stories"], ["FAQ", "/#faq"]] as const

describe("marketing mobile navigation", () => {
    it("opens through the native summary and closes after every navigation link is chosen", () => {
        const { container } = render(<MobileNav links={links} />)
        const details = container.querySelector("details")!
        const summary = screen.getByLabelText("Navigation menu")
        // Let the app handle the click normally, then stop jsdom from navigating.
        const preventNavigation = (event: MouseEvent) => {
            if ((event.target as Element).closest("a")) event.preventDefault()
        }
        document.addEventListener("click", preventNavigation)
        try {
            expect(details.open).toBe(false)
            for (const [label, href] of [...links, ["Get started", "/sign-up"], ["Sign in", "/sign-in"]]) {
                fireEvent.click(summary)
                expect(details.open).toBe(true)
                const navigation = screen.getByRole("navigation", { name: "Mobile navigation" })
                const link = within(navigation).getByRole("link", { name: label })
                expect(link.getAttribute("href")).toBe(href)
                fireEvent.click(link)
                expect(details.open).toBe(false)
            }
        } finally {
            document.removeEventListener("click", preventNavigation)
        }
    })

    it("closes on Escape and returns keyboard focus to the summary", () => {
        const { container } = render(<MobileNav links={links} />)
        const details = container.querySelector("details")!
        const summary = screen.getByLabelText("Navigation menu")
        fireEvent.click(summary)
        const link = screen.getByRole("link", { name: "Stories" })
        link.focus()
        expect(document.activeElement).toBe(link)

        fireEvent.keyDown(link, { key: "Escape" })
        expect(details.open).toBe(false)
        expect(document.activeElement).toBe(summary)
    })

    it("does not steal focus when Escape is pressed while the menu is already closed", () => {
        const { container } = render(<><MobileNav links={links} /><button type="button">Outside menu</button></>)
        const outside = screen.getByRole("button", { name: "Outside menu" })
        outside.focus()
        fireEvent.keyDown(outside, { key: "Escape" })

        expect(container.querySelector("details")!.open).toBe(false)
        expect(document.activeElement).toBe(outside)
    })
})
