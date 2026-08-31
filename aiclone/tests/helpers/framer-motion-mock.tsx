import { createElement, forwardRef, type ReactNode } from "react"

/**
 * A minimal framer-motion stand-in.
 *
 * WHY IT IS NECESSARY, MEASURED NOT ASSUMED
 * -----------------------------------------
 * ChatInterface wraps its intro stages in `<AnimatePresence mode="wait">`. In "wait" mode
 * AnimatePresence will not mount the incoming child until the outgoing child's exit animation has
 * finished, and framer-motion drives that with requestAnimationFrame. Under fake timers rAF never
 * advances, so the exit never completes and the incoming child never mounts: the entire tree stays
 * frozen on "Hi!" forever. Measured directly - without this mock every intro assertion failed with
 * `document.body.textContent === "Hi!"`, including the Reduce Motion cases where the component's own
 * logic had already set stage to "ready".
 *
 * Real timers are not an alternative worth taking: the intro chain is 880 + 360 + per-character +
 * 320 + 1480 ms and the typewriter runs at 26-70 ms per character, so every test would take seconds
 * of wall clock and none of the per-character assertions would be deterministic.
 *
 * WHAT THIS MOCK DOES AND DOES NOT PROVE - stated so the suite is not read as claiming more than it
 * shows:
 *   - PROVES: the stage state machine, its timer chain, the typewriter, matchMedia handling, and the
 *     conditional rendering keyed off stage. These are plain React and are what the lint errors are
 *     about.
 *   - DOES NOT PROVE: that the opacity/blur/y transitions look right, that exit animations sequence
 *     correctly, or that `onExitComplete` fires. AnimatePresence here mounts children immediately
 *     and never calls onExitComplete, which is the pessimistic case for this component: it forces
 *     the 360 ms `setLineVisible` fallback timer to be the thing that advances the intro, so the
 *     tests exercise the fallback path rather than the happy path.
 */

const ANIMATION_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "custom",
    "layout",
    "layoutId",
    "layoutDependency",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileDrag",
    "whileInView",
    "viewport",
    "drag",
    "dragConstraints",
    "dragElastic",
    "dragMomentum",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "onDragEnd",
    "onDragStart",
])

function strip(props: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
        if (ANIMATION_PROPS.has(key)) continue
        if (key === "style" && value && typeof value === "object") {
            // A motion `style` can hold MotionValue objects, which React cannot render as CSS.
            const style: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                if (typeof v === "string" || typeof v === "number") style[k] = v
            }
            out.style = style
            continue
        }
        out[key] = value
    }
    return out
}

const cache = new Map<string, unknown>()

export const motion: Record<string, unknown> = new Proxy(
    {},
    {
        get(_target, tag: string) {
            if (!cache.has(tag)) {
                const Component = forwardRef<unknown, Record<string, unknown>>((props, ref) =>
                    createElement(tag, { ...strip(props), ref }),
                )
                Component.displayName = `motion.${tag}`
                cache.set(tag, Component)
            }
            return cache.get(tag)
        },
    },
)

export function AnimatePresence({ children }: { children?: ReactNode }) {
    return createElement(Fragmentish, null, children)
}

function Fragmentish({ children }: { children?: ReactNode }) {
    return children as never
}

export function useMotionValue<T>(initial: T) {
    let current = initial
    return {
        get: () => current,
        set: (next: T) => {
            current = next
        },
        on: () => () => {},
        destroy: () => {},
    }
}

export function useMotionTemplate() {
    return ""
}

export function useTransform() {
    return useMotionValue(0)
}

export function animate() {
    return { stop: () => {}, then: (cb: () => void) => cb() }
}

export function useReducedMotion() {
    return false
}

export function useInView() {
    return true
}
