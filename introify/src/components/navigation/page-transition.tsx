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
    const beganAt = useRef(0)
    const active = useRef(false)
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
        const reduced = prefersReducedMotion()
        // Only the decoration finishes its beat. Routing and interactions never wait.
        const remaining = reduced ? 0 : Math.max(0, 280 - (performance.now() - beganAt.current))
        timers.current.push(setTimeout(() => {
            if (sequence.current !== id) return
            setTransition({ id, phase: "leaving" })
            timers.current.push(setTimeout(() => {
                if (sequence.current !== id) return
                active.current = false
                destinationPath.current = null
                supersededPaths.current.clear()
                setTransition(null)
            }, reduced ? 0 : 320))
        }, remaining))
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
        beganAt.current = performance.now()
        active.current = true
        setTransition({ id, phase: "opening" })
        // A canceled navigation or network failure must never leave a permanent veil.
        timers.current.push(setTimeout(finish, 8000))
    }, [clearTimers, finish])

    useEffect(() => {
        if (previousPath.current === pathname) return
        previousPath.current = pathname
        const frame = requestAnimationFrame(() => {
            // Ignore a superseded route's late commit, but allow server redirects
            // to complete at a destination different from the clicked URL.
            if (!pathname || !supersededPaths.current.has(pathname) || pathname === destinationPath.current) finish()
            // Animate the content without wrapping it in a transformed ancestor:
            // fixed navigation, dialogs and mobile drawers keep their positioning.
            if (!prefersReducedMotion()) {
                document.querySelector("main")?.animate?.(
                    [{ opacity: 0.88 }, { opacity: 1 }],
                    { duration: 320, easing: "ease-out" },
                )
            }
        })
        return () => cancelAnimationFrame(frame)
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
                    <div className="page-transit-wash" aria-hidden="true" />
                    <div className="page-transit-center"><BrandLoadingVisual /></div>
                    <span className="sr-only">Loading page</span>
                </div>
            )}
        </TransitionContext.Provider>
    )
}
