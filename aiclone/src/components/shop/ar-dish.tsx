"use client"

import { useEffect, useRef } from "react"
import { Camera } from "lucide-react"
import { loadModelViewer } from "@/lib/model-viewer"

export function ArDish({
    glb,
    usdz,
    title,
    href,
}: {
    glb?: string | null
    usdz?: string | null
    title: string
    href?: string
}) {
    const hostRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!glb) return
        const host = hostRef.current
        if (!host) return
        let dead = false
        let mv: HTMLElement | null = null

        void loadModelViewer()
            .then(() => {
                if (dead || !hostRef.current) return
                host.innerHTML = ""
                mv = document.createElement("model-viewer")
                mv.setAttribute("src", glb)
                mv.setAttribute("alt", title)
                mv.setAttribute("camera-controls", "")
                mv.setAttribute("auto-rotate", "")
                mv.setAttribute("shadow-intensity", "0.85")
                mv.setAttribute("exposure", "1.2")
                mv.setAttribute("interaction-prompt", "none")
                if (usdz) mv.setAttribute("ios-src", usdz)
                mv.style.width = "100%"
                mv.style.height = "320px"
                mv.style.background = "radial-gradient(ellipse at 50% 80%, #1a3a52, #09090b)"
                mv.style.setProperty("--poster-color", "transparent")
                host.appendChild(mv)
            })
            .catch(() => undefined)

        return () => {
            dead = true
            mv?.remove()
            host.innerHTML = ""
        }
    }, [glb, usdz, title])

    if (!glb && !usdz) return null

    return (
        <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-zinc-900">
            {glb ? (
                <div ref={hostRef} className="h-[320px] w-full" />
            ) : (
                <a rel="ar" href={usdz || "#"} className="block p-5 text-center text-sm text-cyan-300">
                    Open in AR on iPhone
                </a>
            )}
            {href ? (
                <a
                    href={href}
                    className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-cyan-400 py-3 text-sm font-medium text-zinc-950"
                >
                    <Camera className="h-4 w-4" />
                    View on table
                </a>
            ) : null}
        </div>
    )
}
