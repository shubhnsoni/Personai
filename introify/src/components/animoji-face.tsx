"use client"

import { type ReactNode, useId, useSyncExternalStore } from "react"
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
                <Face id={face} uid={uid} gx={gx} gy={gy} />
            </svg>
        </span>
    )
}

function Face({ id, uid, gx, gy }: { id: AnimojiId; uid: string; gx: number; gy: number }) {
    switch (id) {
        case "sun": return <SunCharacter uid={uid} gx={gx} gy={gy} />
        case "et": return <EtCharacter uid={uid} gx={gx} gy={gy} />
        case "ghost": return <GhostCharacter uid={uid} gx={gx} gy={gy} />
        case "cloud": return <CloudCharacter uid={uid} gx={gx} gy={gy} />
        case "coffee": return <CoffeeCharacter uid={uid} gx={gx} gy={gy} />
        case "star": return <StarCharacter uid={uid} gx={gx} gy={gy} />
        case "moon": return <MoonCharacter uid={uid} gx={gx} gy={gy} />
        default: return <YellowCharacter look={id} uid={uid} gx={gx} gy={gy} />
    }
}

function Skin({ uid, stops }: { uid: string; stops: [string, string, string] }) {
    return (
        <radialGradient id={`${uid}-skin`} cx="36%" cy="30%" r="72%">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="58%" stopColor={stops[1]} />
            <stop offset="100%" stopColor={stops[2]} />
        </radialGradient>
    )
}

function YellowCharacter({ look, uid, gx, gy }: { look: AnimojiId; uid: string; gx: number; gy: number }) {
    const px = gx * 2.4
    const py = -gy * 2
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#FFE56A", "#F5C400", "#DFA000"]} /></defs>
            <ellipse cx="40" cy="68" rx="16" ry="3.2" fill="#1c1408" opacity="0.12" />
            <circle cx="40" cy="40" r="26" fill={`url(#${uid}-skin)`} />
            <ellipse cx="32" cy="30" rx="9" ry="5" fill="#fff" opacity="0.28" />
            {look === "angry" ? (
                <g className="animoji-brows">
                    <path d="M26 28l10 4" fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M54 28l-10 4" fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
                </g>
            ) : null}
            <g className="animoji-eyes">{yellowEyes(look, px, py)}</g>
            <g className="animoji-mouth">{yellowMouth(look)}</g>
            {look === "cry" ? <ellipse className="animoji-tear" cx="54" cy="50" rx="2.2" ry="3.4" fill="#6EC8FF" /> : null}
            {look === "sleepy" ? (
                <g className="animoji-zzz" fill="#1c1408" opacity="0.45">
                    <text x="56" y="22" fontSize="8" fontWeight="700">z</text>
                    <text x="62" y="14" fontSize="11" fontWeight="700">z</text>
                </g>
            ) : null}
            {look === "money" ? <circle className="animoji-spark" cx="58" cy="24" r="2.2" fill="#fff" opacity="0.9" /> : null}
        </g>
    )
}

