"use client"

import { useId, type ReactNode } from "react"
import "./mascot-orb.css"

export type MascotOrbVariant = "retro-tv" | "solid-gold" | "pencil-sketch" | "glass-bubble"
type Lid = "none" | "blink" | "wink-left" | "wink-right"

export function isMascotOrbVariant(value: string | null | undefined): value is MascotOrbVariant {
    return value === "retro-tv" || value === "solid-gold" || value === "pencil-sketch" || value === "glass-bubble"
}

const HAPPY = new Set(["heureux", "hilare", "excite", "fier"])
const SLEEPY = new Set(["somnolent", "blase"])
const WIDE = new Set(["surpris", "effraye"])

function eyeTransform(expression: string, index: number, closed: boolean): string {
    if (closed) return "scale(1, 0.12)"
    if (HAPPY.has(expression)) return "translateY(-1px) scale(1, 0.62)"
    if (SLEEPY.has(expression)) return "scale(1, 0.5)"
    if (WIDE.has(expression)) return "scale(1.18)"
    if (expression === "mefiant") return "scale(1.05, 0.45)"
    if (expression === "timide") return "translateY(3px) scale(0.9, 0.82)"
    if (expression === "attentif") return "translateY(-2px) scale(1.05, 1.12)"
    if (expression === "curieux") return index === 1 ? "scale(1.14)" : "scale(0.94)"
    if (expression === "triste") return "translateY(2px) scale(1, 0.8)"
    return "none"
}

/** One mouth grammar for every mascot; each character picks its position, scale and ink. */
function mouthPath(expression: string, mood: string, cx: number, cy: number, s = 1) {
    const w = 9 * s
    if (mood === "speaking") return `M${cx - w * 0.7} ${cy} a${w * 0.7} ${w * 0.8} 0 1 0 ${w * 1.4} 0 a${w * 0.7} ${w * 0.8} 0 1 0 ${-w * 1.4} 0`
    if (WIDE.has(expression)) return `M${cx - w * 0.45} ${cy} a${w * 0.45} ${w * 0.6} 0 1 0 ${w * 0.9} 0 a${w * 0.45} ${w * 0.6} 0 1 0 ${-w * 0.9} 0`
    if (expression === "triste" || mood === "error") return `M${cx - w} ${cy + 4 * s} Q${cx} ${cy - 4 * s} ${cx + w} ${cy + 4 * s}`
    if (HAPPY.has(expression)) return `M${cx - w * 1.3} ${cy - 3 * s} Q${cx} ${cy + 11 * s} ${cx + w * 1.3} ${cy - 3 * s}`
    if (expression === "timide") return `M${cx - w * 0.6} ${cy} Q${cx} ${cy + 4 * s} ${cx + w * 0.6} ${cy}`
    if (expression === "curieux") return `M${cx - w * 0.8} ${cy} Q${cx} ${cy + 5 * s} ${cx + w * 0.9} ${cy - 3 * s}`
    if (SLEEPY.has(expression) || expression === "mefiant") return `M${cx - w * 0.7} ${cy + 1} H${cx + w * 0.7}`
    if (expression === "attentif") return `M${cx - w * 0.6} ${cy} Q${cx} ${cy + 3.5 * s} ${cx + w * 0.6} ${cy}`
    return `M${cx - w} ${cy - s} Q${cx} ${cy + 7 * s} ${cx + w} ${cy - s}`
}

function isMouthFilled(expression: string, mood: string) {
    return mood === "speaking" || WIDE.has(expression)
}

type FaceProps = { expression: string; mood: string; eyes: { closed: boolean; transform: string }[]; dx: number; dy: number }
type ArtProps = { uid: string; detailed: boolean; face: FaceProps }

/* ------------------------------------------------------------------ *
 * Telly — a rounded retro television. Charcoal shell, sage-green tube
 * with scanlines and glare, sparkly kawaii eyes and blush.
 * ------------------------------------------------------------------ */
