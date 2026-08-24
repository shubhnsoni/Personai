"use client"

import { useEffect } from "react"
import { ensureModelViewer } from "@/lib/model-viewer"

export function ArDish({
    glb,
    usdz,
    title,
    auto,
}: {
    glb?: string | null
    usdz?: string | null
    title: string
    auto?: boolean
}) {
    useEffect(() => {
        if (glb) ensureModelViewer()
    }, [glb])

    if (!glb && !usdz) return null

    return (
        <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-zinc-900">
            {glb ? (
                // @ts-expect-error model-viewer is a web component
                <model-viewer
                    src={glb}
                    ios-src={usdz || undefined}
                    alt={title}
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    camera-controls
                    auto-rotate
                    shadow-intensity="1"
                    exposure="1.05"
                    style={{ width: "100%", height: "320px", background: "radial-gradient(ellipse at 50% 80%, #1c1917, #09090b)" }}
                >
                    <button
                        slot="ar-button"
                        className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-zinc-950"
                    >
                        Place on table
                    </button>
                </model-viewer>
            ) : (
                <a rel="ar" href={usdz || "#"} className="block p-5 text-center text-sm text-cyan-300">
                    Open in AR on iPhone
                </a>
            )}
        </div>
    )
}
