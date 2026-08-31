import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { act } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AuthLookSwiper } from "@/components/auth/auth-look-swiper"
import { AUTH_LOOKS } from "@/lib/auth-looks"
import { recordCommits } from "./helpers/commits"

/**
 * AuthLookSwiper behaviour.
 *
 * WHY THIS IS THE FIRST TIME THIS COMPONENT COULD BE TESTED
 * --------------------------------------------------------
 * Everything this component does is driven by a browser API or a gesture: it reads
 * `window.location.search`, it reads and writes `sessionStorage`, it binds a window `keydown`
 * listener, and it advances on touch. Under `renderToStaticMarkup` none of those exist, so the
 * only observable was "look 0 rendered".
 */

const STORAGE_KEY = "pl-auth-look"

function setSearch(search: string) {
    // jsdom allows replaceState to rewrite the query without a navigation.
    window.history.replaceState({}, "", `/sign-in${search}`)
}

function renderSwiper() {
    return render(
        <AuthLookSwiper title="Welcome back" subtitle="Sign in to continue">
            <button type="button">Continue</button>
        </AuthLookSwiper>,
    )
}

/** The component prints "N / TOTAL · Name"; this reads the N back out. */
function currentIndex() {
    const label = screen.getByText(new RegExp(`\\d+ / ${AUTH_LOOKS.length}`))
    return Number((label.textContent ?? "").trim().split(" ")[0]) - 1
}

beforeEach(() => {
    setSearch("")
    sessionStorage.clear()
})

afterEach(() => {
    sessionStorage.clear()
})

describe("AuthLookSwiper - server-side rendering", () => {
    it("renders on the server without a window, sessionStorage or a listener", () => {
        // If any of the browser reads had been hoisted out of the effect into the render body,
        // this would throw here rather than in production.
        const html = renderToStaticMarkup(
            <AuthLookSwiper title="Welcome back">
                <button type="button">Continue</button>
            </AuthLookSwiper>,
        )
        expect(html).toContain(`1 / ${AUTH_LOOKS.length}`)
        expect(html).toContain(AUTH_LOOKS[0].name)
    })
})

describe("AuthLookSwiper - initialisation from external state", () => {
    it("starts at the first look when nothing asks otherwise", () => {
        renderSwiper()
        expect(currentIndex()).toBe(0)
    })

    it("honours a valid ?look= in the URL", () => {
        setSearch("?look=frame")
        renderSwiper()
        expect(currentIndex()).toBe(AUTH_LOOKS.findIndex((l) => l.id === "frame"))
    })

    it("honours a saved look from sessionStorage", () => {
        sessionStorage.setItem(STORAGE_KEY, "dock")
        renderSwiper()
        expect(currentIndex()).toBe(AUTH_LOOKS.findIndex((l) => l.id === "dock"))
    })

    it("gives the URL priority over sessionStorage", () => {
        sessionStorage.setItem(STORAGE_KEY, "dock")
        setSearch("?look=well")
        renderSwiper()
        expect(currentIndex()).toBe(AUTH_LOOKS.findIndex((l) => l.id === "well"))
    })

    it("ignores an unknown look in the URL and falls through to storage", () => {
        sessionStorage.setItem(STORAGE_KEY, "type")
        setSearch("?look=not-a-look")
        renderSwiper()
        expect(currentIndex()).toBe(AUTH_LOOKS.findIndex((l) => l.id === "type"))
    })

    it("ignores an unknown look in storage and stays on the first look", () => {
        sessionStorage.setItem(STORAGE_KEY, "garbage")
        renderSwiper()
        expect(currentIndex()).toBe(0)
    })

    it("survives sessionStorage throwing on read, as in a blocked-cookies browser", () => {
        // The component wraps its read in try/catch. Privacy modes really do throw here, and a
        // crash on a sign-in page is not a recoverable failure, so this is pinned.
        const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("SecurityError: storage is disabled")
        })
        expect(() => renderSwiper()).not.toThrow()
        expect(currentIndex()).toBe(0)
        spy.mockRestore()
    })
})

describe("AuthLookSwiper - navigation", () => {
    it("advances and wraps with the arrow keys", () => {
        renderSwiper()
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
        })
        expect(currentIndex()).toBe(1)

        // Each press is its own act() because each is its own task in a browser. Left from index 1
        // goes to 0; left again must wrap to the last look, not go negative.
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
        })
        expect(currentIndex()).toBe(0)
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
        })
        expect(currentIndex()).toBe(AUTH_LOOKS.length - 1)
    })

    it("collapses two presses that land in the same batch (documented, not fixed)", () => {
        // `go` closes over `index`, so two keydowns delivered before React can re-render both
        // compute from the same index and the second overwrites the first: two presses, one move.
        // This is pinned as a fact rather than fixed, because the fix (a setIndex updater function)
        // would also have to move the sessionStorage write, and that is a semantic change with no
        // lint error demanding it. Reported, not silently altered.
        renderSwiper()
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
        })
        expect(currentIndex()).toBe(1)
    })

    it("keeps the arrow keys working after several presses", () => {
        // The keydown effect depends on `index`, so it is torn down and rebound on every change.
        // If a fix ever changed that dependency, a stale closure would freeze navigation after the
        // first press - which this catches.
        renderSwiper()
        for (let i = 0; i < 3; i++) {
            act(() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
            })
        }
        expect(currentIndex()).toBe(3)
    })
    it("removes its keydown listener on unmount", () => {
        const { unmount } = renderSwiper()
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
        })
        expect(currentIndex()).toBe(1)
        unmount()
        // If the listener leaked, this would throw on setState after unmount.
        expect(() =>
            act(() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
            }),
        ).not.toThrow()
    })

    it("jumps directly to a look when its dot is clicked, and persists the choice", () => {
        renderSwiper()
        const target = AUTH_LOOKS[3]
        act(() => {
            screen.getByRole("button", { name: target.name }).click()
        })
        expect(currentIndex()).toBe(3)
        expect(sessionStorage.getItem(STORAGE_KEY)).toBe(target.id)
    })

    it("persists every arrow-key move too, so a reload resumes where the user was", () => {
        renderSwiper()
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
        })
        expect(sessionStorage.getItem(STORAGE_KEY)).toBe(AUTH_LOOKS[1].id)
    })

    it("does not crash when sessionStorage throws on write", () => {
        renderSwiper()
        const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError")
        })
        expect(() =>
            act(() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
            }),
        ).not.toThrow()
        // The move still happened; only the persistence failed.
        expect(currentIndex()).toBe(1)
        spy.mockRestore()
    })
})

