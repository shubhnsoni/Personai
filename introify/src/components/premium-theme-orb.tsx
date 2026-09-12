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

function starPath(cx: number, cy: number, r: number, core: number): string {
    const k = r * 0.3
    return [
        `M ${cx} ${cy - r}`,
        `Q ${cx + k} ${cy - core} ${cx + r} ${cy}`,
        `Q ${cx + k} ${cy + core} ${cx} ${cy + r}`,
        `Q ${cx - k} ${cy + core} ${cx - r} ${cy}`,
        `Q ${cx - k} ${cy - core} ${cx} ${cy - r}`,
        "Z",
    ].join(" ")
}

/* ------------------------------------------------------------------ *
 * Astral Nebula — Grok reference:
 * deep space backdrop, a dark orb carved by glowing violet/magenta
 * plasma rivers, a hot core, rim light, little embedded stars, and
 * two radiant star-core eyes.
 * ------------------------------------------------------------------ */
function NebulaArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-n-deep`} cx="50%" cy="42%" r="62%">
                    <stop offset="0%" stopColor="#2a1b4e" />
                    <stop offset="55%" stopColor="#170f33" />
                    <stop offset="100%" stopColor="#06040f" />
                </radialGradient>
                <radialGradient id={`${uid}-n-halo`} cx="50%" cy="50%" r="50%">
                    <stop offset="52%" stopColor="#7c5cf0" stopOpacity="0" />
                    <stop offset="74%" stopColor="#a06bff" stopOpacity="0.3" />
                    <stop offset="86%" stopColor="#d96fe8" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#d96fe8" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`${uid}-n-core`} cx="50%" cy="62%" r="42%">
                    <stop offset="0%" stopColor="#ffb3f1" stopOpacity="0.95" />
                    <stop offset="28%" stopColor="#e879f9" stopOpacity="0.75" />
                    <stop offset="62%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${uid}-n-river-a`} x1="0%" y1="0%" x2="100%" y2="60%">
                    <stop offset="0%" stopColor="#f0abfc" stopOpacity="0.9" />
                    <stop offset="45%" stopColor="#c084fc" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id={`${uid}-n-river-b`} x1="20%" y1="100%" x2="80%" y2="0%">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity="0.8" />
                    <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.1" />
                </linearGradient>
                <filter id={`${uid}-n-soft8`}><feGaussianBlur stdDeviation="8" /></filter>
                <filter id={`${uid}-n-soft3`}><feGaussianBlur stdDeviation="3.2" /></filter>
                <filter id={`${uid}-n-glow`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <clipPath id={`${uid}-n-clip`}><circle cx="160" cy="160" r="108" /></clipPath>
            </defs>

            {/* outer atmosphere + orbiting dust */}
            <g className="pt-orb-decor">
                <circle cx="160" cy="160" r="150" fill={`url(#${uid}-n-halo)`} />
                <g className="pt-nebula-orbit">
                    <circle cx="160" cy="26" r="2.2" fill="#e9d5ff" opacity="0.9" />
                    <circle cx="285" cy="128" r="1.6" fill="#f5d0fe" opacity="0.75" />
                    <circle cx="252" cy="268" r="2.4" fill="#c084fc" opacity="0.9" filter={`url(#${uid}-n-soft3)`} />
                    <circle cx="52" cy="246" r="1.6" fill="#ddd6fe" opacity="0.7" />
                    <circle cx="33" cy="94" r="2" fill="#e9d5ff" opacity="0.8" />
                    <circle cx="232" cy="34" r="1.3" fill="#fff" opacity="0.8" />
                </g>
            </g>

            {/* body */}
            <g className="pt-orb-body">
                <circle cx="160" cy="160" r="108" fill={`url(#${uid}-n-deep)`} />

                <g clipPath={`url(#${uid}-n-clip)`}>
                    {/* hot lower core */}
                    <circle cx="160" cy="186" r="86" fill={`url(#${uid}-n-core)`} />
                    {/* plasma rivers, three densities */}
                    <g filter={`url(#${uid}-n-soft8)`}>
                        <path d="M 42 132 Q 106 84 172 112 T 288 168" fill="none" stroke={`url(#${uid}-n-river-a)`} strokeWidth="30" strokeLinecap="round" />
                        <path d="M 66 218 Q 148 258 224 196" fill="none" stroke={`url(#${uid}-n-river-b)`} strokeWidth="24" strokeLinecap="round" />
                        <path d="M 96 60 Q 170 96 240 76" fill="none" stroke={`url(#${uid}-n-river-a)`} strokeWidth="18" strokeLinecap="round" opacity="0.8" />
                    </g>
                    <g filter={`url(#${uid}-n-soft3)`}>
                        <path d="M 56 160 Q 120 118 188 142 T 272 188" fill="none" stroke="#f3d0ff" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
                        <path d="M 92 236 Q 156 258 208 214" fill="none" stroke="#fda4f0" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
                    </g>
                    {/* embedded stars */}
                    <g fill="#fff">
                        <circle cx="112" cy="112" r="1.6" opacity="0.95" />
                        <circle cx="196" cy="96" r="1.1" opacity="0.8" />
                        <circle cx="230" cy="150" r="1.4" opacity="0.85" />
                        <circle cx="100" cy="200" r="1" opacity="0.7" />
                        <circle cx="150" cy="240" r="1.3" opacity="0.75" />
                        <circle cx="212" cy="228" r="1" opacity="0.6" />
                    </g>
                    {/* depth shadow top */}
                    <ellipse cx="160" cy="96" rx="96" ry="44" fill="#05030f" opacity="0.55" filter={`url(#${uid}-n-soft8)`} />
                </g>

                {/* rim light */}
                <path d="M 68 214 A 108 108 0 0 1 108 78" fill="none" stroke="#e9c5ff" strokeWidth="3" strokeLinecap="round" opacity="0.5" filter={`url(#${uid}-n-soft3)`} />
                <circle cx="160" cy="160" r="108" fill="none" stroke="#b18cff" strokeWidth="1" opacity="0.35" />
            </g>
            {eyes}
        </>
    )
}

