import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import {
    ABOUT_BODY_CLASS,
    ABOUT_SCROLL_CLASS,
    ABOUT_WRAP_TEXT,
    ContentPanel,
} from "@/components/profile/content-panel"

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

/**
 * plat-p1-1 - About modal body text clipped at the right edge (Paras, MK, Goodwill, cross-kit).
 *
 * Root cause: Radix ScrollArea renders its children inside `display: table; min-width: 100%`.
 * A table grows to its min-content width, so the `truncate` (nowrap) headline - e.g. Paras's
 * "Spare parts on Namkum Main Road, Doranda - ask with make, model, and year." - stretched the
 * wrapper past the panel, and the bio paragraphs then wrapped at that wider width and were
 * clipped by the overflow-hidden stage ("ask with ma..."). Fix once in the shared About view:
 * force the Radix wrapper to a block, and make every About text node wrap instead of nowrap.
 *
 * jsdom has no layout, so this asserts classes; the live check measures scrollWidth.
 */

const PARAS_HEADLINE = "Spare parts on Namkum Main Road, Doranda — ask with make, model, and year."

function data(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        displayName: "Paras Auto Parts",
        slug: "paras-auto",
        headline: PARAS_HEADLINE,
        bio: "Genuine and OEM-equivalent parts for Maruti, Hyundai, Tata and Mahindra. Ask with make, model, and year and we confirm fitment before you drive over.",
        roleTemplate: "AUTO_PARTS",
        contentDisplayMode: "POPUP",
        imageUrl: "/uploads/paras-auto/mark.png",
        workExperiences: [],
        projects: [],
        serviceOfferings: [],
        ...overrides,
    }
}

const NOWRAP = /(^|\s)(truncate|whitespace-nowrap|text-ellipsis|overflow-ellipsis|line-clamp-\d+)(\s|$)/

function renderAbout(overrides: Partial<Record<string, unknown>> = {}) {
    render(<ContentPanel isOpen onClose={() => {}} type="about" data={data(overrides) as never} />)
    const q = (sel: string) => document.querySelector(sel) as HTMLElement | null
    return {
        scroll: q("[data-about-scroll]"),
        body: q("[data-about-body]"),
        name: q("[data-about-name]"),
        headline: q("[data-about-headline]"),
        bio: q("[data-about-bio]"),
    }
}

describe("plat-p1-1 About modal wraps (no right-edge clip)", () => {
    it("shared wrap class carries min-w-0 + break-words + overflow-wrap:anywhere", () => {
        expect(ABOUT_WRAP_TEXT).toMatch(/\bmin-w-0\b/)
        expect(ABOUT_WRAP_TEXT).toMatch(/\bbreak-words\b/)
        expect(ABOUT_WRAP_TEXT).toContain("[overflow-wrap:anywhere]")
        expect(ABOUT_WRAP_TEXT).not.toMatch(NOWRAP)
    })

    it("scroll area neutralises the Radix display:table wrapper and hides horizontal overflow", () => {
        expect(ABOUT_SCROLL_CLASS).toContain("[&_[data-radix-scroll-area-viewport]>div]:block!")
        expect(ABOUT_SCROLL_CLASS).toContain("[&_[data-radix-scroll-area-viewport]>div]:min-w-0!")
        expect(ABOUT_SCROLL_CLASS).toContain("[&_[data-radix-scroll-area-viewport]]:overflow-x-hidden!")
        expect(ABOUT_SCROLL_CLASS).toMatch(/\bmin-w-0\b/)
        expect(ABOUT_BODY_CLASS).toMatch(/\bmin-w-0\b/)
        expect(ABOUT_BODY_CLASS).toMatch(/\bw-full\b/)
    })

    it("renders name, headline, and bio with wrapping classes and no truncate/nowrap", () => {
        const { scroll, body, name, headline, bio } = renderAbout()
        expect(scroll?.className).toContain("[data-radix-scroll-area-viewport]>div]:block!")
        expect(body?.className).toMatch(/\bmin-w-0\b/)
        for (const node of [name, headline, bio]) {
            expect(node).toBeTruthy()
            expect(node!.className).toMatch(/\bbreak-words\b/)
            expect(node!.className).toMatch(/\bmin-w-0\b/)
            expect(node!.className).not.toMatch(NOWRAP)
        }
        expect(headline?.textContent).toBe(PARAS_HEADLINE)
        expect(headline?.textContent).toContain("ask with make")
    })

    it("same shared view for MK, Goodwill, and a salon kit (fix once, not per kit)", () => {
        for (const kit of [
            { slug: "mk-jewellers", displayName: "MK Jewellers", roleTemplate: "JEWELRY_RETAIL", imageUrl: "/uploads/mk-jewellers/mark.png" },
            { slug: "goodwill-plumbing", displayName: "Goodwill Plumbing & Electricals", roleTemplate: "FIELD_SERVICE" },
            { slug: "glow-salon", displayName: "Glow Salon", roleTemplate: "SALON_SPA" },
        ]) {
            document.body.innerHTML = ""
            const { headline, bio } = renderAbout(kit)
            expect(headline!.className, kit.slug).not.toMatch(NOWRAP)
            expect(bio!.className, kit.slug).toMatch(/\bbreak-words\b/)
        }
    })

    it("About imagery (mark.png avatar) still renders", () => {
        renderAbout()
        const img = document.querySelector("[data-about-body] img") as HTMLImageElement | null
        expect(img?.getAttribute("src")).toBe("/uploads/paras-auto/mark.png")
    })

    it("AboutView source has no truncate/nowrap on body text", () => {
        const src = readFileSync(join(__dirname, "..", "src", "components", "profile", "content-panel.tsx"), "utf8")
        const start = src.indexOf("function AboutView(")
        expect(start).toBeGreaterThan(0)
        const end = src.indexOf("\nfunction ", start + 10)
        const about = src.slice(start, end > 0 ? end : undefined)
        expect(about).not.toMatch(/\btruncate\b/)
        expect(about).not.toMatch(/whitespace-nowrap/)
        expect(about).not.toMatch(/text-ellipsis/)
    })
})