function TvArt({ uid, detailed, face }: ArtProps) {
    const { expression, mood, eyes, dx, dy } = face
    const ink = "#1f2421"
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-tv-shell`} x1="0" y1="0" x2="0.6" y2="1">
                    <stop offset="0" stopColor="#8a8c85" />
                    <stop offset="0.45" stopColor="#5a5c57" />
                    <stop offset="1" stopColor="#33352f" />
                </linearGradient>
                <radialGradient id={`${uid}-tv-screen`} cx="44%" cy="38%" r="72%">
                    <stop offset="0" stopColor="#b3cabb" />
                    <stop offset="0.55" stopColor="#89a596" />
                    <stop offset="1" stopColor="#587468" />
                </radialGradient>
                <radialGradient id={`${uid}-tv-vignette`} cx="50%" cy="50%" r="62%">
                    <stop offset="0.6" stopColor="#1c2a24" stopOpacity="0" />
                    <stop offset="1" stopColor="#1c2a24" stopOpacity="0.55" />
                </radialGradient>
                <pattern id={`${uid}-tv-scan`} width="4" height="3" patternUnits="userSpaceOnUse">
                    <rect width="4" height="1" fill="#0c1410" opacity="0.16" />
                </pattern>
                <clipPath id={`${uid}-tv-clip`}><rect x="72" y="80" width="176" height="146" rx="38" /></clipPath>
                <filter id={`${uid}-tv-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
            </defs>

            <g className="mo-decor">
                <ellipse cx="160" cy="276" rx="92" ry="9" fill="#2a2a24" opacity="0.16" filter={`url(#${uid}-tv-soft)`} />
            </g>

            <g className="mo-body">
                <rect x="52" y="58" width="216" height="204" rx="66" fill={`url(#${uid}-tv-shell)`} />
                <rect x="52.5" y="58.5" width="215" height="203" rx="65.5" fill="none" stroke="#24261f" strokeWidth="1" opacity="0.6" />
                <path d="M78 74 Q118 62 184 64" fill="none" stroke="#c4c6be" strokeWidth="3" strokeLinecap="round" opacity="0.28" filter={`url(#${uid}-tv-soft)`} />
                <rect x="65" y="73" width="190" height="160" rx="44" fill="#25272a" />
                <rect x="72" y="80" width="176" height="146" rx="38" fill={`url(#${uid}-tv-screen)`} />
                <g clipPath={`url(#${uid}-tv-clip)`}>
                    <rect className="mo-tv-scan" x="64" y="68" width="192" height="170" fill={`url(#${uid}-tv-scan)`} />
                    <rect x="72" y="80" width="176" height="146" fill={`url(#${uid}-tv-vignette)`} />
                    <rect className="mo-tv-glow" x="72" y="80" width="176" height="146" fill="#e8f5ec" opacity="0" />
                    {detailed && <ellipse cx="110" cy="102" rx="38" ry="13" transform="rotate(-22 110 102)" fill="#eef7f0" opacity="0.22" filter={`url(#${uid}-tv-soft)`} />}
                    <ellipse cx="160" cy="218" rx="76" ry="16" fill="#d7e8dc" opacity="0.16" filter={`url(#${uid}-tv-soft)`} />
                </g>
                <rect x="72.5" y="80.5" width="175" height="145" rx="37.5" fill="none" stroke="#dbe9de" strokeWidth="1" opacity="0.28" />
            </g>

            <g className="mo-face" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                <g fill={ink} opacity="0.2">
                    <ellipse cx="116" cy="168" rx="8" ry="3.5" />
                    <ellipse cx="204" cy="168" rx="8" ry="3.5" />
                </g>
                {[131, 189].map((cx, i) => (
                    <g key={cx} className="mo-eye" data-eye={i} style={{ transform: eyes[i].transform }}>
                        <circle cx={cx} cy="150" r="13" fill={ink} />
                        <circle cx={cx - 4.5} cy="145.5" r="4.4" fill="#fff" />
                        <path d={sparkle(cx + 4.5, 155, 3.4, 1.1)} fill="#fff" opacity="0.92" />
                    </g>
                ))}
                <path className="mo-mouth" d={mouthPath(expression, mood, 160, 170, 0.9)} fill={isMouthFilled(expression, mood) ? ink : "none"} stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </>
    )
}

function sparkle(x: number, y: number, r: number, c: number) {
    return `M${x} ${y - r} L${x + c} ${y - c} L${x + r} ${y} L${x + c} ${y + c} L${x} ${y + r} L${x - c} ${y + c} L${x - r} ${y} L${x - c} ${y - c} Z`
}

/* ------------------------------------------------------------------ *
 * Aurum — a polished gold sphere. Warm studio light, soft floor bounce,
 * glossy dark eyes set into the metal and an engraved smile.
 * ------------------------------------------------------------------ */
