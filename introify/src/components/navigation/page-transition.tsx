"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { BrandLoadingVisual } from "./brand-loading"

type Transition = { id: number; phase: "opening" | "leaving" }
const TransitionContext = createContext<(href: string) => void>(() => {})
const prefersReducedMotion = () => typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function usePageTransition() {
    return useContext(TransitionContext)
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const previousPath = useRef(pathname)
    const sequence = useRef(0)
    const active = useRef(false)
    const visible = useRef(false)
    const contentAnimation = useRef<Animation | null>(null)
    const destinationPath = useRef<string | null>(null)
    const supersededPaths = useRef(new Set<string>())
    const timers = useRef<ReturnType<typeof setTimeout>[]>([])
    const [transition, setTransition] = useState<Transition | null>(null)

    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout)
        timers.current = []
    }, [])

    const finish = useCallback(() => {
        if (!active.current) return
        clearTimers()
        const id = sequence.current
        const reset = () => {
            if (sequence.current !== id) return
            active.current = false
            visible.current = false
            destinationPath.current = null
            supersededPaths.current.clear()
            setTransition(null)
        }
        // Fast routes never show a loader. Visible feedback only fades away;
        // there is no minimum display time and routing never waits for it.
        if (!visible.current || prefersReducedMotion()) { reset(); return }
        setTransition({ id, phase: "leaving" })
        timers.current.push(setTimeout(reset, 120))
    }, [clearTimers])

    const start = useCallback((href: string) => {
        const destination = new URL(href, window.location.href)
        if (destination.origin !== window.location.origin) return
        if (destination.pathname === previousPath.current) {
            finish()
            return
        }
        clearTimers()
        if (destinationPath.current) supersededPaths.current.add(destinationPath.current)
        supersededPaths.current.delete(destination.pathname)
        destinationPath.current = destination.pathname
        const id = ++sequence.current
        active.current = true
        if (visible.current) {
            setTransition({ id, phase: "opening" })
        } else {
            timers.current.push(setTimeout(() => {
                if (sequence.current !== id || !active.current) return
                visible.current = true
                setTransition({ id, phase: "opening" })
            }, 180))
        }
        // A canceled navigation or network failure cannot leave stale feedback.
        timers.current.push(setTimeout(finish, 8000))
    }, [clearTimers, finish])

    useEffect(() => {
        if (previousPath.current === pathname) return
        previousPath.current = pathname
        // Cancel the delayed reveal at commit, before the next animation frame.
        // Ignore superseded commits while still accepting server redirects.
        if (!pathname || !supersededPaths.current.has(pathname) || pathname === destinationPath.current) finish()
        const frame = requestAnimationFrame(() => {
            // Animate the content without wrapping it in a transformed ancestor:
            // fixed navigation, dialogs and mobile drawers keep their positioning.
            if (!prefersReducedMotion()) {
                contentAnimation.current?.cancel?.()
                contentAnimation.current = document.querySelector("main")?.animate?.(
                    [{ opacity: 0.96 }, { opacity: 1 }],
                    { duration: 120, easing: "ease-out" },
                ) ?? null
            }
        })
        return () => {
            cancelAnimationFrame(frame)
            contentAnimation.current?.cancel?.()
            contentAnimation.current = null
        }
    }, [pathname, finish])

    useEffect(() => {
        const onHistory = () => start(window.location.href)
        const onPageShow = () => finish()
        window.addEventListener("popstate", onHistory)
        window.addEventListener("pageshow", onPageShow)
        return () => {
            window.removeEventListener("popstate", onHistory)
            window.removeEventListener("pageshow", onPageShow)
            clearTimers()
        }
    }, [start, finish, clearTimers])

    return (
        <TransitionContext.Provider value={start}>
            {children}
            {transition && (
                <div key={transition.id} className="page-transit" data-phase={transition.phase} role="status" aria-live="polite">
                    <BrandLoadingVisual complete={transition.phase === "leaving"} />
                    <span className="sr-only">Loading page</span>
                </div>
            )}
        </TransitionContext.Provider>
    )
}