/* ------------------------------------------------------------------ *
 * Holographic HUD — Grok reference:
 * glass sphere shell over a dark void, cyan volumetric interior,
 * thin wireframe latitude/longitude, concentric radar rings outside,
 * a horizontal scanline sweep, corner framing brackets and
 * [ • ] bracket eyes.
 * ------------------------------------------------------------------ */
function HudArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-h-void`} cx="50%" cy="46%" r="58%">
                    <stop offset="0%" stopColor="#0d2b45" />
                    <stop offset="58%" stopColor="#071a2c" />
                    <stop offset="100%" stopColor="#030a14" />
                </radialGradient>
                <radialGradient id={`${uid}-h-halo`} cx="50%" cy="50%" r="50%">
                    <stop offset="55%" stopColor="#00e5ff" stopOpacity="0" />
                    <stop offset="78%" stopColor="#00e5ff" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${uid}-h-scan`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
                    <stop offset="50%" stopColor="#5ffaff" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`${uid}-h-glass`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bfefff" stopOpacity="0.34" />
                    <stop offset="38%" stopColor="#67e8f9" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0.16" />
                </linearGradient>
                <filter id={`${uid}-h-glow`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3.4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <clipPath id={`${uid}-h-clip`}><circle cx="160" cy="160" r="104" /></clipPath>
            </defs>

            <g className="pt-orb-decor">
                <circle cx="160" cy="160" r="150" fill={`url(#${uid}-h-halo)`} />
                <g className="pt-hud-rings" stroke="#00e5ff" fill="none">
                    <circle cx="160" cy="160" r="136" strokeWidth="1" strokeDasharray="3 10" opacity="0.5" />
                    <circle cx="160" cy="160" r="124" strokeWidth="0.8" strokeDasharray="46 6 10 6" opacity="0.45" />
                    <path d="M 160 14 v 14 M 160 292 v 14 M 14 160 h 14 M 292 160 h 14" strokeWidth="1.6" opacity="0.7" />
                </g>
            </g>

            <g className="pt-orb-body">
                <circle cx="160" cy="160" r="104" fill={`url(#${uid}-h-void)`} />

                <g clipPath={`url(#${uid}-h-clip)`} stroke="#57e8ff" fill="none">
                    {/* volumetric lat/long lattice */}
                    <g opacity="0.32" strokeWidth="0.8">
                        <ellipse cx="160" cy="160" rx="104" ry="30" />
                        <ellipse cx="160" cy="160" rx="104" ry="64" />
                        <ellipse cx="160" cy="160" rx="34" ry="104" />
                        <ellipse cx="160" cy="160" rx="70" ry="104" />
                    </g>
                    {/* inner rings */}
                    <circle cx="160" cy="160" r="58" strokeWidth="0.7" strokeDasharray="5 7" opacity="0.5" />
                    <circle cx="160" cy="160" r="78" strokeWidth="0.5" strokeDasharray="2 5" opacity="0.4" />
                    {/* glass shell light */}
                    <circle cx="160" cy="160" r="104" fill={`url(#${uid}-h-glass)`} stroke="#7deeff" strokeWidth="1.6" opacity="0.95" />
                    {/* sweep */}
                    <rect className="pt-hud-scan" x="60" y="66" width="200" height="10" fill={`url(#${uid}-h-scan)`} stroke="none" />
                    {/* top sheen */}
                    <ellipse cx="160" cy="104" rx="72" ry="22" fill="#cff9ff" opacity="0.2" filter={`url(#${uid}-h-glow)`} />
                </g>

                {/* framing brackets ride just outside the sphere */}
                <g stroke="#8df3ff" strokeWidth="2" fill="none" opacity="0.9" filter={`url(#${uid}-h-glow)`}>
                    <path d="M 84 118 v -22 h 22" />
                    <path d="M 236 118 v -22 h -22" />
                    <path d="M 84 202 v 22 h 22" />
                    <path d="M 236 202 v 22 h -22" />
                </g>
            </g>
            <text className="pt-hud-readout" x="160" y="218" fill="#9df3ff" fontSize="8.5" fontFamily="var(--font-geist-mono), ui-monospace, monospace" textAnchor="middle" letterSpacing="3" opacity="0.75">AI.CORE</text>
            {eyes}
        </>
    )
}