function GoldArt({ uid, detailed, face }: ArtProps) {
    const { expression, mood, eyes, dx, dy } = face
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-au-body`} cx="36%" cy="30%" r="80%">
                    <stop offset="0" stopColor="#fff6cf" />
                    <stop offset="0.18" stopColor="#f8dc84" />
                    <stop offset="0.46" stopColor="#e2b445" />
                    <stop offset="0.74" stopColor="#bb8721" />
                    <stop offset="1" stopColor="#7c5410" />
                </radialGradient>
                <radialGradient id={`${uid}-au-edge`} cx="50%" cy="50%" r="50%">
                    <stop offset="0.74" stopColor="#5a3a08" stopOpacity="0" />
                    <stop offset="1" stopColor="#5a3a08" stopOpacity="0.5" />
                </radialGradient>
                <radialGradient id={`${uid}-au-eye`} cx="38%" cy="32%" r="70%">
                    <stop offset="0" stopColor="#6d4619" />
                    <stop offset="0.55" stopColor="#2a190a" />
                    <stop offset="1" stopColor="#120a03" />
                </radialGradient>
                <linearGradient id={`${uid}-au-sweep`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id={`${uid}-au-clip`}><circle cx="160" cy="160" r="108" /></clipPath>
                <filter id={`${uid}-au-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
                <filter id={`${uid}-au-glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" /></filter>
            </defs>

            <g className="mo-decor">
                {detailed && <circle cx="160" cy="164" r="112" fill="#f6c95a" opacity="0.32" filter={`url(#${uid}-au-glow)`} />}
                <ellipse className="mo-shadow" cx="160" cy="284" rx="66" ry="8" fill="#3a2a0a" opacity="0.2" filter={`url(#${uid}-au-soft)`} />
            </g>

            <g className="mo-body">
                <circle cx="160" cy="160" r="108" fill={`url(#${uid}-au-body)`} />
                <g clipPath={`url(#${uid}-au-clip)`}>
                    <ellipse cx="160" cy="252" rx="104" ry="40" fill="#ffeaa8" opacity="0.3" filter={`url(#${uid}-au-soft)`} />
                    <ellipse cx="118" cy="98" rx="40" ry="22" transform="rotate(-32 118 98)" fill="#fff" opacity="0.5" filter={`url(#${uid}-au-soft)`} />
                    <ellipse cx="104" cy="88" rx="11" ry="6" transform="rotate(-32 104 88)" fill="#fff" opacity="0.92" />
                    <rect className="mo-gold-sweep" x="40" y="40" width="90" height="240" fill={`url(#${uid}-au-sweep)`} opacity="0" transform="skewX(-18)" />
                </g>
                <circle cx="160" cy="160" r="108" fill={`url(#${uid}-au-edge)`} />
            </g>

            <g className="mo-face" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                {[128, 192].map((cx, i) => (
                    <g key={cx} className="mo-eye" data-eye={i} style={{ transform: eyes[i].transform }}>
                        <circle cx={cx} cy="151" r="14.5" fill="#7a5210" opacity="0.45" />
                        <circle cx={cx} cy="150" r="12.5" fill={`url(#${uid}-au-eye)`} />
                        <circle cx={cx - 4} cy="146" r="4" fill="#fff" opacity="0.95" />
                        <circle cx={cx + 4.5} cy="155" r="1.7" fill="#ffe7a8" opacity="0.7" />
                    </g>
                ))}
                <g className="mo-mouth">
                    <path d={mouthPath(expression, mood, 160, 176, 0.95)} transform="translate(0 1.4)" fill="none" stroke="#ffe9a8" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
                    <path d={mouthPath(expression, mood, 160, 176, 0.95)} fill={isMouthFilled(expression, mood) ? "#3a2708" : "none"} stroke="#3a2708" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            </g>
        </>
    )
}

/* ------------------------------------------------------------------ *
 * Doodle — a ball of pencil scribbles. Deterministic overlapping
 * ellipses read as a hand-drawn sphere; ink colours live in CSS so the
 * graphite turns to chalk in dark mode.
 * ------------------------------------------------------------------ */
const SCRIBBLES = Array.from({ length: 34 }, (_, i) => ({
    rot: (i * 137.5) % 180,
    rx: 94 + Math.sin(i * 2.3) * 9,
    ry: 90 + Math.cos(i * 1.7) * 11,
    cx: 160 + Math.sin(i * 3.1) * 4,
    cy: 162 + Math.cos(i * 2.7) * 4,
    opacity: 0.3 + ((i * 7) % 5) * 0.09,
    width: 0.6 + ((i * 3) % 4) * 0.18,
}))

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
    const a = (from * Math.PI) / 180
    const b = (to * Math.PI) / 180
    return `M${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + Math.cos(b) * r).toFixed(1)} ${(cy + Math.sin(b) * r).toFixed(1)}`
}

