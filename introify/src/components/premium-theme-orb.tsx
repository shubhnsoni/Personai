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

            {/* orbiting dust */}
            <g className="pt-orb-decor">
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

/* Keep the saved theme ID compatible with the floating glass globe. */
function HologramArt({ uid, eyes }: { uid: string; eyes: React.ReactNode }) {
    const dust = Array.from({ length: 76 }, (_, i) => {
        const angle = i * 2.399963229728653
        const distance = Math.sqrt((i + 0.5) / 76) * 100
        return { x: 160 + Math.cos(angle) * distance, y: 151 + Math.sin(angle) * distance, r: i % 7 === 0 ? 0.9 : 0.45 }
    })
    return (
        <>
            <defs>
                <radialGradient id={`${uid}-h-glass`} cx="48%" cy="43%" r="58%">
                    <stop offset="0%" stopColor="#102a47" stopOpacity="0.9" />
                    <stop offset="62%" stopColor="#153955" stopOpacity="0.8" />
                    <stop offset="85%" stopColor="#3e7ba3" stopOpacity="0.78" />
                    <stop offset="96%" stopColor="#a0d7f9" stopOpacity="0.82" />
                    <stop offset="100%" stopColor="#e2f7ff" stopOpacity="0.94" />
                </radialGradient>
                <radialGradient id={`${uid}-h-bottom`} cx="50%" cy="100%" r="76%">
                    <stop offset="0%" stopColor="#bcf3ff" stopOpacity="0.95" />
                    <stop offset="24%" stopColor="#56bcef" stopOpacity="0.42" />
                    <stop offset="72%" stopColor="#65bffc" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`${uid}-h-sheen`} cx="29%" cy="16%" r="62%">
                    <stop offset="0%" stopColor="#edfaff" stopOpacity="0.62" />
                    <stop offset="30%" stopColor="#9bd3f8" stopOpacity="0.14" />
                    <stop offset="68%" stopColor="#a0ddff" stopOpacity="0" />
                </radialGradient>
                <filter id={`${uid}-h-soft`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="5" />
                </filter>
                <filter id={`${uid}-h-glow`} x="-80%" y="-100%" width="260%" height="300%">
                    <feGaussianBlur stdDeviation="2.8" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <clipPath id={`${uid}-h-clip`}><circle cx="160" cy="151" r="106" /></clipPath>
            </defs>
            <g className="pt-orb-body pt-holo-globe">
                <circle cx="160" cy="151" r="106" fill={`url(#${uid}-h-glass)`} />
                <g clipPath={`url(#${uid}-h-clip)`}>
                    <circle cx="160" cy="151" r="106" fill={`url(#${uid}-h-bottom)`} />
                    <g className="pt-holo-grid" stroke="#c5e9ff" strokeWidth="0.55" fill="none">
                        {[-95, -80, -59, -32, 0, 32, 59, 80, 95].map(offset => (
                            <ellipse key={offset} cx="160" cy={151 + offset} rx={Math.sqrt(106 ** 2 - offset ** 2)} ry={4 + (1 - Math.abs(offset) / 106) * 9} opacity="0.25" />
                        ))}
                        {[24, 49, 74, 95].map(rx => <ellipse key={rx} cx="160" cy="151" rx={rx} ry="106" opacity="0.22" />)}
                        <path d="M160 45V257" opacity="0.26" />
                    </g>
                    <g className="pt-holo-dust" fill="#dcf5ff">
                        {dust.map(({ x, y, r }, i) => <circle key={i} cx={x} cy={y} r={r} opacity={i % 3 === 0 ? 0.7 : 0.34} />)}
                    </g>
                    <circle cx="160" cy="151" r="106" fill={`url(#${uid}-h-sheen)`} />
                    <path d="M65 127C71 87 101 58 142 51" stroke="#eefaff" strokeWidth="8" opacity="0.22" fill="none" filter={`url(#${uid}-h-soft)`} />
                </g>
                <circle className="pt-holo-rim" cx="160" cy="151" r="106" fill="none" stroke="#a7ddff" strokeWidth="1.1" opacity="0.9" filter={`url(#${uid}-h-glow)`} />
                <path d="M81 80A106 106 0 0 1 237 78M100 238A106 106 0 0 0 220 238" fill="none" stroke="#e4f8ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
            </g>
            {eyes}
        </>
    )
}