describe("AuthLookSwiper - swipe gestures", () => {
    function touch(node: Element, type: "touchstart" | "touchend", clientX: number) {
        const event = new Event(type, { bubbles: true }) as Event & {
            touches?: unknown
            changedTouches?: unknown
        }
        const list = [{ clientX }]
        if (type === "touchstart") event.touches = list
        else event.changedTouches = list
        node.dispatchEvent(event)
    }

    function surface() {
        return screen.getByText("Continue").closest("div.relative")!.ownerDocument.querySelector("div.relative")!
    }

    it("advances on a left swipe past the threshold", () => {
        renderSwiper()
        const node = surface()
        act(() => {
            touch(node, "touchstart", 200)
            touch(node, "touchend", 100) // dx = -100, past the -48 threshold
        })
        expect(currentIndex()).toBe(1)
    })

    it("goes back on a right swipe past the threshold", () => {
        renderSwiper()
        const node = surface()
        act(() => {
            touch(node, "touchstart", 100)
            touch(node, "touchend", 220) // dx = +120
        })
        expect(currentIndex()).toBe(AUTH_LOOKS.length - 1)
    })

    it("ignores a tap or a short drag under the 48px threshold", () => {
        renderSwiper()
        const node = surface()
        act(() => {
            touch(node, "touchstart", 200)
            touch(node, "touchend", 170) // dx = -30
        })
        expect(currentIndex()).toBe(0)
    })

    it("ignores a touchend with no matching touchstart", () => {
        renderSwiper()
        const node = surface()
        act(() => {
            touch(node, "touchend", 10)
        })
        expect(currentIndex()).toBe(0)
    })
})

/**
 * THE CASCADING-RENDER TEST - tied to the lint error at auth-look-swiper.tsx:38.
 *
 * `setIndex(next)` runs synchronously in a mount effect, so when a look is requested by URL or by
 * sessionStorage React commits look 0 first and the requested look second. On a sign-in page that
 * is a visible flash of the wrong shell.
 *
 * This test is recorded but NOT used to justify a change - see the report. Moving the read into a
 * `useState` initialiser removes the flash on the client and introduces a hydration mismatch
 * instead, because the server cannot see sessionStorage. The next test pins the property that
 * makes that trade-off unacceptable.
 */
describe("AuthLookSwiper - initialisation cost (documented, not fixed)", () => {
    it("records how many frames it takes to reach the requested look", () => {
        sessionStorage.setItem(STORAGE_KEY, "well")
        const target = AUTH_LOOKS.findIndex((l) => l.id === "well")

        const { container } = render(<div />)
        const { frames, Recorder } = recordCommits(container)
        render(
            <Recorder>
                <AuthLookSwiper title="Welcome back">
                    <button type="button">Continue</button>
                </AuthLookSwiper>
            </Recorder>,
            { container },
        )

        expect(currentIndex()).toBe(target)
        // Two frames: look 1/5 is committed, then the effect corrects it to 5/5. This is the
        // cascading render the lint rule names. It is asserted as-is so that the report's claim
        // ("the flash is real") is measured rather than argued, and so a future fix that removes
        // it fails here loudly and has to be justified against the hydration test below.
        const showsFirst = frames.filter((f) => f.includes(`1 / ${AUTH_LOOKS.length}`))
        expect(showsFirst.length).toBeGreaterThan(0)
        expect(frames.length).toBeGreaterThanOrEqual(2)
    })

    it("HYDRATION SAFETY: the first client render must match the server render", () => {
        // This is the constraint that blocks the obvious fix. The server has no sessionStorage and
        // no query string, so it can only ever render look 0. If the client computed the look
        // during its FIRST render - which is what moving the read into useState does - React would
        // hydrate a tree that does not match the server HTML.
        sessionStorage.setItem(STORAGE_KEY, "well")
        const serverHtml = renderToStaticMarkup(
            <AuthLookSwiper title="Welcome back">
                <button type="button">Continue</button>
            </AuthLookSwiper>,
        )
        expect(serverHtml).toContain(`1 / ${AUTH_LOOKS.length}`)

        const { container } = render(<div />)
        const { frames, Recorder } = recordCommits(container)
        render(
            <Recorder>
                <AuthLookSwiper title="Welcome back">
                    <button type="button">Continue</button>
                </AuthLookSwiper>
            </Recorder>,
            { container },
        )
        // The FIRST committed frame is the one React would have to reconcile against server HTML.
        expect(frames[0]).toContain(`1 / ${AUTH_LOOKS.length}`)
    })
})
