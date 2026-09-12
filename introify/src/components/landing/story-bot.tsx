"use client"
import { useEffect, useRef, useState } from "react"
import { PremiumThemeOrb } from "@/components/premium-theme-orb"
import { MascotOrb } from "@/components/mascot-orb"
import { PlanetOrb } from "@/components/planet-orb"
import { useLandingMotion } from "./brand-motion"
export type StoryBotName = "Nyx" | "Ion" | "Pearl" | "Azure" | "Doodle" | "Aurum"
export function StoryBot({ name, className = "", expression = "heureux" }: { name: StoryBotName; className?: string; expression?: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const { enabled } = useLandingMotion()
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        if (!ref.current || typeof IntersectionObserver === "undefined") return
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 })
        observer.observe(ref.current)
        return () => observer.disconnect()
    }, [])
    const active = enabled && visible
    const props = { size: 320, expression, still: !active, gaze: { x: 0, y: 0 }, lid: "none" as const }
    return <div ref={ref} className={`story-bot ${className}`} data-active={active} role="img" aria-label={`${name}, an Introify AI guide`}>
        {name === "Nyx" || name === "Ion" ? <PremiumThemeOrb {...props} variant={name === "Nyx" ? "astral-nebula" : "holographic-hud"} aura={active ? "float" : "still"} /> : name === "Azure" ? <PlanetOrb {...props} variant="planet-azure" /> : <MascotOrb {...props} variant={name === "Doodle" ? "pencil-sketch" : name === "Aurum" ? "solid-gold" : "glass-bubble"} aura={active ? "float" : "still"} />}
    </div>
}
