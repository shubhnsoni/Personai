"use client"

import { useSyncExternalStore } from "react"
import { animojiClipForMood, animojiSrc, resolveAnimojiId, type AnimojiId } from "@/lib/animoji"
import { cn } from "@/lib/utils"

function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    query.addEventListener?.("change", onChange)
    return () => query.removeEventListener?.("change", onChange)
}

function reducedMotionSnapshot() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function AnimojiFace({
    id,
    mood = "idle",
    still = false,
    size,
    className,
}: {
    id?: string | null
    mood?: string
    still?: boolean
    size: number
    className?: string
}) {
    const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => true)
    const face: AnimojiId = resolveAnimojiId(id)
    const clip = still ? face : animojiClipForMood(face, mood)
    const freeze = still || reducedMotion
    return (
        <span
            data-animoji={clip}
            data-animoji-mood={mood}
            className={cn("relative block shrink-0 overflow-hidden", className)}
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                borderRadius: "50%",
            }}
            aria-hidden
        >
            <img
                src={animojiSrc(clip, freeze)}
                alt=""
                width={size}
                height={size}
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
        </span>
    )
}
