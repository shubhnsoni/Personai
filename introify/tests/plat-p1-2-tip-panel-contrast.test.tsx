import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fireEvent, render, screen } from "@testing-library/react"
import { TipSheet } from "@/components/profile/tip-sheet"
import { ReserveSheet } from "@/components/booking/reserve-sheet"
import { CheckoutSheet } from "@/components/checkout/checkout-sheet"
import { ProfileStage, ProfileStageClose, PROFILE_STAGE_DARK_SURFACE_CLASS } from "@/components/profile/profile-stage"

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))
vi.mock("@/app/actions/products", () => ({ placeTip: vi.fn() }))

const root = process.cwd()

/** The painted stage panel (child of [data-content-stage]). */
function panel() {
    const el = document.querySelector("[data-stage-surface]") as HTMLElement | null
    expect(el).toBeTruthy()
    return el!
}

const classes = (el: Element) => new Set((el.getAttribute("class") || "").split(/\s+/))

describe("plat-p1-2 ProfileStage pairs dark panel with dark-theme tokens", () => {
    it("default stage is a dark surface that scopes .dark tokens + foreground ink", () => {
        render(
            <ProfileStage open onClose={() => {}}>
                <h2>Panel</h2>
            </ProfileStage>,
        )
        const c = classes(panel())
        expect(panel().getAttribute("data-stage-surface")).toBe("dark")
        expect(c.has("bg-zinc-950")).toBe(true)
        expect(c.has("dark")).toBe(true)
        expect(c.has("text-foreground")).toBe(true)
        expect(PROFILE_STAGE_DARK_SURFACE_CLASS).toBe("dark text-foreground")
    })

    it("surface=theme (checkout) keeps page tokens — no forced .dark scope", () => {
        render(
            <CheckoutSheet
                item={{ itemType: "product", itemId: "i1", title: "Print", priceCents: 500 }}
                onClose={() => {}}
            />,
        )
        const c = classes(panel())
        expect(panel().getAttribute("data-stage-surface")).toBe("theme")
        expect(c.has("dark")).toBe(false)
        expect(c.has("bg-background")).toBe(true)
        expect(c.has("text-foreground")).toBe(true)
        expect(c.has("bg-zinc-950")).toBe(false)
        expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
    })

    it("reserve sheet keeps its explicit light ink on the dark panel", () => {
        render(
            <ReserveSheet open onClose={() => {}} profile={{ id: "p1", displayName: "Ada" }} service={null} />,
        )
        const c = classes(panel())
        expect(c.has("dark")).toBe(true)
        expect(c.has("text-zinc-100")).toBe(true)
        expect(c.has("text-foreground")).toBe(false)
    })
})

describe("plat-p1-2 Tip panel (Paras / MK / every kit)", () => {
    it("renders on a dark surface with readable title, labels, chips and Send tip", () => {
        render(<TipSheet profileId="p1" displayName="Paras Auto" onClose={() => {}} />)
        const c = classes(panel())
        expect(c.has("bg-zinc-950")).toBe(true)
        expect(c.has("dark")).toBe(true)

        const title = screen.getByRole("heading", { name: "Tip Paras Auto" })
        expect(title.className).toMatch(/\btext-foreground\b/)
        // Labels inherit panel ink (dark-scoped foreground), never a light-theme hard-code.
        for (const l of ["Name", "Email"]) {
            const label = screen.getByText(l)
            expect(label.className).not.toMatch(/text-(zinc|slate|gray|neutral)-(7|8|9)\d\d/)
        }
        const send = screen.getByRole("button", { name: "Send tip" }) as HTMLButtonElement
        expect(send.disabled).toBe(true)
        expect(send.className).toMatch(/\bbg-white\b/)
        expect(send.className).toMatch(/\btext-zinc-950\b/)
        expect(send.className).toMatch(/disabled:opacity-100/)
        expect(send.className).toMatch(/disabled:text-zinc-300/)
        expect(send.className).toMatch(/disabled:bg-zinc-800/)
        expect(send.className).not.toMatch(/disabled:opacity-50/)
    })

    it("✕ has an accessible name", () => {
        const onClose = vi.fn()
        render(<TipSheet profileId="p1" displayName="MK Jewellers" onClose={onClose} />)
        const close = screen.getByRole("button", { name: "Close" })
        expect(close.getAttribute("aria-label")).toBe("Close")
        fireEvent.click(close)
        expect(onClose).toHaveBeenCalled()
    })

    it("amount chips and inputs stay usable", () => {
        render(<TipSheet profileId="p1" displayName="Paras Auto" onClose={() => {}} />)
        const amount = document.querySelector('input[type="number"]') as HTMLInputElement
        expect(amount.value).toBe("100")
        fireEvent.click(screen.getByRole("button", { name: "200" }))
        expect(amount.value).toBe("200")
        expect(screen.getByRole("button", { name: "200" }).className).toMatch(/\bbg-white\b.*\btext-zinc-950\b/)
        expect(screen.getByRole("button", { name: "50" }).className).toMatch(/\btext-zinc-300\b/)
        const [, nameInput] = Array.from(document.querySelectorAll("input")) as HTMLInputElement[]
        fireEvent.change(nameInput, { target: { value: "QA" } })
        expect((screen.getByRole("button", { name: "Send tip" }) as HTMLButtonElement).disabled).toBe(false)
    })
})

describe("plat-p1-2 shared close button covers every stage panel", () => {
    it("ProfileStageClose always renders aria-label", () => {
        render(<ProfileStageClose onClose={() => {}} />)
        expect(screen.getByRole("button", { name: "Close" }).getAttribute("aria-label")).toBe("Close")
    })

    it("content panel (See services / About) + tip + checkout use the shared close", () => {
        for (const f of [
            "src/components/profile/content-panel.tsx",
            "src/components/profile/tip-sheet.tsx",
            "src/components/checkout/checkout-sheet.tsx",
        ]) {
            const src = readFileSync(join(root, f), "utf8")
            expect(src).toMatch(/<ProfileStageClose/)
            expect(src).not.toMatch(/<X\b/)
        }
    })
})
