import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { act } from "react"
import { recordSnapshots } from "./helpers/commits"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"

/**
 * ProfileView checkout-success banner behaviour.
 *
 * TWO INHERITED CLAIMS ABOUT THIS FILE WERE CHECKED AND ARE WRONG
 * ---------------------------------------------------------------
 * 1. "the module cannot be imported without a generated Prisma client" - it imports fine; see
 *    tests/importability.test.ts, which pins that.
 * 2. "under Next static rendering useSearchParams() is empty at prerender" - true in general, but
 *    NOT for this route. src/app/[slug]/page.tsx declares `export const dynamic = 'force-dynamic'`
 *    and `next build` reports /[slug] as dynamic (server-rendered on demand), so the query string
 *    IS available during SSR. That is what makes it safe to derive the banner from the URL during
 *    render instead of mirroring it into state from an effect.
 *
 * `next/navigation` is mocked because useSearchParams() needs Next's router context, which does not
 * exist outside a Next render. The mock returns a real URLSearchParams, so the component's own
 * `.get('checkout')` logic is exercised rather than stubbed.
 */

let search = new URLSearchParams()

vi.mock("next/navigation", () => ({
    useSearchParams: () => search,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/ada",
}))

const { ProfileView } = await import("@/components/profile/profile-view")

const PROFILE = {
    id: "p1",
    slug: "ada",
    displayName: "Ada Lovelace",
    headline: "Mathematician",
    bio: "First programmer.",
    welcomeMessageOverride: null,
    contentDisplayMode: "chat",
    workExperiences: [],
    projects: [],
    serviceOfferings: [],
} as unknown as Parameters<typeof ProfileView>[0]["profile"]

function renderProfile() {
    return render(<ProfileView profile={PROFILE} animationConfig={{}} colors={["#52E8FF"]} />)
}

const BANNER = "You're in"

beforeEach(() => {
    search = new URLSearchParams()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    window.history.replaceState({}, "", "/ada")
    // ProfileView renders ChatInterface, whose intro effect calls matchMedia. Reduce Motion is set
    // to true so the intro animation collapses to its final state immediately and these tests are
    // about the banner rather than about a 3-second typing sequence. The animation itself is tested
    // in tests/chat-interface.test.tsx.
    installMatchMedia({ [REDUCE_MOTION]: true })
})

afterEach(() => {
    vi.useRealTimers()
})

describe("ProfileView - checkout success banner", () => {
    it("does not show the banner without ?checkout=success", () => {
        renderProfile()
        expect(screen.queryByText(BANNER)).toBeNull()
    })

    it("ignores a checkout value that is not 'success'", () => {
        search = new URLSearchParams("checkout=cancelled")
        renderProfile()
        expect(screen.queryByText(BANNER)).toBeNull()
    })

    it("shows the banner when the URL says the checkout succeeded", () => {
        search = new URLSearchParams("checkout=success")
        renderProfile()
        expect(screen.getByText(BANNER)).toBeTruthy()
    })

    it("hides the banner and cleans the URL after five seconds", () => {
        search = new URLSearchParams("checkout=success")
        window.history.replaceState({}, "", "/ada?checkout=success")
        renderProfile()
        expect(screen.getByText(BANNER)).toBeTruthy()

        act(() => {
            vi.advanceTimersByTime(4999)
        })
        expect(screen.queryByText(BANNER), "banner must survive until the full 5s").toBeTruthy()

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(screen.queryByText(BANNER)).toBeNull()
        // The component rewrites the URL so a refresh does not replay the banner.
        expect(window.location.pathname + window.location.search).toBe("/ada")
    })

    it("can be dismissed by hand before the timer fires, and stays dismissed", () => {
        search = new URLSearchParams("checkout=success")
        renderProfile()
        const closeButton = screen.getByText(BANNER).closest("div")!.parentElement!.querySelector("button")!
        act(() => {
            closeButton.click()
        })
        expect(screen.queryByText(BANNER)).toBeNull()

        // The timer still fires later; it must not resurrect the banner.
        act(() => {
            vi.advanceTimersByTime(6000)
        })
        expect(screen.queryByText(BANNER)).toBeNull()
    })

    it("does not leave the timer running after unmount", () => {
        search = new URLSearchParams("checkout=success")
        const { unmount } = renderProfile()
        unmount()
        expect(() =>
            act(() => {
                vi.advanceTimersByTime(6000)
            }),
        ).not.toThrow()
    })
})

/**
 * THE CASCADING-RENDER TEST - tied to the lint error at profile-view.tsx:135.
 *
 * `setShowSuccessNotification(true)` runs synchronously in the effect body, so on a successful
 * checkout React commits one frame WITHOUT the banner and then a second one with it. The user has
 * just paid; the first thing the page renders is the state in which nothing happened.
 *
 * Because /[slug] is force-dynamic the server sees ?checkout=success too, which means the server
 * HTML contains the banner while the first client commit does NOT - so this cascade is also a
 * hydration mismatch, not merely a flash.
 */
describe("ProfileView - the banner must be present in the first committed frame", () => {
    it("commits the banner immediately rather than one frame late", () => {
        search = new URLSearchParams("checkout=success")
        const { snapshots, Recorder } = recordSnapshots(() =>
            document.body.textContent?.includes(BANNER) ?? false,
        )
        render(
            <Recorder>
                <ProfileView profile={PROFILE} animationConfig={{}} colors={["#52E8FF"]} />
            </Recorder>,
        )
        expect(
            snapshots[0],
            `banner-present per commit: ${JSON.stringify(snapshots)} - the first frame must already show it, both to avoid a flash after payment and because the force-dynamic server render contains it`,
        ).toBe(true)
    })
})
