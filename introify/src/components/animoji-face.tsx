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
    const uid = useId()
    const lookX = freeze ? 0 : (gaze?.x ?? 0)
    const lookY = freeze ? 0 : (gaze?.y ?? 0)

    return (
        <span
            data-animoji={face}
            data-animoji-mood={mood}
            data-animoji-coded="svg"
            data-mood={mood}
            data-still={freeze ? "" : undefined}
            className={cn("animoji-face relative block shrink-0", className)}
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
            }}
            aria-hidden
        >
            {face === "sun" ? (
                <SunFace uid={uid} lookX={lookX} lookY={lookY} />
            ) : face === "et" ? (
                <EtFace uid={uid} lookX={lookX} lookY={lookY} />
            ) : (
                <BounceFace uid={uid} lookX={lookX} lookY={lookY} />
            )}
        </span>
    )
}

function BounceFace({ uid, lookX, lookY }: { uid: string; lookX: number; lookY: number }) {
    const px = lookX * 3.2
    const py = -lookY * 2.8
    return (
        <svg viewBox="0 0 100 100">
            <defs>
                <radialGradient id={`${uid}-skin`} cx="36%" cy="30%" r="72%">
                    <stop offset="0%" stopColor="#FFE56A" />
                    <stop offset="58%" stopColor="#F5C400" />
                    <stop offset="100%" stopColor="#DFA000" />
                </radialGradient>
            </defs>
            <g className="animoji-motion">
                <circle cx="50" cy="52" r="38" fill={`url(#${uid}-skin)`} />
                <ellipse cx="38" cy="38" rx="12" ry="7" fill="#fff" opacity="0.28" />
                <g className="animoji-eyes">
                    <ellipse cx={36 + px} cy={48 + py} rx="6.2" ry="7.4" fill="#1c1408" />
                    <ellipse cx={64 + px} cy={48 + py} rx="6.2" ry="7.4" fill="#1c1408" />
                    <ellipse cx={34.2 + px} cy={45.4 + py} rx="1.8" ry="2.2" fill="#fff" />
                    <ellipse cx={62.2 + px} cy={45.4 + py} rx="1.8" ry="2.2" fill="#fff" />
                </g>
                <path className="animoji-mouth-rest" d="M38 64c4.5 7 19.5 7 24 0" fill="none" stroke="#1c1408" strokeWidth="3.2" strokeLinecap="round" />
                <ellipse className="animoji-mouth-open" cx="50" cy="67" rx="9" ry="6.5" fill="#1c1408" />
                <path className="animoji-mouth-frown" d="M38 70c4.5-6 19.5-6 24 0" fill="none" stroke="#1c1408" strokeWidth="3.2" strokeLinecap="round" />
            </g>
        </svg>
    )
}

function SunFace({ uid, lookX, lookY }: { uid: string; lookX: number; lookY: number }) {
    const px = lookX * 2.2
    const py = -lookY * 1.8
    return (
        <svg viewBox="0 0 100 100">
            <defs>
                <radialGradient id={`${uid}-skin`} cx="38%" cy="32%" r="70%">
                    <stop offset="0%" stopColor="#FFE27A" />
                    <stop offset="60%" stopColor="#F0B429" />
                    <stop offset="100%" stopColor="#E39412" />
                </radialGradient>
            </defs>
            <g className="animoji-sun-rays">
                {Array.from({ length: 12 }, (_, i) => (
                    <rect
                        key={i}
                        x="47.2"
                        y="4"
                        width="5.6"
                        height="16"
                        rx="2.8"
                        fill="#E39412"
                        transform={`rotate(${i * 30} 50 50)`}
                    />
                ))}
            </g>
            <g className="animoji-motion">
                <circle cx="50" cy="50" r="28" fill={`url(#${uid}-skin)`} />
                <g className="animoji-eyes">
                    <path d={`M${36 + px} ${47 + py}c3-4 9-4 12 0`} fill="none" stroke="#1c1408" strokeWidth="3" strokeLinecap="round" />
                    <path d={`M${52 + px} ${47 + py}c3-4 9-4 12 0`} fill="none" stroke="#1c1408" strokeWidth="3" strokeLinecap="round" />
                </g>
                <path className="animoji-mouth-rest" d="M40 58c4 8 16 8 20 0" fill="none" stroke="#1c1408" strokeWidth="3.1" strokeLinecap="round" />
                <ellipse className="animoji-mouth-open" cx="50" cy="61" rx="8" ry="5.5" fill="#1c1408" />
                <path className="animoji-mouth-frown" d="M40 64c4-6 16-6 20 0" fill="none" stroke="#1c1408" strokeWidth="3.1" strokeLinecap="round" />
            </g>
        </svg>
    )
}

function EtFace({ uid, lookX, lookY }: { uid: string; lookX: number; lookY: number }) {
    const px = lookX * 3.6
    const py = -lookY * 2.4
    return (
        <svg viewBox="0 0 100 100">
            <defs>
                <radialGradient id={`${uid}-skin`} cx="38%" cy="28%" r="78%">
                    <stop offset="0%" stopColor="#D8DCE2" />
                    <stop offset="55%" stopColor="#9AA3AE" />
                    <stop offset="100%" stopColor="#6E7782" />
                </radialGradient>
            </defs>
            <g className="animoji-motion">
                <path
                    d="M31 30C31 13 69 13 69 30c4 18-3 48-19 52C34 78 27 48 31 30Z"
                    fill={`url(#${uid}-skin)`}
                />
                <ellipse cx="40" cy="28" rx="10" ry="5" fill="#fff" opacity="0.22" />
                <g className="animoji-eyes">
                    <ellipse cx={38 + px} cy={46 + py} rx="11.5" ry="15" fill="#14161a" />
                    <ellipse cx={62 + px} cy={46 + py} rx="11.5" ry="15" fill="#14161a" />
                    <ellipse cx={34.5 + px} cy={41 + py} rx="3.2" ry="4.4" fill="#fff" opacity="0.85" />
                    <ellipse cx={58.5 + px} cy={41 + py} rx="3.2" ry="4.4" fill="#fff" opacity="0.85" />
                </g>
                <path className="animoji-mouth-rest" d="M44 68c3 4 9 4 12 0" fill="none" stroke="#2a3036" strokeWidth="2.6" strokeLinecap="round" />
                <ellipse className="animoji-mouth-open" cx="50" cy="70" rx="6" ry="4" fill="#2a3036" />
                <path className="animoji-mouth-frown" d="M44 72c3-3.5 9-3.5 12 0" fill="none" stroke="#2a3036" strokeWidth="2.6" strokeLinecap="round" />
            </g>
        </svg>
    )
}
