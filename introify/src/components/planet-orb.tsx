"use client"

import { useId, type CSSProperties } from "react"
import "./planet-orb.css"

export type PlanetOrbVariant = "planet-azure" | "planet-rose" | "planet-sage"
type Lid = "none" | "blink" | "wink-left" | "wink-right"

export function isPlanetOrbVariant(value: string | null | undefined): value is PlanetOrbVariant {
    return value === "planet-azure" || value === "planet-rose" || value === "planet-sage"
}

const PALETTES = {
    "planet-azure": { light: "#edfaff", mist: "#c9ebfa", cloud: "#d7f7ff", base: "#91c5e9", middle: "#568ec5", shade: "#163d7c", rim: "#a8e5ff", eye: "#09254f", iris: "#477db3" },
    "planet-rose": { light: "#fff2f4", mist: "#f6d4e4", cloud: "#ffeaf2", base: "#dea3c5", middle: "#ad6f9d", shade: "#583363", rim: "#ffcbec", eye: "#442249", iris: "#a36f9c" },
    "planet-sage": { light: "#f0fff4", mist: "#d5efdf", cloud: "#e3ffed", base: "#a2cdb6", middle: "#629f8d", shade: "#245c57", rim: "#bdffdb", eye: "#123d36", iris: "#4f9d84" },
} satisfies Record<PlanetOrbVariant, Record<string, string>>

// Long continuous contours keep the cloud layer seamless while it drifts across the globe.
function cloudLine(y: number, phase: number, strength = 1) {
    return Array.from({ length: 61 }, (_, i) => {
        const x = i * 8 - 80
        const wave = Math.sin(x / 33 + phase) * 12 + Math.sin(x / 59 + phase * 0.7) * 12 + Math.cos(x / 14 + phase) * 1.4
        return `${i === 0 ? "M" : "L"}${x},${(y + wave * strength).toFixed(2)}`
    }).join(" ")
}

const BANDS = Array.from({ length: 23 }, (_, i) => ({
    path: cloudLine(167 + i * 3.2, 1.5 + i * 0.066, 0.75 + Math.sin(i / 9) * 0.34),
    width: i % 5 === 0 ? 2 : i % 3 === 0 ? 1.1 : 0.65,
    opacity: i % 5 === 0 ? 0.53 : i % 3 === 0 ? 0.34 : 0.21,
}))

function eyeScale(expression: string, closed: boolean, index: number) {
    if (closed) return "scale(1, .09)"
    if (["somnolent", "blase", "mefiant"].includes(expression)) return "scale(1, .5)"
    if (["surpris", "effraye"].includes(expression)) return "scale(1.16, 1.2)"
    if (expression === "attentif") return "scale(1.04, 1.22)"
    if (expression === "curieux" && index === 1) return "scale(1.08, 1.18)"
    if (expression === "timide") return "translate(0, 2px) scale(.86, .8)"
    return "scale(1)"
}

function mouthShape(expression: string, mood: string) {
    if (expression === "triste" || mood === "error") return "M154 168 Q161 161 168 168"
    if (expression === "surpris" || expression === "effraye") return "M161 163 C155 163 155 173 161 173 C167 173 167 163 161 163 Z"
    if (mood === "speaking") return "M154 163 Q161 165 168 163 Q167 173 161 173 Q155 173 154 163 Z"
    if (["heureux", "hilare", "excite"].includes(expression)) return "M151 161 Q161 175 171 161"
    if (expression === "attentif") return "M157 165 Q161 168 165 165"
    if (expression === "curieux") return "M155 166 Q161 169 168 163"
    if (expression === "timide") return "M158 168 Q162 172 166 168"
    return "M154 163 Q161 170 168 163"
}

export interface PlanetOrbProps {
    size: number
    variant?: PlanetOrbVariant
    mood?: string
    expression?: string
    gaze?: { x: number; y: number }
    lid?: Lid
    still?: boolean
    frozenAt?: number
    speed?: number
}

