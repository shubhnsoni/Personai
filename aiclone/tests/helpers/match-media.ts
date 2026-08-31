import { vi } from "vitest"

/**
 * An installable, controllable `window.matchMedia`.
 *
 * WHY IT IS NOT A GLOBAL POLYFILL
 * ------------------------------
 * jsdom does not implement matchMedia. tests/setup.ts deliberately leaves it that way, so a
 * component that calls matchMedia outside a browser-only path fails loudly instead of being handed
 * a silent "no preference" answer. Each test installs the media environment it is actually making a
 * claim about, and the claim is legible from the call site.
 *
 * The returned handle can flip a query's value and notify listeners, which is what makes
 * "component reacts to the user turning on Reduce Motion mid-session" testable rather than just
 * "component read the initial value".
 */
export function installMatchMedia(initial: Record<string, boolean> = {}) {
    const state = new Map(Object.entries(initial))
    const listeners = new Map<string, Set<(e: MediaQueryListEvent) => void>>()

    function listsFor(query: string) {
        let set = listeners.get(query)
        if (!set) {
            set = new Set()
            listeners.set(query, set)
        }
        return set
    }

    const matchMedia = vi.fn((query: string) => {
        const mql = {
            get matches() {
                return state.get(query) ?? false
            },
            media: query,
            onchange: null,
            addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
                listsFor(query).add(cb)
            },
            removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
                listsFor(query).delete(cb)
            },
            // The legacy pair is included because older code in this repository may still use it;
            // leaving them off would make a component look broken for the wrong reason.
            addListener: (cb: (e: MediaQueryListEvent) => void) => listsFor(query).add(cb),
            removeListener: (cb: (e: MediaQueryListEvent) => void) => listsFor(query).delete(cb),
            dispatchEvent: () => true,
        }
        return mql as unknown as MediaQueryList
    })

    vi.stubGlobal("matchMedia", matchMedia)

    return {
        matchMedia,
        /** Flip a query and notify anything subscribed to it. */
        set(query: string, matches: boolean) {
            state.set(query, matches)
            for (const cb of listsFor(query)) {
                cb({ matches, media: query } as MediaQueryListEvent)
            }
        },
        /** How many listeners are currently attached - used to assert cleanup on unmount. */
        listenerCount(query: string) {
            return listsFor(query).size
        },
    }
}

export const REDUCE_MOTION = "(prefers-reduced-motion: reduce)"
