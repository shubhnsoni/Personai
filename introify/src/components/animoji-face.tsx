"use client"

import { useId, useSyncExternalStore } from "react"
import { animojiClipForMood, resolveAnimojiId, type AnimojiId } from "@/lib/animoji"
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
    gaze,
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
    const face: AnimojiId = animojiClipForMood(resolveAnimojiId(id), mood)
    const freeze = still || reducedMotion
    const uid = useId().replace(/:/g, "")
    const gx = freeze ? 0 : Math.max(-1, Math.min(1, gaze?.x ?? 0))
    const gy = freeze ? 0 : Math.max(-1, Math.min(1, gaze?.y ?? 0))

    return (
        <span
            data-animoji={face}
            data-animoji-coded="svg"
            data-animoji-mood={mood}
            data-mood={mood}
            data-still={freeze}
            className={cn("animoji-face relative block shrink-0", className)}
            style={{ width: size, height: size, minWidth: size, minHeight: size }}
            aria-hidden
        >
            <svg viewBox="0 0 80 80" width={size} height={size} overflow="visible" focusable="false">
                {face === "sun" ? (
                    <SunCharacter uid={uid} gx={gx} gy={gy} />
                ) : face === "et" ? (
                    <EtCharacter uid={uid} gx={gx} gy={gy} />
                ) : (
                    <BounceCharacter uid={uid} gx={gx} gy={gy} />
                )}
            </svg>
        </span>
    )
}

function BounceCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 2.4
    const py = -gy * 2
    return (
        <g className="animoji-character">
            <defs>
                <radialGradient id={`${uid}-skin`} cx="36%" cy="30%" r="72%">
                    <stop offset="0%" stopColor="#FFE56A" />
                    <stop offset="58%" stopColor="#F5C400" />
                    <stop offset="100%" stopColor="#DFA000" />
                </radialGradient>
            </defs>
            <ellipse cx="40" cy="68" rx="16" ry="3.2" fill="#1c1408" opacity="0.12" />
            <circle cx="40" cy="40" r="26" fill={`url(#${uid}-skin)`} />
            <ellipse cx="32" cy="30" rx="9" ry="5" fill="#fff" opacity="0.28" />
            <g className="animoji-eyes">
                <ellipse cx={32 + px} cy={38 + py} rx="4.4" ry="5.4" fill="#1c1408" />
                <ellipse cx={48 + px} cy={38 + py} rx="4.4" ry="5.4" fill="#1c1408" />
                <ellipse cx={30.8 + px} cy={36.2 + py} rx="1.3" ry="1.6" fill="#fff" />
                <ellipse cx={46.8 + px} cy={36.2 + py} rx="1.3" ry="1.6" fill="#fff" />
            </g>
            <g className="animoji-mouth">
                <path d="M32 50c3.2 5.4 12.8 5.4 16 0" fill="none" stroke="#1c1408" strokeWidth="2.4" strokeLinecap="round" />
            </g>
        </g>
    )
}

function SunCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 1.6
    const py = -gy * 1.2
    return (
        <g className="animoji-character">
            <defs>
                <radialGradient id={`${uid}-skin`} cx="38%" cy="32%" r="70%">
                    <stop offset="0%" stopColor="#FFE27A" />
                    <stop offset="60%" stopColor="#F0B429" />
                    <stop offset="100%" stopColor="#E39412" />
                </radialGradient>
            </defs>
            {Array.from({ length: 12 }, (_, i) => (
                <rect
                    key={i}
                    x="38.2"
                    y="4"
                    width="3.6"
                    height="11"
                    rx="1.8"
                    fill="#E39412"
                    transform={`rotate(${i * 30} 40 40)`}
                />
            ))}
            <circle cx="40" cy="40" r="18" fill={`url(#${uid}-skin)`} />
            <g className="animoji-eyes">
                <path d={`M${30 + px} ${38 + py}c2.2-3 6.2-3 8.4 0`} fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
                <path d={`M${42 + px} ${38 + py}c2.2-3 6.2-3 8.4 0`} fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            <g className="animoji-mouth">
                <path d="M33 46c2.8 5.6 11.2 5.6 14 0" fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
            </g>
        </g>
    )
}

function EtCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 2.8
    const py = -gy * 1.8
    return (
        <g className="animoji-character">
            <defs>
                <radialGradient id={`${uid}-skin`} cx="38%" cy="28%" r="78%">
                    <stop offset="0%" stopColor="#D8DCE2" />
                    <stop offset="55%" stopColor="#9AA3AE" />
                    <stop offset="100%" stopColor="#6E7782" />
                </radialGradient>
            </defs>
            <path
                d="M26 26C26 12 54 12 54 26c3 14-2 36-14 39C28 62 23 40 26 26Z"
                fill={`url(#${uid}-skin)`}
            />
            <ellipse cx="33" cy="24" rx="7" ry="3.4" fill="#fff" opacity="0.22" />
            <g className="animoji-eyes">
                <ellipse cx={32 + px} cy={38 + py} rx="8" ry="11" fill="#14161a" />
                <ellipse cx={48 + px} cy={38 + py} rx="8" ry="11" fill="#14161a" />
                <ellipse cx={29.6 + px} cy={34.2 + py} rx="2.2" ry="3" fill="#fff" opacity="0.85" />
                <ellipse cx={45.6 + px} cy={34.2 + py} rx="2.2" ry="3" fill="#fff" opacity="0.85" />
            </g>
            <g className="animoji-mouth">
                <path d="M36 54c2.2 3 5.8 3 8 0" fill="none" stroke="#2a3036" strokeWidth="2" strokeLinecap="round" />
            </g>
        </g>
    )
}