/** A transparent atmospheric globe; profile satellites belong to the shared orbit layer. */
export function PlanetOrb({
    size,
    variant = "planet-azure",
    mood = "idle",
    expression = "centre",
    gaze = { x: 0, y: 0 },
    lid = "none",
    still = false,
    frozenAt,
    speed = 1,
}: PlanetOrbProps) {
    const uid = `planet-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
    const palette = PALETTES[variant] ?? PALETTES["planet-azure"]
    const frozen = Number.isFinite(frozenAt)
    const motionSpeed = Number.isFinite(speed) ? Math.min(3, Math.max(0.2, speed)) : 1
    const style = {
        "--planet-unit": `${1 / motionSpeed}s`,
        "--planet-delay": `${frozen ? -Math.max(0, frozenAt!) : 0}s`,
    } as CSSProperties
    const dx = still ? 0 : Math.max(-1, Math.min(1, gaze.x)) * 5
    const dy = still ? 0 : Math.max(-1, Math.min(1, -gaze.y)) * 4
    const detailed = size >= 88
    const happy = ["heureux", "hilare", "excite"].includes(expression)
    const surprised = expression === "surpris" || expression === "effraye"
    const sad = expression === "triste" || mood === "error"

    return (
        <svg className={`planet-orb planet-orb--${variant}`} width={size} height={size} viewBox="0 0 320 320"
            style={style} data-mood={mood} data-expression={expression} data-still={still} data-frozen={frozen}
            aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id={`${uid}-sphere`} cx="31%" cy="22%" r="83%">
                    <stop offset="0" stopColor={palette.light} />
                    <stop offset=".24" stopColor={palette.mist} />
                    <stop offset=".51" stopColor={palette.base} />
                    <stop offset=".77" stopColor={palette.middle} />
                    <stop offset="1" stopColor={palette.shade} />
                </radialGradient>
                <radialGradient id={`${uid}-limb`} cx="42%" cy="37%" r="63%">
                    <stop offset=".55" stopColor={palette.shade} stopOpacity="0" />
                    <stop offset=".87" stopColor={palette.shade} stopOpacity=".17" />
                    <stop offset="1" stopColor={palette.shade} stopOpacity=".7" />
                </radialGradient>
                <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2=".8" y2="1">
                    <stop offset="0" stopColor={palette.light} stopOpacity=".95" />
                    <stop offset=".32" stopColor={palette.rim} stopOpacity=".7" />
                    <stop offset=".66" stopColor={palette.rim} stopOpacity=".08" />
                    <stop offset="1" stopColor={palette.rim} stopOpacity=".4" />
                </linearGradient>
                <radialGradient id={`${uid}-gloss`} cx="38%" cy="25%" r="70%">
                    <stop offset="0" stopColor={palette.iris} />
                    <stop offset=".37" stopColor={palette.eye} />
                    <stop offset=".85" stopColor={palette.eye} />
                    <stop offset="1" stopColor={palette.iris} />
                </radialGradient>
                <radialGradient id={`${uid}-shine`} cx="30%" cy="23%" r="55%">
                    <stop stopColor="#fff" stopOpacity=".52" />
                    <stop offset=".47" stopColor={palette.cloud} stopOpacity=".13" />
                    <stop offset="1" stopColor={palette.cloud} stopOpacity="0" />
                </radialGradient>
                <clipPath id={`${uid}-clip`}><circle cx="160" cy="160" r="103" /></clipPath>
                <filter id={`${uid}-haze`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
                {detailed && <filter id={`${uid}-wind`} x="-10%" y="-30%" width="120%" height="160%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency=".012 .037" numOctaves="2" seed="9" result="wind" />
                    <feDisplacementMap in="SourceGraphic" in2="wind" scale="4" xChannelSelector="R" yChannelSelector="G" />
                </filter>}
                {detailed && <filter id={`${uid}-cloud-texture`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency=".022 .037" numOctaves="3" seed="12" result="noise" />
                    <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.9 0 0 0 -.77" />
                    <feComposite in2="SourceGraphic" operator="in" />
                </filter>}
            </defs>
            <g className="planet-character">
                <circle cx="160" cy="160" r="103" fill={`url(#${uid}-sphere)`} />
                <g clipPath={`url(#${uid}-clip)`}>
                    {detailed && <g className="planet-weather-texture" opacity=".44">
                        <rect x="55" y="55" width="210" height="210" fill={palette.cloud} filter={`url(#${uid}-cloud-texture)`} />
                    </g>}
                    <g className="planet-clouds" fill="none" stroke={palette.cloud} filter={detailed ? `url(#${uid}-wind)` : undefined}>
                        <path d={cloudLine(190, 1.9)} strokeWidth="18" opacity=".38" filter={`url(#${uid}-haze)`} />
                        <path d={cloudLine(215, 2.15)} strokeWidth="11" opacity=".21" filter={`url(#${uid}-haze)`} />
                        {BANDS.filter((_, i) => detailed || i % 3 === 0).map((band, i) => <path key={i} d={band.path} strokeWidth={band.width} opacity={band.opacity} />)}
                        <path d="M69 115 C88 133 76 158 109 160 C141 162 115 137 99 146 C85 155 105 174 132 166 C153 160 151 152 175 156" strokeWidth="1.3" opacity=".26" />
                        <path d="M79 111 C104 138 82 149 111 151 C128 154 136 164 158 161" strokeWidth="3" opacity=".2" filter={`url(#${uid}-haze)`} />
                        <path d={cloudLine(104, 0.8, 0.4)} strokeWidth="1.5" opacity=".18" />
                        <path d={cloudLine(112, 0.95, 0.4)} strokeWidth=".7" opacity=".2" />
                    </g>
                    <circle cx="160" cy="160" r="103" fill={`url(#${uid}-shine)`} />
                    <circle cx="160" cy="160" r="103" fill={`url(#${uid}-limb)`} />
                </g>
                <circle cx="160" cy="160" r="102.7" stroke={`url(#${uid}-rim)`} strokeWidth="1.5" fill="none" />
                <path d="M67 132 A99 99 0 0 1 171 61" fill="none" stroke={palette.light} strokeWidth="2.5" strokeLinecap="round" opacity=".53" filter={`url(#${uid}-haze)`} />
                <g transform={`translate(${dx} ${dy})`}>
                    <g className="planet-face">
                        {[140, 182].map((cx, index) => {
                            const closed = !still && (lid === "blink" || lid === (index === 0 ? "wink-left" : "wink-right"))
                            return <g key={cx} className="planet-eye" data-eye={index} style={{ transform: eyeScale(expression, closed, index) }}>
                                {happy ? <path className="planet-eye-smile" d={`M${cx - 6} 151 Q${cx} 140 ${cx + 6} 151`} fill="none" stroke={palette.eye} strokeWidth="3.4" strokeLinecap="round" /> : <>
                                <ellipse cx={cx} cy="150" rx="6.3" ry="9.3" fill={palette.rim} opacity=".27" transform={`translate(0 1.1)`} />
                                <ellipse cx={cx} cy="149" rx="5.7" ry="8.7" fill={`url(#${uid}-gloss)`} />
                                <ellipse cx={cx - 1.7} cy="145.6" rx="1.65" ry="2.4" fill="#fff" opacity=".88" />
                                <circle cx={cx + 1.7} cy="152.7" r=".8" fill={palette.rim} opacity=".56" />
                                </>}
                            </g>
                        })}
                        {(expression === "attentif" || expression === "curieux" || surprised || sad) && <g className="planet-brows" fill="none" stroke={palette.eye} strokeWidth="1.7" strokeLinecap="round" opacity=".72">
                            <path d={sad ? "M134 135 Q141 136 146 131" : surprised ? "M133 130 Q140 125 147 130" : "M134 134 Q140 131 146 133"} />
                            <path d={sad ? "M176 131 Q181 136 188 135" : surprised || expression === "curieux" ? "M175 130 Q182 125 189 130" : "M176 133 Q182 131 188 134"} />
                        </g>}
                        {expression === "timide" && <g className="planet-cheeks" fill={palette.eye} opacity=".22">
                            <ellipse cx="131" cy="164" rx="5.5" ry="2.3" />
                            <ellipse cx="191" cy="164" rx="5.5" ry="2.3" />
                        </g>}
                        <path className="planet-mouth" d={mouthShape(expression, mood)} fill={!sad && (surprised || mood === "speaking") ? palette.eye : "none"} stroke={palette.eye} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                </g>
            </g>
        </svg>
    )
}
