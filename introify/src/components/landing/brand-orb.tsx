"use client"

import { useEffect, useRef, useState } from "react"
import { useLandingMotion } from "./brand-motion"
import "./brand-motion.css"

export function BrandOrb({ className = "", compact = false }: { className?: string; compact?: boolean }) {
    const root = useRef<HTMLDivElement>(null)
    const { enabled } = useLandingMotion()
    const [visible, setVisible] = useState(false)
    const [pageVisible, setPageVisible] = useState(true)

    useEffect(() => {
        const scene = root.current
        if (!scene) return
        const syncPage = () => setPageVisible(!document.hidden)
        const hasObserver = typeof window.IntersectionObserver === "function"
        const hasAnimationFrame = typeof window.requestAnimationFrame === "function"
            && typeof window.cancelAnimationFrame === "function"
        const syncInitial = () => {
            syncPage()
            if (!hasObserver) setVisible(true)
        }
        const initialFrame = hasAnimationFrame
            ? window.requestAnimationFrame(syncInitial)
            : window.setTimeout(syncInitial, 0)
        document.addEventListener("visibilitychange", syncPage)
        const observer = hasObserver ? new IntersectionObserver(entries => {
            setVisible(entries[0].isIntersecting)
        }, { threshold: 0.01 }) : null
        observer?.observe(scene)
        return () => {
            if (hasAnimationFrame) window.cancelAnimationFrame(initialFrame)
            else window.clearTimeout(initialFrame)
            document.removeEventListener("visibilitychange", syncPage)
            observer?.disconnect()
        }
    }, [])

    return (
        <div
            ref={root}
            className={`bm-orb-scene${compact ? " bm-orb-compact" : ""} ${className}`.trim()}
            data-bm-orb-active={enabled && visible && pageVisible ? "true" : "false"}
            aria-hidden
        >
            <div className="bm-orb-halo" />
            <div className="bm-orb-orbit"><span className="bm-orb-satellite" /></div>
            <div className="bm-orb-shadow" />
            <div className="bm-orb-body">
                <div className="bm-orb-wash" />
                <div className="bm-orb-ribbon bm-orb-ribbon-one" />
                <div className="bm-orb-ribbon bm-orb-ribbon-two" />
                <div className="bm-orb-gloss" />
                <div className="bm-orb-face">
                    <span className="bm-orb-eye"><i /></span>
                    <span className="bm-orb-eye"><i /></span>
                    <svg className="bm-orb-smile" viewBox="0 0 40 16" fill="none">
                        <path d="M8 5C13 12 27 12 32 5" />
                    </svg>
                </div>
                <div className="bm-orb-rim" />
            </div>
        </div>
    )
}