const INNER = Array.from({ length: 12 }, (_, i) => ({
    rot: (i * 61 + 20) % 180,
    rx: 58 + Math.sin(i * 1.9) * 16 + i * 1.6,
    ry: 76 + Math.cos(i * 2.4) * 14,
    cx: 160 + Math.cos(i * 1.3) * 7,
    cy: 162 + Math.sin(i * 1.1) * 7,
    opacity: 0.12 + ((i * 5) % 4) * 0.05,
}))

const SHADING = Array.from({ length: 7 }, (_, i) => arcPath(160 - i * 1.5, 162 - i * 1.2, 100 - i * 4.2, 8 + i * 6, 96 + i * 4))

function SketchArt({ uid, detailed, face }: ArtProps) {
    const { expression, mood, eyes, dx, dy } = face
    return (
        <>
            <defs>
                <pattern id={`${uid}-sk-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
                    <path className="mo-sketch-ink" d="M0 2.5H5" strokeWidth="0.8" />
                </pattern>
            </defs>

            <g className="mo-decor">
                <ellipse className="mo-shadow" cx="160" cy="270" rx="78" ry="8" fill={`url(#${uid}-sk-hatch)`} opacity="0.55" />
                <path className="mo-sketch-ink" d="M84 270 Q160 262 236 270" fill="none" strokeWidth="0.7" opacity="0.5" />
            </g>

            <g className="mo-body">
                <circle className="mo-sketch-fill" cx="160" cy="162" r="98" />
                <g className="mo-sketch-lines" fill="none">
                    {SCRIBBLES.filter((_, i) => detailed || i % 2 === 0).map((line, i) => (
                        <ellipse key={i} className="mo-sketch-ink" cx={line.cx} cy={line.cy} rx={line.rx} ry={line.ry} transform={`rotate(${line.rot} ${line.cx} ${line.cy})`} strokeWidth={line.width} opacity={line.opacity} />
                    ))}
                    {detailed && INNER.map((line, i) => (
                        <ellipse key={`in-${i}`} className="mo-sketch-ink" cx={line.cx} cy={line.cy} rx={line.rx} ry={line.ry} transform={`rotate(${line.rot} ${line.cx} ${line.cy})`} strokeWidth="0.6" opacity={line.opacity} />
                    ))}
                    {detailed && SHADING.map((d, i) => <path key={i} className="mo-sketch-ink" d={d} strokeWidth={0.9 + (i % 3) * 0.25} opacity={0.38 + (i % 2) * 0.14} />)}
                </g>
            </g>

            <g className="mo-face" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                {[138, 182].map((cx, i) => (
                    <g key={cx} className="mo-eye" data-eye={i} style={{ transform: eyes[i].transform }}>
                        <ellipse className="mo-sketch-eye" cx={cx} cy="158" rx="5.6" ry="9.6" />
                        <ellipse className="mo-sketch-ink" cx={cx} cy="158" rx="6.4" ry="10.4" transform={`rotate(${i === 0 ? -7 : 6} ${cx} 158)`} fill="none" strokeWidth="0.8" opacity="0.55" />
                    </g>
                ))}
                <path className="mo-mouth mo-sketch-ink" d={mouthPath(expression, mood, 160, 182, 0.85)} fill={isMouthFilled(expression, mood) ? "currentColor" : "none"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" opacity={expression === "centre" && mood === "idle" ? 0.5 : 0.9} />
            </g>
        </>
    )
}

/* ------------------------------------------------------------------ *
 * Pearl — a soap bubble. Mostly transparent body so any canvas shows
 * through, iridescent rim, bright top-left catchlight, warm inner glow.
 * ------------------------------------------------------------------ */
function BubbleArt({ uid, detailed, face }: ArtProps) {
    const { expression, mood, eyes, dx, dy } = face
    const ink = "#1c2340"
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-bb-body`} cx="50%" cy="44%" r="56%">
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
                    <stop offset="0.55" stopColor="#f2f4fc" stopOpacity="0.5" />
                    <stop offset="0.86" stopColor="#e1e6f8" stopOpacity="0.62" />
                    <stop offset="0.97" stopColor="#c9d2f0" stopOpacity="0.86" />
                    <stop offset="1" stopColor="#b9c4ec" stopOpacity="0.95" />
                </radialGradient>
                <radialGradient id={`${uid}-bb-glow`} cx="50%" cy="80%" r="46%">
                    <stop offset="0" stopColor="#fff6fa" stopOpacity="0.95" />
                    <stop offset="0.55" stopColor="#ffe9f3" stopOpacity="0.32" />
                    <stop offset="1" stopColor="#ffe9f3" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${uid}-bb-iris`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#9ec5ff" />
                    <stop offset="0.35" stopColor="#f2b6ef" />
                    <stop offset="0.7" stopColor="#b6f0e2" />
                    <stop offset="1" stopColor="#ffd9a8" />
                </linearGradient>
                <radialGradient id={`${uid}-bb-eye`} cx="40%" cy="35%" r="70%">
                    <stop offset="0" stopColor="#3b4670" />
                    <stop offset="1" stopColor="#141a33" />
                </radialGradient>
                <clipPath id={`${uid}-bb-clip`}><circle cx="160" cy="160" r="106" /></clipPath>
                <filter id={`${uid}-bb-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" /></filter>
                <filter id={`${uid}-bb-soft2`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2" /></filter>
            </defs>

            <g className="mo-decor">
                <ellipse className="mo-shadow" cx="160" cy="284" rx="62" ry="8" fill="#4a5370" opacity="0.16" filter={`url(#${uid}-bb-soft)`} />
            </g>

            <g className="mo-body">
                <circle cx="160" cy="160" r="106" fill={`url(#${uid}-bb-body)`} />
                <g clipPath={`url(#${uid}-bb-clip)`}>
                    <circle cx="160" cy="160" r="106" fill={`url(#${uid}-bb-glow)`} />
                    <circle className="mo-bubble-inner" cx="160" cy="160" r="99" fill="none" stroke={`url(#${uid}-bb-iris)`} strokeWidth="6" opacity="0.32" filter={`url(#${uid}-bb-soft2)`} />
                    {detailed && <ellipse cx="118" cy="96" rx="40" ry="22" transform="rotate(-36 118 96)" fill="#fff" opacity="0.7" filter={`url(#${uid}-bb-soft)`} />}
                    <ellipse cx="110" cy="88" rx="15" ry="7" transform="rotate(-36 110 88)" fill="#fff" opacity="0.95" />
                    <ellipse cx="216" cy="228" rx="12" ry="4.5" transform="rotate(-36 216 228)" fill="#fff" opacity="0.6" />
                </g>
                <g className="mo-bubble-rim">
                    <circle cx="160" cy="160" r="106" fill="none" stroke={`url(#${uid}-bb-iris)`} strokeWidth="1.8" opacity="0.85" />
                </g>
                <circle cx="160" cy="160" r="105" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.55" />
            </g>

            <g className="mo-face" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                {[134, 186].map((cx, i) => (
                    <g key={cx} className="mo-eye" data-eye={i} style={{ transform: eyes[i].transform }}>
                        <ellipse cx={cx} cy="150" rx="8" ry="9.6" fill={`url(#${uid}-bb-eye)`} />
                        <circle cx={cx - 2.6} cy="146" r="2.8" fill="#fff" />
                    </g>
                ))}
                <path className="mo-mouth" d={mouthPath(expression, mood, 160, 168, 0.9)} fill={isMouthFilled(expression, mood) ? ink : "none"} stroke={ink} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </>
    )
}

const ART: Record<MascotOrbVariant, (props: ArtProps) => ReactNode> = {
    "retro-tv": TvArt,
    "solid-gold": GoldArt,
    "pencil-sketch": SketchArt,
    "glass-bubble": BubbleArt,
}

export function MascotOrb({
    variant,
    size,
    gaze = { x: 0, y: 0 },
    lid = "none",
    expression = "centre",
    still = false,
    aura = "still",
    mood = "idle",
}: {
    variant: MascotOrbVariant
    size: number
    gaze?: { x: number; y: number }
    lid?: Lid
    expression?: string
    still?: boolean
    aura?: string
    mood?: string
}) {
    const uid = `mo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
    const dx = still ? 0 : Math.round(Math.max(-1, Math.min(1, gaze.x)) * 60) / 10
    const dy = still ? 0 : Math.round(Math.max(-1, Math.min(1, -gaze.y)) * 45) / 10
    const eyes = [0, 1].map((index) => {
        const closed = !still && (lid === "blink" || lid === (index === 0 ? "wink-left" : "wink-right"))
        return { closed, transform: eyeTransform(expression, index, closed) }
    })
    const Art = ART[variant] ?? BubbleArt

    return (
        <svg
            className={`mo-orb mo-orb--${variant}`}
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
            <g className="mo-character">
                <Art uid={uid} detailed={size >= 88} face={{ expression, mood, eyes, dx, dy }} />
            </g>
        </svg>
    )
}