/* ------------------------------------------------------------------ *
 * Liquid Chrome — Grok reference:
 * real mirror sphere. Bright top-left studio light banding into
 * mid-grey, hot white C-spot highlight, dark lower reflections, and
 * an oil-slick prismatic band low on the curve. Slit aperture eyes.
 * ------------------------------------------------------------------ */
function ChromeArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-c-metal`} cx="34%" cy="26%" r="82%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="18%" stopColor="#f4f7fb" />
                    <stop offset="38%" stopColor="#cfd8e4" />
                    <stop offset="58%" stopColor="#8b97ab" />
                    <stop offset="78%" stopColor="#454f63" />
                    <stop offset="100%" stopColor="#151a26" />
                </radialGradient>
                <linearGradient id={`${uid}-c-iris`} x1="0%" y1="0%" x2="100%" y2="40%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="30%" stopColor="#818cf8" />
                    <stop offset="58%" stopColor="#e879f9" />
                    <stop offset="82%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#fde047" />
                </linearGradient>
                <radialGradient id={`${uid}-c-halo`} cx="50%" cy="50%" r="50%">
                    <stop offset="58%" stopColor="#cbd5e1" stopOpacity="0" />
                    <stop offset="80%" stopColor="#cbd5e1" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0" />
                </radialGradient>
                <filter id={`${uid}-c-soft`}><feGaussianBlur stdDeviation="4.5" /></filter>
                <clipPath id={`${uid}-c-clip`}><circle cx="160" cy="160" r="108" /></clipPath>
            </defs>

            <g className="pt-orb-decor">
                <circle cx="160" cy="160" r="148" fill={`url(#${uid}-c-halo)`} />
                <circle className="pt-chrome-ring" cx="160" cy="160" r="132" fill="none" stroke={`url(#${uid}-c-iris)`} strokeWidth="1.2" opacity="0.4" />
            </g>

            <g className="pt-orb-body">
                <circle cx="160" cy="160" r="108" fill={`url(#${uid}-c-metal)`} />

                <g clipPath={`url(#${uid}-c-clip)`}>
                    {/* dark floor reflection */}
                    <ellipse cx="160" cy="252" rx="130" ry="42" fill="#0b0f18" opacity="0.85" />
                    {/* prismatic oil-slick band */}
                    <path className="pt-chrome-iris" d="M 40 218 Q 130 176 282 214 L 282 296 L 40 296 Z" fill={`url(#${uid}-c-iris)`} opacity="0.55" filter={`url(#${uid}-c-soft)`} />
                    {/* specular C banding */}
                    <path d="M 76 96 Q 108 52 178 54 Q 232 58 248 96 Q 214 78 160 80 Q 108 82 76 96 Z" fill="#ffffff" opacity="0.85" filter={`url(#${uid}-c-soft)`} />
                    <ellipse cx="104" cy="86" rx="20" ry="10" fill="#ffffff" opacity="0.95" />
                    {/* edge occlusion */}
                    <path d="M 268 160 A 108 108 0 0 1 160 268" fill="none" stroke="#0d1220" strokeWidth="14" opacity="0.5" filter={`url(#${uid}-c-soft)`} />
                </g>

                <circle cx="160" cy="160" r="108" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.5" />
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
            {variant === "astral-nebula" && [[124, 148], [196, 148]].map(([cx, cy], i) => (
                <g key={i} className="pt-orb-eye pt-eye--star" style={{ transform: eyes[i].transform }}>
                    <path d={starPath(cx, cy, 15, 5)} fill="#fff5fd" />
                    <circle cx={cx} cy={cy} r="2.4" fill="#f9a8f4" />
                </g>
            ))}
            {variant === "holographic-hud" && [[120, 154], [194, 154]].map(([cx, cy], i) => (
                <g key={i} className="pt-orb-eye" style={{ transform: eyes[i].transform }} stroke="#aef6ff" strokeLinecap="round" filter={`url(#${uid}-h-glow)`}>
                    <path d={`M ${cx - 14} ${cy - 10} h -6 v 20 h 6 M ${cx + 14} ${cy - 10} h 6 v 20 h -6`} fill="none" strokeWidth="2.4" />
                    <circle cx={cx} cy={cy} r="4.4" fill="#7df3ff" stroke="none" />
                </g>
            ))}
            {variant === "liquid-chrome" && [[122, 156], [198, 156]].map(([cx, cy], i) => (
                <g key={i} className="pt-orb-eye" style={{ transform: eyes[i].transform }}>
                    <rect x={cx - 16} y={cy - 3.5} width="32" height="7" rx="3.5" fill="#0a0f1a" />
                    <rect x={cx - 16} y={cy - 3.5} width="32" height="2.6" rx="1.3" fill="#7dd3fc" opacity="0.55" />
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