function yellowEyes(look: AnimojiId, px: number, py: number): ReactNode {
    if (look === "love") {
        return (
            <>
                <path className="animoji-heart" d={`M${28 + px} ${36 + py}c0-3 4-4 5.2-1.6C34.4 ${31 + py} 38 ${32 + py} 38 ${36 + py}c0 4-5 7-5 7s-5-3-5-7z`} fill="#E11D48" />
                <path className="animoji-heart" d={`M${42 + px} ${36 + py}c0-3 4-4 5.2-1.6C48.4 ${31 + py} 52 ${32 + py} 52 ${36 + py}c0 4-5 7-5 7s-5-3-5-7z`} fill="#E11D48" />
            </>
        )
    }
    if (look === "sleepy") {
        return (
            <>
                <path d={`M${27 + px} ${38 + py}c3 3 8 3 11 0`} fill="none" stroke="#1c1408" strokeWidth="2.3" strokeLinecap="round" />
                <path d={`M${42 + px} ${38 + py}c3 3 8 3 11 0`} fill="none" stroke="#1c1408" strokeWidth="2.3" strokeLinecap="round" />
            </>
        )
    }
    if (look === "laugh") {
        return (
            <>
                <path d={`M${27 + px} ${37 + py}c3-3.4 8-3.4 11 0`} fill="none" stroke="#1c1408" strokeWidth="2.4" strokeLinecap="round" />
                <path d={`M${42 + px} ${37 + py}c3-3.4 8-3.4 11 0`} fill="none" stroke="#1c1408" strokeWidth="2.4" strokeLinecap="round" />
            </>
        )
    }
    if (look === "wow") {
        return (
            <>
                <ellipse cx={32 + px} cy={37 + py} rx="5.2" ry="6.6" fill="#1c1408" />
                <ellipse cx={48 + px} cy={37 + py} rx="5.2" ry="6.6" fill="#1c1408" />
                <ellipse cx={31 + px} cy={35 + py} rx="1.6" ry="2" fill="#fff" />
                <ellipse cx={47 + px} cy={35 + py} rx="1.6" ry="2" fill="#fff" />
            </>
        )
    }
    if (look === "money") {
        return (
            <>
                <ellipse cx={32 + px} cy={38 + py} rx="5" ry="5.4" fill="#1c1408" />
                <ellipse cx={48 + px} cy={38 + py} rx="5" ry="5.4" fill="#1c1408" />
                <text x={29.2 + px} y={41.2 + py} fill="#7CFF6B" fontSize="7.4" fontWeight="800">$</text>
                <text x={45.2 + px} y={41.2 + py} fill="#7CFF6B" fontSize="7.4" fontWeight="800">$</text>
            </>
        )
    }
    if (look === "wink") {
        return (
            <>
                <path d={`M${27 + px} ${38 + py}c3 3 8 3 11 0`} fill="none" stroke="#1c1408" strokeWidth="2.4" strokeLinecap="round" />
                <ellipse cx={48 + px} cy={38 + py} rx="4.4" ry="5.4" fill="#1c1408" />
                <ellipse cx={46.8 + px} cy={36.2 + py} rx="1.3" ry="1.6" fill="#fff" />
            </>
        )
    }
    if (look === "cool") {
        return (
            <g className="animoji-shades">
                <rect x={22 + px} y={33 + py} width="14" height="10" rx="3" fill="#1c1408" />
                <rect x={44 + px} y={33 + py} width="14" height="10" rx="3" fill="#1c1408" />
                <path d={`M${36 + px} ${38 + py}h8`} stroke="#1c1408" strokeWidth="2.2" />
                <rect x={24 + px} y={35 + py} width="6" height="3" rx="1" fill="#9AE6FF" opacity="0.45" />
            </g>
        )
    }
    return (
        <>
            <ellipse cx={32 + px} cy={38 + py} rx="4.4" ry="5.4" fill="#1c1408" />
            <ellipse cx={48 + px} cy={38 + py} rx="4.4" ry="5.4" fill="#1c1408" />
            <ellipse cx={30.8 + px} cy={36.2 + py} rx="1.3" ry="1.6" fill="#fff" />
            <ellipse cx={46.8 + px} cy={36.2 + py} rx="1.3" ry="1.6" fill="#fff" />
        </>
    )
}

function yellowMouth(look: AnimojiId): ReactNode {
    if (look === "laugh") return <ellipse cx="40" cy="52" rx="9" ry="7" fill="#1c1408" />
    if (look === "wow") return <ellipse cx="40" cy="52" rx="4.2" ry="5.6" fill="#1c1408" />
    if (look === "angry" || look === "cry") {
        return <path d="M32 54c3.2-4.4 12.8-4.4 16 0" fill="none" stroke="#1c1408" strokeWidth="2.4" strokeLinecap="round" />
    }
    if (look === "sleepy") {
        return <path d="M34 51c2.4 2.4 9.6 2.4 12 0" fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
    }
    return <path d="M32 50c3.2 5.4 12.8 5.4 16 0" fill="none" stroke="#1c1408" strokeWidth="2.4" strokeLinecap="round" />
}

function SunCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 1.6
    const py = -gy * 1.2
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#FFE27A", "#F0B429", "#E39412"]} /></defs>
            {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x="38.2" y="4" width="3.6" height="11" rx="1.8" fill="#E39412" transform={`rotate(${i * 30} 40 40)`} />
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
    const px = gx * 2.4
    const py = -gy * 1.6
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#E4E8EE", "#B4BCC6", "#8A929C"]} /></defs>
            <ellipse cx="40" cy="68" rx="14" ry="2.8" fill="#1c1408" opacity="0.1" />
            <path d="M16 30C16 14 64 14 64 30c4 16-6 34-24 38C22 64 12 46 16 30Z" fill={`url(#${uid}-skin)`} />
            <ellipse cx="32" cy="24" rx="10" ry="4.2" fill="#fff" opacity="0.22" />
            <g className="animoji-eyes">
                <ellipse cx={30 + px} cy={38 + py} rx="8.5" ry="10.5" fill="#14161a" />
                <ellipse cx={50 + px} cy={38 + py} rx="8.5" ry="10.5" fill="#14161a" />
                <ellipse cx={27.4 + px} cy={34.4 + py} rx="2.4" ry="3.1" fill="#fff" opacity="0.9" />
                <ellipse cx={47.4 + px} cy={34.4 + py} rx="2.4" ry="3.1" fill="#fff" opacity="0.9" />
            </g>
            <g className="animoji-mouth">
                <path d="M34 55c2.8 3.4 9.2 3.4 12 0" fill="none" stroke="#2a3036" strokeWidth="2.2" strokeLinecap="round" />
            </g>
        </g>
    )
}

function GhostCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 2
    const py = -gy * 1.6
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#F7F8FB", "#D5DAE4", "#B7BEC9"]} /></defs>
            <path d="M22 36c0-12 8-22 18-22s18 10 18 22v18c0 2-2 2-3 0l-4-6-5 6-4-6-5 6-4-6-3 6c-1 2-3 2-3 0z" fill={`url(#${uid}-skin)`} />
            <g className="animoji-eyes">
                <ellipse cx={33 + px} cy={36 + py} rx="4" ry="5" fill="#1c1408" />
                <ellipse cx={47 + px} cy={36 + py} rx="4" ry="5" fill="#1c1408" />
                <ellipse cx={32 + px} cy={34.4 + py} rx="1.2" ry="1.5" fill="#fff" />
                <ellipse cx={46 + px} cy={34.4 + py} rx="1.2" ry="1.5" fill="#fff" />
            </g>
            <g className="animoji-mouth">
                <ellipse cx="40" cy="47" rx="4" ry="3" fill="#1c1408" />
            </g>
        </g>
    )
}

function CloudCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 1.8
    const py = -gy * 1.2
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#FFFFFF", "#E8EEF6", "#C9D4E3"]} /></defs>
            <ellipse cx="28" cy="44" rx="14" ry="12" fill={`url(#${uid}-skin)`} />
            <ellipse cx="52" cy="44" rx="14" ry="12" fill={`url(#${uid}-skin)`} />
            <ellipse cx="40" cy="36" rx="16" ry="14" fill={`url(#${uid}-skin)`} />
            <g className="animoji-eyes">
                <circle cx={34 + px} cy={40 + py} r="2.6" fill="#1c1408" />
                <circle cx={46 + px} cy={40 + py} r="2.6" fill="#1c1408" />
            </g>
            <g className="animoji-mouth">
                <path d="M35 47c2 2.6 8 2.6 10 0" fill="none" stroke="#1c1408" strokeWidth="2" strokeLinecap="round" />
            </g>
        </g>
    )
}

function CoffeeCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 1.6
    const py = -gy * 1.2
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#F4D2A8", "#C9844A", "#7A3F16"]} /></defs>
            <path className="animoji-steam" d="M34 16c2 4-2 6 0 10" fill="none" stroke="#C9D4E3" strokeWidth="2" strokeLinecap="round" />
            <path className="animoji-steam" d="M42 14c2 4-2 6 0 11" fill="none" stroke="#C9D4E3" strokeWidth="2" strokeLinecap="round" />
            <path className="animoji-steam" d="M50 16c2 4-2 6 0 10" fill="none" stroke="#C9D4E3" strokeWidth="2" strokeLinecap="round" />
            <rect x="24" y="28" width="32" height="30" rx="6" fill={`url(#${uid}-skin)`} />
            <path d="M56 34h6c4 0 7 4 7 8s-3 8-7 8h-6" fill="none" stroke="#7A3F16" strokeWidth="3.2" strokeLinecap="round" />
            <ellipse cx="40" cy="28" rx="16" ry="5" fill="#7A3F16" />
            <g className="animoji-eyes">
                <circle cx={34 + px} cy={42 + py} r="2.8" fill="#1c1408" />
                <circle cx={46 + px} cy={42 + py} r="2.8" fill="#1c1408" />
            </g>
            <g className="animoji-mouth">
                <path d="M35 50c2.4 2.8 7.6 2.8 10 0" fill="none" stroke="#1c1408" strokeWidth="2" strokeLinecap="round" />
            </g>
        </g>
    )
}

function StarCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 1.8
    const py = -gy * 1.4
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#FFE56A", "#F5C400", "#E0A000"]} /></defs>
            <path d="M40 8l7.4 18.4 20 1.6-15.2 12.8 4.8 19.2L40 49.2 22.8 60l4.8-19.2L12.4 28l20-1.6z" fill={`url(#${uid}-skin)`} />
            <g className="animoji-eyes">
                <circle cx={34 + px} cy={36 + py} r="2.8" fill="#1c1408" />
                <circle cx={46 + px} cy={36 + py} r="2.8" fill="#1c1408" />
            </g>
            <g className="animoji-mouth">
                <path d="M34 44c2.6 3.4 9.4 3.4 12 0" fill="none" stroke="#1c1408" strokeWidth="2.2" strokeLinecap="round" />
            </g>
        </g>
    )
}

function MoonCharacter({ uid, gx, gy }: { uid: string; gx: number; gy: number }) {
    const px = gx * 1.6
    const py = -gy * 1.2
    return (
        <g className="animoji-character">
            <defs><Skin uid={uid} stops={["#F6E7B2", "#E8C86A", "#C9A227"]} /></defs>
            <path d="M48 12c-16 2-28 16-28 32 0 18 14 32 32 32 6 0 12-1.6 17-4.4C56 68 44 56 44 40 44 26 52 16 64 12 59 12 53 12 48 12z" fill={`url(#${uid}-skin)`} />
            <g className="animoji-eyes">
                <circle cx={36 + px} cy={38 + py} r="2.6" fill="#1c1408" />
                <path d={`M${44 + px} ${38 + py}c2 2.4 5 2.4 7 0`} fill="none" stroke="#1c1408" strokeWidth="2" strokeLinecap="round" />
            </g>
            <g className="animoji-mouth">
                <path d="M36 48c2.2 2.6 7 2.6 9 0" fill="none" stroke="#1c1408" strokeWidth="2" strokeLinecap="round" />
            </g>
        </g>
    )
}
