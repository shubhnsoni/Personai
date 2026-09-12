"use client"

import { useId } from "react"
import "./premium-theme-orb.css"

export type PremiumOrbVariant = "astral-nebula" | "holographic-hud" | "liquid-chrome"

type Lid = "none" | "blink" | "wink-left" | "wink-right"

const HAPPY = new Set(["heureux", "hilare", "excite"])
const SLEEPY = new Set(["somnolent", "blase"])
const WIDE = new Set(["surpris", "effraye"])

function eyeTransform(expression: string, index: number, closed: boolean): string {
    if (closed) return "scale(1, 0.12)"
    if (HAPPY.has(expression)) return "translateY(-1px) scale(1, 0.6)"
    if (SLEEPY.has(expression)) return "scale(1, 0.5)"
    if (WIDE.has(expression)) return "scale(1.18)"
    if (expression === "mefiant") return "scale(1.05, 0.45)"
    if (expression === "timide") return "translateY(3px) scale(1, 0.82)"
    if (expression === "attentif") return "translateY(-2px) scale(1.05)"
    if (expression === "curieux" && index === 1) return "scale(1.12)"
    return "none"
}

/** Four-point diffraction star, centred at (cx, cy). */
function starPath(cx: number, cy: number, r: number, core: number): string {
    const k = r * 0.28
    return [
        `M ${cx} ${cy - r}`,
        `Q ${cx + k} ${cy - core} ${cx + r} ${cy}`,
        `Q ${cx + k} ${cy + core} ${cx} ${cy + r}`,
        `Q ${cx - k} ${cy + core} ${cx - r} ${cy}`,
        `Q ${cx - k} ${cy - core} ${cx} ${cy - r}`,
        "Z",
    ].join(" ")
}

function NebulaArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-neb-core`} cx="42%" cy="36%" r="72%">
                    <stop offset="0%" stopColor="#f0abfc" />
                    <stop offset="34%" stopColor="#a78bfa" />
                    <stop offset="66%" stopColor="#6d28d9" />
                    <stop offset="100%" stopColor="#1e1145" />
                </radialGradient>
                <radialGradient id={`${uid}-neb-halo`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.34" />
                    <stop offset="62%" stopColor="#8b5cf6" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </radialGradient>
                <filter id={`${uid}-neb-glow`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            <g className="pt-orb-decor">
                <circle className="pt-nebula-halo" cx="160" cy="160" r="148" fill={`url(#${uid}-neb-halo)`} />
                <g className="pt-nebula-orbit">
                    <circle cx="160" cy="18" r="2.2" fill="#f5d0fe" />
                    <circle cx="292" cy="112" r="1.6" fill="#c4b5fd" />
                    <circle cx="262" cy="270" r="2.6" fill="#f0abfc" filter={`url(#${uid}-neb-glow)`} />
                    <circle cx="44" cy="238" r="1.7" fill="#e9d5ff" />
                    <circle cx="30" cy="86" r="2" fill="#ddd6fe" />
                </g>
            </g>
            <g className="pt-orb-body">
                <circle cx="160" cy="160" r="112" fill={`url(#${uid}-neb-core)`} />
                <path d="M 84 128 Q 146 88 202 118 T 246 196" fill="none" stroke="#f5d0fe" strokeWidth="8" strokeLinecap="round" opacity="0.28" />
                <path d="M 108 214 Q 168 244 216 190" fill="none" stroke="#c4b5fd" strokeWidth="10" strokeLinecap="round" opacity="0.3" />
                <circle cx="96" cy="86" r="1.6" fill="#fff" opacity="0.85" />
                <circle cx="238" cy="74" r="1.2" fill="#fff" opacity="0.6" />
                <circle cx="212" cy="220" r="1.4" fill="#fff" opacity="0.7" />
            </g>
            {eyes}
        </>
    )
}

function HudArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-hud-core`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0b1f38" />
                    <stop offset="72%" stopColor="#061224" />
                    <stop offset="100%" stopColor="#03060f" />
                </radialGradient>
                <radialGradient id={`${uid}-hud-halo`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.22" />
                    <stop offset="70%" stopColor="#00f0ff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
                </radialGradient>
                <filter id={`${uid}-hud-glow`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            <g className="pt-orb-decor">
                <circle className="pt-hud-halo" cx="160" cy="160" r="150" fill={`url(#${uid}-hud-halo)`} />
                <g className="pt-hud-rings" stroke="#00f0ff" fill="none">
                    <circle cx="160" cy="160" r="140" strokeWidth="0.8" strokeDasharray="4 9" opacity="0.45" />
                    <circle cx="160" cy="160" r="122" strokeWidth="0.7" strokeDasharray="38 6 14 6" opacity="0.55" />
                    <circle cx="160" cy="160" r="98" strokeWidth="1" strokeDasharray="2 6" opacity="0.55" />
                    <path d="M 160 12 v 16 M 160 292 v 16 M 12 160 h 16 M 292 160 h 16" strokeWidth="1.6" opacity="0.75" />
                </g>
                <g stroke="#00f0ff" strokeWidth="0.9" opacity="0.3" fill="none">
                    <ellipse cx="160" cy="160" rx="92" ry="42" />
                    <ellipse cx="160" cy="160" rx="92" ry="76" />
                    <ellipse cx="160" cy="160" rx="42" ry="92" />
                </g>
            </g>
            <g className="pt-orb-body" filter={`url(#${uid}-hud-glow)`}>
                <circle cx="160" cy="160" r="80" fill={`url(#${uid}-hud-core)`} stroke="#00f0ff" strokeWidth="1.6" />
                <path d="M 86 116 v -20 h 20 M 234 116 v -20 h -20 M 86 204 v 20 h 20 M 234 204 v 20 h -20" fill="none" stroke="#00f0ff" strokeWidth="2" opacity="0.85" />
                <rect className="pt-hud-scan" x="88" y="96" width="144" height="2" fill="#00f0ff" opacity="0.5" />
                <rect x="182" y="82" width="26" height="2" fill="#ff0055" />
            </g>
            <text className="pt-hud-readout" x="160" y="216" fill="#00f0ff" fontSize="9" fontFamily="var(--font-geist-mono), ui-monospace, monospace" textAnchor="middle" letterSpacing="3" opacity="0.7">AI.CORE</text>
            {eyes}
        </>
    )
}

function ChromeArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-chr-metal`} cx="32%" cy="26%" r="78%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="26%" stopColor="#e2e8f0" />
                    <stop offset="52%" stopColor="#94a3b8" />
                    <stop offset="78%" stopColor="#3f4a63" />
                    <stop offset="100%" stopColor="#11151f" />
                </radialGradient>
                <linearGradient id={`${uid}-chr-iris`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#67e8f9" />
                    <stop offset="42%" stopColor="#a78bfa" />
                    <stop offset="72%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
                <clipPath id={`${uid}-chr-clip`}>
                    <circle cx="160" cy="160" r="112" />
                </clipPath>
            </defs>
            <g className="pt-orb-decor">
                <circle className="pt-chrome-ring" cx="160" cy="160" r="138" fill="none" stroke={`url(#${uid}-chr-iris)`} strokeWidth="1.4" opacity="0.5" />
                <circle className="pt-chrome-ring pt-chrome-ring--inner" cx="160" cy="160" r="126" fill="none" stroke="#e2e8f0" strokeWidth="0.7" strokeDasharray="14 34" opacity="0.4" />
            </g>
            <g className="pt-orb-body">
                <circle cx="160" cy="160" r="112" fill={`url(#${uid}-chr-metal)`} />
                <g clipPath={`url(#${uid}-chr-clip)`}>
                    <path className="pt-chrome-iris" d="M 40 196 Q 150 260 284 168 L 284 292 L 40 292 Z" fill={`url(#${uid}-chr-iris)`} opacity="0.5" />
                    <ellipse cx="108" cy="96" rx="52" ry="24" fill="#ffffff" opacity="0.6" transform="rotate(-28 108 96)" />
                    <circle cx="94" cy="82" r="8" fill="#ffffff" opacity="0.95" />
                    <ellipse cx="196" cy="226" rx="44" ry="12" fill="#0f172a" opacity="0.35" transform="rotate(-24 196 226)" />
                </g>
            </g>
            {eyes}
        </>
    )
}

export function PremiumThemeOrb({
    variant,
    size,
    gaze,
    lid,
    expression,
    still = false,
    aura = "still",
    mood = "idle",
}: {
    variant: PremiumOrbVariant
    size: number
    gaze: { x: number; y: number }
    lid: Lid
    expression: string
    still?: boolean
    aura?: string
    mood?: string
}) {
    const uid = `pt-${useId().replace(/:/g, "")}`
    const dx = still ? 0 : Math.max(-1, Math.min(1, gaze.x)) * 7
    const dy = still ? 0 : Math.max(-1, Math.min(1, -gaze.y)) * 5
    const eyes = [0, 1].map((index) => {
        const closed = lid === "blink" || lid === (index === 0 ? "wink-left" : "wink-right")
        return { transform: eyeTransform(expression, index, closed) }
    })

    const eyesNode = (
        <g className="pt-orb-eyes" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
            {variant === "astral-nebula" && [[125, 150], [195, 150]].map(([cx, cy], i) => (
                <g key={i} className="pt-orb-eye" style={{ transform: eyes[i].transform }}>
                    <path d={starPath(cx, cy, 13, 4.5)} fill="#fdf4ff" />
                    <circle cx={cx} cy={cy} r="2" fill="#fce7f3" />
                </g>
            ))}
            {variant === "holographic-hud" && [[122, 155], [192, 155]].map(([cx, cy], i) => (
                <g key={i} className="pt-orb-eye" style={{ transform: eyes[i].transform }} stroke="#00f0ff" strokeLinecap="round">
                    <path d={`M ${cx - 13} ${cy - 9} h -5 v 18 h 5 M ${cx + 13} ${cy - 9} h 5 v 18 h -5`} fill="none" strokeWidth="2.6" />
                    <circle cx={cx} cy={cy} r="4" fill="#00f0ff" stroke="none" />
                </g>
            ))}
            {variant === "liquid-chrome" && [[125, 156], [195, 156]].map(([cx, cy], i) => (
                <g key={i} className="pt-orb-eye" style={{ transform: eyes[i].transform }}>
                    <rect x={cx - 17} y={cy - 6} width="34" height="12" rx="6" fill="#0b1220" stroke="#e2e8f0" strokeWidth="1.4" />
                    <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="#67e8f9" strokeWidth="2" />
                </g>
            ))}
        </g>
    )

    return (
        <svg
            className={`pt-orb pt-orb--${variant}`}
            width={size}
            height={size}
            viewBox="0 0 320 320"
            data-still={still}
            data-aura={aura}
            data-mood={mood}
            data-expression={expression}
            aria-hidden
            focusable="false"
        >
            <g className="pt-orb-character">
                {variant === "astral-nebula" && <NebulaArt uid={uid} eyes={eyesNode} />}
                {variant === "holographic-hud" && <HudArt uid={uid} eyes={eyesNode} />}
                {variant === "liquid-chrome" && <ChromeArt uid={uid} eyes={eyesNode} />}
            </g>
        </svg>
    )
}
