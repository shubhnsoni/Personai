"use client"

import { useSyncExternalStore } from "react"
import {
    ANIMOJI_DURATION_MS,
    ANIMOJI_FRAME_COUNT,
    ANIMOJI_FRAME_SIZE,
    animojiClipForMood,
    animojiStripSrc,
    resolveAnimojiId,
} from "@/lib/animoji"
import { cn } from "@/lib/utils"
import "./animoji-face.css"

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
    gaze?: { x: number; y: number } | null
    className?: string
}) {
    const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => true)
    const face = animojiClipForMood(resolveAnimojiId(id), mood)
    const freeze = still || reducedMotion
    const stripWidth = ANIMOJI_FRAME_SIZE * ANIMOJI_FRAME_COUNT

    return (
        <span
            data-animoji={face}
            data-animoji-mood={mood}
            data-animoji-coded="svg"
            data-animoji-frames={ANIMOJI_FRAME_COUNT}
            data-mood={mood}
            data-still={freeze ? "" : undefined}
            className={cn("animoji-face relative block shrink-0 overflow-hidden", className)}
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                ["--animoji-duration" as string]: `${ANIMOJI_DURATION_MS}ms`,
            }}
            aria-hidden
        >
            <svg viewBox={`0 0 ${ANIMOJI_FRAME_SIZE} ${ANIMOJI_FRAME_SIZE}`} overflow="hidden">
                {freeze ? (
                    <image
                        href={`/bots/animoji/${face}.png`}
                        width={ANIMOJI_FRAME_SIZE}
                        height={ANIMOJI_FRAME_SIZE}
                    />
                ) : (
                    <g className="animoji-strip">
                        <image
                            href={animojiStripSrc(face)}
                            width={stripWidth}
                            height={ANIMOJI_FRAME_SIZE}
                        />
                    </g>
                )}
            </svg>
        </span>
    )
}
