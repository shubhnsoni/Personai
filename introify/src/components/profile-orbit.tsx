"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { profileOrbitPose } from "@/lib/profile-orbit"
import "./profile-orbit.css"

/** Shared satellite layer: the owner's photo stays upright as it passes behind the bot. */
export function ProfileOrbit({ children, imageUrl, size, still = false, frozenAt, speed = 1 }: {
    children: ReactNode
    imageUrl: string
    size: number
    still?: boolean
    frozenAt?: number
    speed?: number
}) {
    const scene = useRef<HTMLDivElement>(null)
    const satellite = useRef<HTMLSpanElement>(null)
    const phase = useRef(0.08)
    const [failedUrl, setFailedUrl] = useState<string | null>(null)
    const failed = imageUrl === failedUrl
    const rate = Number.isFinite(speed) ? Math.max(0.35, Math.min(speed, 3)) : 1
    const initial = profileOrbitPose(frozenAt === undefined ? 0.08 : frozenAt / 8 * rate)

    useEffect(() => {
        if (failed || !satellite.current) return
        let raf = 0
        let previous = 0
        let visible = true
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        const paint = () => {
            const node = satellite.current
            if (!node) return
            const pose = profileOrbitPose(frozenAt === undefined ? phase.current : frozenAt / 8 * rate)
            node.style.transform = `translate(-50%, -50%) translate(${pose.x * size}px, ${pose.y * size}px) scale(${pose.scale})`
            node.style.zIndex = pose.front ? "3" : "1"
            node.dataset.orbitDepth = pose.front ? "front" : "back"
        }
        const tick = (now: number) => {
            if (previous) phase.current = (phase.current + Math.min((now - previous) / 1000, 0.05) / 8 * rate) % 1
            previous = now
            paint()
            raf = requestAnimationFrame(tick)
        }
        const sync = () => {
            cancelAnimationFrame(raf)
            previous = 0
            paint()
            if (!still && frozenAt === undefined && !reduced.matches && visible && !document.hidden) raf = requestAnimationFrame(tick)
        }
        const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            sync()
        })
        if (scene.current) observer?.observe(scene.current)
        reduced.addEventListener("change", sync)
        document.addEventListener("visibilitychange", sync)
        sync()
        return () => {
            cancelAnimationFrame(raf)
            observer?.disconnect()
            reduced.removeEventListener("change", sync)
            document.removeEventListener("visibilitychange", sync)
        }
    }, [failed, frozenAt, rate, size, still, imageUrl])

    if (failed) return children
    return (
        <div ref={scene} className="profile-orbit" data-profile-orbit style={{ width: size, height: size }}>
            <svg className="profile-orbit-track" viewBox="0 0 320 320" aria-hidden>
                <ellipse cx="160" cy="160" rx="129.6" ry="60.8" transform="rotate(-22 160 160)" />
            </svg>
            <div className="profile-orbit-core">{children}</div>
            <svg className="profile-orbit-track profile-orbit-track-front" viewBox="0 0 320 320" aria-hidden>
                <path d="M289.6 160 A129.6 60.8 0 0 1 30.4 160" transform="rotate(-22 160 160)" />
            </svg>
            <span ref={satellite} className="profile-orbit-photo" data-orbit-depth={initial.front ? "front" : "back"}
                style={{ width: size * 0.16, height: size * 0.16, padding: size * 0.012, borderWidth: Math.max(0.35, size * 0.003), zIndex: initial.front ? 3 : 1,
                    transform: `translate(-50%, -50%) translate(${initial.x * size}px, ${initial.y * size}px) scale(${initial.scale})` }}>
                <img src={imageUrl} alt="" draggable={false} onError={() => setFailedUrl(imageUrl)} />
            </span>
        </div>
    )
}
