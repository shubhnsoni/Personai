import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { act } from "react"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"
import { recordSnapshots } from "./helpers/commits"

// See tests/helpers/framer-motion-mock.tsx for the measured reason this is required and for an
// explicit statement of what the mock does and does not let this suite claim.
vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

const { ChatInterface } = await import("@/components/chat/chat-interface")

/**
 * ChatInterface intro and AskAboutLine behaviour.
 *
 * WHY THIS IS THE FIRST TIME THESE COULD BE TESTED
 * -----------------------------------------------
 * AskAboutLine is module-private and only rendered when the intro state machine reaches
 * stage === "ready". Reaching "ready" requires either matchMedia reporting Reduce Motion, or a chain
 * of setTimeouts (880 -> 360 -> per-character 160/110/70/42 -> 320 -> 1480 ms). Under
 * renderToStaticMarkup neither is possible: no matchMedia, no timers, no effects. So the component
 * stalled at "Hi!" and every assertion about the typing line was unreachable.
 *
 * With jsdom plus fake timers the machine can be driven to completion, which is what these tests do.
 */

const PROFILE = { id: "p1", slug: "ada", displayName: "Ada Lovelace" } as never

// ChatInterface builds its headline from profile.displayName, not from the `name` prop, so the
// expected string is derived from the fixture rather than guessed.
const INTRO_LINE = "Ada Lovelace's AI."

// The intro chain is 880 (hi->type) + 360 (lineVisible fallback) + per-character typing
// (160/110/70/42 ms over 23 characters) + 320 (type->orb) + 1480 (orb->ready). 9s of fake time is
// that chain plus generous slack; it costs nothing because the clock is simulated.
const INTRO_MS = 9000

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

/** Stubs the endpoints the chat mounts against so no test depends on a real network. */
function stubChatFetch() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: true,
            json: async () => ({}),
        })) as unknown as typeof fetch,
    )
}

/**
 * Advances fake timers in small slices inside act(), re-rendering between slices.
 *
 * A single large advanceTimersByTime is not enough for this component: each stage schedules the next
 * timeout only after React has re-rendered, so time has to move in steps that let React run.
 */
function advance(totalMs: number, sliceMs = 40) {
    for (let elapsed = 0; elapsed < totalMs; elapsed += sliceMs) {
        act(() => {
            vi.advanceTimersByTime(sliceMs)
        })
    }
}

/**
 * Advances until the topic line first appears, then stops.
 *
 * Advancing a fixed budget instead would be wrong for the per-character assertions: the intro chain
 * takes about 4.3s of fake time and the topic itself finishes typing roughly 700ms later, so any
 * budget generous enough to reach the line is also generous enough to finish it, and "is it still
 * typing" becomes unobservable. Stopping at first appearance leaves the typewriter mid-flight.
 */
function advanceToAskLine(maxMs = 15000, sliceMs = 40) {
    for (let elapsed = 0; elapsed < maxMs; elapsed += sliceMs) {
        act(() => {
            vi.advanceTimersByTime(sliceMs)
        })
        if (askLine() !== null) return true
    }
    return false
}

function askLine() {
    const node = Array.from(document.querySelectorAll("p")).find((p) =>
        p.textContent?.startsWith("Ask me about "),
    )
    return node ? (node.textContent ?? "").replace("Ask me about ", "") : null
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    stubChatFetch()
    localStorage.clear()
})

afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
})

describe("ChatInterface - reduced motion", () => {
    it("reaches the finished intro line when Reduce Motion is on", () => {
        installMatchMedia({ [REDUCE_MOTION]: true })
        renderChat()
        expect(document.body.textContent).toContain(INTRO_LINE)
    })

    it("shows the first topic in full, with no caret, when Reduce Motion is on", () => {
        installMatchMedia({ [REDUCE_MOTION]: true })
        renderChat({ topics: ["orbital mechanics", "analytical engines"] })
        expect(askLine()).toBe("orbital mechanics")
    })

    it("PRESENTS THE FINISHED INTRO IN THE FIRST FRAME under Reduce Motion", () => {
        // The lint error at chat-interface.tsx:694 is the reduce branch of the intro effect calling
        // setTyped/setLineVisible/setStage synchronously. A user who asked the OS for no animation
        // still gets one frame of "Hi!" before the line appears - the exact thing they opted out of.
        installMatchMedia({ [REDUCE_MOTION]: true })
        const { snapshots, Recorder } = recordSnapshots(() => document.body.textContent ?? "")
        render(
            <Recorder>
                <ChatInterface
                    profile={PROFILE}
                    welcome={null}
                    topics={[]}
                    chips={[]}
                    quickQuestions={[]}
                    colors={["#52E8FF", "#0A84FF"]}
                    animationConfig={{}}
                />
            </Recorder>,
        )
        expect(
            snapshots[0],
            `first committed frame: ${JSON.stringify(snapshots[0])} - under Reduce Motion the finished line must be in frame 1, not after a "Hi!" frame`,
        ).toContain(INTRO_LINE)
    })
})

