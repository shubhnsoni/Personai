import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { act } from "react"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"
import { appointmentBookHref, bookChip } from "@/lib/kit-copy"

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

const { ChatInterface } = await import("@/components/chat/chat-interface")

const PROFILE = { id: "p1", slug: "h-square-salon-harmu", displayName: "H Square Salon" } as never

function stubChatFetch() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: true,
            json: async () => ({}),
        })) as unknown as typeof fetch,
    )
}

function renderChat(props: Partial<Record<string, unknown>> = {}) {
    return render(
        <ChatInterface
            profile={PROFILE}
            welcome={null}
            topics={[]}
            chips={[]}
            quickQuestions={[]}
            colors={["#52E8FF", "#0A84FF"]}
            animationConfig={{}}
            {...(props as object)}
        />,
    )
}

describe("salon-p0-2 appointmentBookHref", () => {
    it("routes TAKE_APPOINTMENTS salon/barber kits to /book", () => {
        expect(appointmentBookHref("h-square-salon-harmu", "SALON_SPA", "TAKE_APPOINTMENTS")).toBe(
            "/h-square-salon-harmu/book",
        )
        expect(appointmentBookHref("prince-barber-lalpur", "BARBER", "TAKE_APPOINTMENTS")).toBe(
            "/prince-barber-lalpur/book",
        )
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("BARBER")).toBe("Book a treatment")
    })

    it("does not force /book for non-appointment goals without salon kit", () => {
        expect(appointmentBookHref("ada", "DESIGNER", "SHOW_PORTFOLIO")).toBeNull()
        expect(appointmentBookHref("neal", "CONSULTANT", "BOOK_CALL")).toBeNull()
    })
})

describe("salon-p0-2 mobile home Book chrome", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: false })
        stubChatFetch()
        localStorage.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        stubChatFetch()
    })

    it("keeps Book CTA in home chrome when visual-keyboard compact hides welcome chips", () => {
        installMatchMedia({ [REDUCE_MOTION]: true })
        const viewport = new EventTarget()
        Object.defineProperties(viewport, {
            height: { value: 410, configurable: true },
            scale: { value: 1, configurable: true },
        })
        vi.stubGlobal("visualViewport", viewport)
        vi.stubGlobal("innerHeight", 780)

        renderChat({
            chips: [
                {
                    id: "book",
                    label: "Book a treatment",
                    highlighted: true,
                    href: "/h-square-salon-harmu/book",
                },
                { id: "services", label: "See services", onSelect: () => {} },
                { id: "about", label: "About", onSelect: () => {} },
            ],
        })

        // Compact still hides the welcome chip row (existing mobile keyboard behaviour).
        expect(document.querySelector("[data-welcome-chips]")).toBeNull()
        // Book remains above the fold via mobile home chrome / chat primary action.
        const bookCta = document.querySelector("[data-home-book-cta]")
        expect(bookCta).toBeTruthy()
        expect(bookCta?.textContent).toMatch(/Book a treatment/)
        expect(bookCta?.closest("a")?.getAttribute("href") || bookCta?.getAttribute("href")).toBe(
            "/h-square-salon-harmu/book",
        )
        expect(document.querySelector("[data-chat-primary-action]")?.textContent).toMatch(/Book a treatment/)
    })

    it("opens /book from the home Book CTA", () => {
        installMatchMedia({ [REDUCE_MOTION]: true })
        const open = vi.fn()
        vi.stubGlobal("open", open)

        renderChat({
            chips: [
                {
                    id: "book",
                    label: "Book a treatment",
                    highlighted: true,
                    href: "/h-square-salon-harmu/book",
                },
            ],
        })

        const bookCta = document.querySelector("[data-home-book-cta]") as HTMLElement
        expect(bookCta).toBeTruthy()
        act(() => {
            bookCta.click()
            vi.advanceTimersByTime(50)
        })
        expect(open).toHaveBeenCalledWith("/h-square-salon-harmu/book", "_self")
    })
})