function hologramEye(expression: string, cx: number, index: number, closed: boolean) {
    if (closed) return `M${cx - 10} 148Q${cx} 151 ${cx + 10} 148`
    if (HAPPY.has(expression)) return `M${cx - 11} 149Q${cx} 134 ${cx + 11} 149`
    if (WIDE.has(expression)) return `M${cx} 139a6 9 0 1 0 0 18a6 9 0 1 0 0-18`
    if (SLEEPY.has(expression)) return `M${cx - 9} 149Q${cx} 153 ${cx + 9} 149`
    if (expression === "attentif") return `M${cx} 140V152`
    if (expression === "curieux") return index === 0 ? `M${cx - 9} 148Q${cx} 138 ${cx + 9} 148` : `M${cx} 138V152`
    if (expression === "timide") return `M${cx - 6} 152Q${cx} 146 ${cx + 6} 152`
    if (expression === "triste") return `M${cx - 9} ${index === 0 ? 149 : 144}Q${cx} 143 ${cx + 9} ${index === 0 ? 144 : 149}`
    if (expression === "mefiant") return `M${cx - 10} ${index === 0 ? 143 : 149}L${cx + 10} ${index === 0 ? 149 : 143}`
    return `M${cx - 8} 148Q${cx} 143 ${cx + 8} 148`
}

function hologramMouth(expression: string, mood: string) {
    if (mood === "speaking") return "M153 174C153 167 168 167 168 174C168 183 153 183 153 174Z"
    if (WIDE.has(expression)) return "M155 174a5 7 0 1 0 10 0a5 7 0 1 0-10 0"
    if (expression === "triste") return "M149 181Q160 170 171 181"
    if (HAPPY.has(expression)) return "M147 172Q160 186 173 172"
    if (expression === "timide") return "M154 178Q160 182 166 178"
    if (expression === "curieux") return "M155 177Q162 181 169 175"
    if (SLEEPY.has(expression) || expression === "mefiant") return "M154 178H166"
    return "M151 175Q160 184 169 175"
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
                <filter id={`${uid}-c-soft`}><feGaussianBlur stdDeviation="4.5" /></filter>
                <clipPath id={`${uid}-c-clip`}><circle cx="160" cy="160" r="108" /></clipPath>
            </defs>

            <g className="pt-orb-decor">
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
        const closed = !still && (lid === "blink" || lid === (index === 0 ? "wink-left" : "wink-right"))
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
            {variant === "holographic-hud" && <g className="pt-holo-face" fill="none" stroke="#c8f1ff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-h-glow)`}>
                {[128, 192].map((cx, index) => <path
                    key={index}
                    className="pt-orb-eye pt-holo-eye"
                    data-hologram-eye={index}
                    d={hologramEye(expression, cx, index, !still && (lid === "blink" || lid === (index === 0 ? "wink-left" : "wink-right")))}
                />)}
                <path className="pt-holo-mouth" d={hologramMouth(expression, mood)} strokeWidth="2.9" />
            </g>}
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
                {variant === "holographic-hud" && (
                    // The former projector layout placed the globe at y=151.
                    // Centre the complete globe, including its face, on the aura at y=160.
                    <g transform="translate(0 9)"><HologramArt uid={uid} eyes={eyesNode} /></g>
                )}
                {variant === "liquid-chrome" && <ChromeArt uid={uid} eyes={eyesNode} />}
            </g>
        </svg>
    )
}