describe("ChatInterface - the typing intro when motion is allowed", () => {
    it("starts on Hi! and reaches the full line and the topic line through its timer chain", () => {
        installMatchMedia({ [REDUCE_MOTION]: false })
        renderChat({ topics: ["orbital mechanics"] })
        expect(document.body.textContent).toContain("Hi!")
        expect(askLine()).toBeNull()

        // 880 (hi->type) + 360 (line visible) + ~17 chars of typing + 320 (type->orb) + 1480
        // (orb->ready) with slack.
        advance(INTRO_MS)

        expect(document.body.textContent).toContain(INTRO_LINE)
        expect(askLine()).not.toBeNull()
    })

    it("types the topic one character at a time rather than appearing at once", () => {
        installMatchMedia({ [REDUCE_MOTION]: false })
        renderChat({ topics: ["orbital mechanics"] })
        expect(advanceToAskLine()).toBe(true)

        const first = askLine()
        expect(first).not.toBeNull()
        expect(
            first!.length,
            `the line should still be partway through typing, got ${JSON.stringify(first)}`,
        ).toBeLessThan("orbital mechanics".length)

        advance(1200)
        const later = askLine()
        expect(later!.length).toBeGreaterThan(first!.length)
    })

    it("cycles to the second topic after typing, holding and deleting the first", () => {
        installMatchMedia({ [REDUCE_MOTION]: false })
        renderChat({ topics: ["alpha", "omega"] })
        expect(advanceToAskLine()).toBe(true)

        // Type "alpha" (~5 chars), hold 1600, delete (~26ms each), then start "omega".
        let sawOmegaStart = false
        for (let i = 0; i < 200 && !sawOmegaStart; i++) {
            advance(40, 40)
            const line = askLine()
            if (line && line.length > 0 && "omega".startsWith(line)) sawOmegaStart = true
        }
        expect(sawOmegaStart, "the line must advance to the second topic").toBe(true)
    })
})

/**
 * THE MATCHMEDIA-UPDATE TEST - tied to the lint error at chat-interface.tsx:872.
 *
 * `setReduce(window.matchMedia(...).matches)` in a mount effect with an empty dependency array reads
 * the preference EXACTLY ONCE and never subscribes. Turning on Reduce Motion while the page is open
 * therefore has no effect: the animation keeps running for a user who has just asked it to stop.
 * matchMedia is an external store, so reading it with a subscription is both the fix for the lint
 * error and the fix for that defect.
 */
describe("ChatInterface - responds to Reduce Motion being switched on mid-session", () => {
    it("stops animating when the preference changes after mount", () => {
        const media = installMatchMedia({ [REDUCE_MOTION]: false })
        renderChat({ topics: ["orbital mechanics", "analytical engines"] })
        expect(advanceToAskLine()).toBe(true)
        // The line appears empty and fills in; advance far enough that some characters exist but
        // not far enough to finish, so "still typing" is a real state to interrupt.
        advance(200)

        const partial = askLine()
        expect(partial).not.toBeNull()
        expect(partial!.length).toBeLessThan("orbital mechanics".length)

        act(() => {
            media.set(REDUCE_MOTION, true)
        })

        expect(
            askLine(),
            "after the user turns on Reduce Motion the line must settle on the whole topic instead of continuing to type",
        ).toBe("orbital mechanics")

        // And it must stay settled rather than resuming on the next tick.
        advance(400)
        expect(askLine()).toBe("orbital mechanics")
    })
})

/**
 * THE MEMO-KEY COLLISION TEST - tied to the lint error at chat-interface.tsx:865.
 *
 * `useMemo(() => resolveAskTopics(welcome, topics), [welcome, topicKey])` where
 * `topicKey = topics.join("|")`. The key is not injective: ["a|b"] and ["a","b"] both join to
 * "a|b". resolveAskTopics treats them differently - it cleans each entry without splitting on "|" -
 * so when the parent re-renders with one shape after the other, the memo hands back the previous,
 * wrong topic list and keeps doing so forever.
 */
describe("ChatInterface - the topic list must not go stale on a colliding key", () => {
    it("updates the topics when two different topic arrays share a joined key", () => {
        installMatchMedia({ [REDUCE_MOTION]: true })
        const { rerender } = renderChat({ topics: ["alpha", "beta"] })
        expect(askLine()).toBe("alpha")

        // ["alpha|beta"].join("|") === ["alpha","beta"].join("|"), but the resolved topic differs:
        // a single topic literally named "alpha|beta".
        rerender(
            <ChatInterface
                profile={PROFILE}
                welcome={null}
                topics={["alpha|beta"]}
                chips={[]}
                quickQuestions={[]}
                colors={["#52E8FF", "#0A84FF"]}
                animationConfig={{}}
            />,
        )

        expect(
            askLine(),
            "the joined-key memo returned the previous topic list because the two arrays collide",
        ).toBe("alpha|beta")
    })

    it("does not restart the animation when the parent re-renders with an equal topic list", () => {
        // The other candidate repair for :865 - putting `topics` itself in the dependency array -
        // would break this, because a parent passing a fresh array literal on every render would
        // give `items` a new identity every render and restart the typewriter from zero. Any fix has
        // to satisfy BOTH this test and the collision test above.
        installMatchMedia({ [REDUCE_MOTION]: false })
        const { rerender } = renderChat({ topics: ["orbital mechanics"] })
        expect(advanceToAskLine()).toBe(true)
        advance(200)
        const before = askLine()
        expect(before).not.toBeNull()
        expect(before!.length).toBeGreaterThan(0)

        for (let i = 0; i < 5; i++) {
            rerender(
                <ChatInterface
                    profile={PROFILE}
                    welcome={null}
                    // A NEW array with the SAME contents, which is what a parent component
                    // constructing props inline actually does.
                    topics={["orbital mechanics"]}
                    chips={[]}
                    quickQuestions={[]}
                    colors={["#52E8FF", "#0A84FF"]}
                    animationConfig={{}}
                />,
            )
        }
        advance(400)
        const after = askLine()
        expect(
            after!.length,
            "re-rendering the parent must not reset the typewriter to zero characters",
        ).toBeGreaterThanOrEqual(before!.length)
    })
})
