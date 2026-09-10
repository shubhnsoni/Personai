"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react"
import { Pause, Play } from "lucide-react"
import "./brand-motion.css"

const preferenceKey = "introify-landing-motion"
const MotionContext = createContext({ enabled: false, toggle: () => {} })

export function useLandingMotion() {
    return useContext(MotionContext)
}

export function LandingMotion({ children }: { children: ReactNode }) {
    const root = useRef<HTMLDivElement>(null)
    const preference = useRef<boolean | null>(null)
    const [enabled, setEnabled] = useState(false)

    useEffect(() => {
        const media = typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null
        try {
            const saved = window.localStorage.getItem(preferenceKey)
            preference.current = saved === "on" ? true : saved === "off" ? false : null
        } catch {
            preference.current = null
        }
        const sync = () => setEnabled(preference.current ?? (media?.matches === false))
        const hasAnimationFrame = typeof window.requestAnimationFrame === "function"
            && typeof window.cancelAnimationFrame === "function"
        const initialFrame = hasAnimationFrame
            ? window.requestAnimationFrame(sync)
            : window.setTimeout(sync, 0)
        const onStorage = (event: StorageEvent) => {
            if (event.key !== preferenceKey) return
            preference.current = event.newValue === "on" ? true : event.newValue === "off" ? false : null
            sync()
        }
        if (media?.addEventListener) media.addEventListener("change", sync)
        else media?.addListener?.(sync)
        window.addEventListener("storage", onStorage)
        return () => {
            if (hasAnimationFrame) window.cancelAnimationFrame(initialFrame)
            else window.clearTimeout(initialFrame)
            if (media?.removeEventListener) media.removeEventListener("change", sync)
            else media?.removeListener?.(sync)
            window.removeEventListener("storage", onStorage)
        }
    }, [])

    useEffect(() => {
        const container = root.current
        if (!container) return
        const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]"))
        if (!enabled || typeof window.IntersectionObserver !== "function") {
            elements.forEach(element => element.removeAttribute("data-bm-reveal"))
            return
        }

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return
                entry.target.setAttribute("data-bm-reveal", "visible")
                observer.unobserve(entry.target)
            })
        }, { threshold: 0.08, rootMargin: "0px 0px -28px 0px" })

        // Server-rendered content stays visible. Only below-the-fold elements
        // are opted into reveals after motion preferences have been resolved.
        elements.forEach(element => {
            const rect = element.getBoundingClientRect()
            if (rect.top < window.innerHeight - 28 || element.dataset.bmReveal === "visible") {
                element.setAttribute("data-bm-reveal", "visible")
            } else {
                element.setAttribute("data-bm-reveal", "waiting")
                observer.observe(element)
            }
        })

        const revealFocused = (event: FocusEvent) => {
            if (!(event.target instanceof HTMLElement)) return
            let element = event.target.closest<HTMLElement>("[data-bm-reveal='waiting']")
            while (element && container.contains(element)) {
                element.setAttribute("data-bm-reveal", "visible")
                observer.unobserve(element)
                element = element.parentElement?.closest<HTMLElement>("[data-bm-reveal='waiting']") ?? null
            }
        }
        container.addEventListener("focusin", revealFocused)
        return () => {
            observer.disconnect()
            container.removeEventListener("focusin", revealFocused)
            elements.forEach(element => element.removeAttribute("data-bm-reveal"))
        }
    }, [enabled])

    const toggle = useCallback(() => {
        const next = !enabled
        preference.current = next
        setEnabled(next)
        try {
            window.localStorage.setItem(preferenceKey, next ? "on" : "off")
        } catch {
            // The in-memory choice still works when browser storage is unavailable.
        }
    }, [enabled])

    return (
        <MotionContext.Provider value={{ enabled, toggle }}>
            <div ref={root} className="bm-motion" data-bm-motion={enabled ? "on" : "off"}>
                {children}
            </div>
        </MotionContext.Provider>
    )
}

export function MotionToggle({
    pause = "Pause animations",
    resume = "Resume animations",
}: {
    pause?: string
    resume?: string
}) {
    const { enabled, toggle } = useLandingMotion()
    const Icon = enabled ? Pause : Play
    return (
        <button className="bm-motion-toggle" type="button" onClick={toggle}>
            <Icon size={13} strokeWidth={1.8} aria-hidden />
            <span>{enabled ? pause : resume}</span>
        </button>
    )
}
