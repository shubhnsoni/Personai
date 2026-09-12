"use client"

import { useId, type CSSProperties } from "react"
import "./planet-orb.css"

export type PlanetOrbVariant =
    | "planet-azure" | "planet-rose" | "planet-sage"
    | "planet-mercury" | "planet-venus" | "planet-earth" | "planet-mars" | "planet-jupiter" | "planet-saturn" | "planet-uranus" | "planet-neptune" | "planet-pluto"
type Lid = "none" | "blink" | "wink-left" | "wink-right"

type Palette = {
    light: string; mist: string; cloud: string; base: string; middle: string; shade: string; rim: string; eye: string; iris: string
    /** Rocky worlds skip the drifting cloud layer; gas giants can thicken it. */
    clouds?: "none" | "thin" | "thick"
    /** A tilted ring system: [rx, ry, tilt in degrees, stroke width]. */
    ring?: [number, number, number, number]
}

const PALETTES: Record<PlanetOrbVariant, Palette> = {
    "planet-azure": { light: "#edfaff", mist: "#c9ebfa", cloud: "#d7f7ff", base: "#91c5e9", middle: "#568ec5", shade: "#163d7c", rim: "#a8e5ff", eye: "#09254f", iris: "#477db3" },
    "planet-rose": { light: "#fff2f4", mist: "#f6d4e4", cloud: "#ffeaf2", base: "#dea3c5", middle: "#ad6f9d", shade: "#583363", rim: "#ffcbec", eye: "#442249", iris: "#a36f9c" },
    "planet-sage": { light: "#f0fff4", mist: "#d5efdf", cloud: "#e3ffed", base: "#a2cdb6", middle: "#629f8d", shade: "#245c57", rim: "#bdffdb", eye: "#123d36", iris: "#4f9d84" },
    "planet-mercury": { light: "#f4f1ec", mist: "#d9d3ca", cloud: "#e8e2d8", base: "#a9a19a", middle: "#756c66", shade: "#3a332f", rim: "#e6dfd5", eye: "#26211f", iris: "#6e6560", clouds: "none" },
    "planet-venus": { light: "#fff8e6", mist: "#f9e3b3", cloud: "#fff1cf", base: "#e5b872", middle: "#c48b3f", shade: "#7a4f1c", rim: "#ffe6ad", eye: "#4a2e10", iris: "#b27c3a", clouds: "thick" },
    "planet-earth": { light: "#dff1ff", mist: "#9ccdf2", cloud: "#ffffff", base: "#3f8fd6", middle: "#2461ab", shade: "#0f3366", rim: "#b8e6ff", eye: "#0d2a4d", iris: "#3b7fbf", clouds: "none" },
    "planet-mars": { light: "#ffe9dc", mist: "#f6c3a6", cloud: "#f8d9c8", base: "#d9743f", middle: "#a9472a", shade: "#5a2314", rim: "#ffc7a6", eye: "#3a1a0e", iris: "#b4553a", clouds: "none" },
    "planet-jupiter": { light: "#fff4e4", mist: "#f3d9b5", cloud: "#8a5a36", base: "#d6a670", middle: "#a8734a", shade: "#5c3a22", rim: "#ffe0b8", eye: "#3d2412", iris: "#a06b45", clouds: "thick" },
    "planet-saturn": { light: "#fff8e8", mist: "#f5e4bf", cloud: "#b8955a", base: "#e3c48b", middle: "#b8955a", shade: "#6b5230", rim: "#ffecc0", eye: "#42301a", iris: "#a58452", clouds: "thin", ring: [154, 34, -16, 14] },
    "planet-uranus": { light: "#f0fdff", mist: "#c8f2f7", cloud: "#e4fbfd", base: "#8fd9e3", middle: "#4fa9b8", shade: "#1e5f6e", rim: "#c4f5fb", eye: "#0f3a44", iris: "#3f95a5", clouds: "thin" },
    "planet-neptune": { light: "#e8efff", mist: "#b9c9ff", cloud: "#d6e0ff", base: "#4c6fe0", middle: "#2f48b3", shade: "#141f66", rim: "#b3c4ff", eye: "#0c1548", iris: "#4258c4", clouds: "thin" },
    "planet-pluto": { light: "#fbf1e6", mist: "#e8cdb4", cloud: "#f3e4d4", base: "#c99f80", middle: "#8c6047", shade: "#4a2d23", rim: "#f2dcc8", eye: "#2f1f17", iris: "#8a6a55", clouds: "none" },
}

export function isPlanetOrbVariant(value: string | null | undefined): value is PlanetOrbVariant {
    return typeof value === "string" && Object.hasOwn(PALETTES, value)
}

/** Surface details that make each world recognisable at a glance. All sit inside the globe clip. */
function PlanetFeatures({ variant, palette, uid }: { variant: PlanetOrbVariant; palette: Palette; uid: string }) {
    switch (variant) {
        case "planet-mercury":
            return <g className="planet-features" fill={palette.shade} opacity=".5">
                {[[112, 128, 11], [214, 118, 8], [190, 208, 14], [96, 196, 7], [150, 236, 9], [232, 176, 6], [130, 92, 5]].map(([cx, cy, r]) => (
                    <g key={`${cx}-${cy}`}>
                        <circle cx={cx} cy={cy} r={r} />
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.light} strokeWidth="1.2" opacity=".55" />
                    </g>
                ))}
            </g>
        case "planet-earth": {
            // Continents read as the Atlantic hemisphere: the Americas on the left, Europe and Africa on the right.
            const land = "#5f9e57"
            const coast = "#3c7a43"
            return <g className="planet-features">
                <g fill={land} stroke={coast} strokeWidth="1.3" strokeLinejoin="round" opacity=".96">
                    <path d="M78 104 C84 86 102 74 122 74 C134 74 140 82 138 92 C136 100 128 104 130 112 C132 122 124 128 118 136 C112 144 104 142 100 132 C96 122 84 118 78 104 Z" />
                    <path d="M116 156 C124 148 134 150 138 160 C144 174 140 194 130 212 C126 220 118 218 116 206 C114 194 110 180 108 168 C108 162 110 158 116 156 Z" />
                    <path d="M180 94 C192 86 208 86 220 92 C226 98 222 106 214 108 C206 110 196 110 190 106 C184 102 178 100 180 94 Z" />
                    <path d="M184 116 C198 106 220 110 230 124 C238 140 234 160 226 178 C220 192 210 204 202 202 C194 200 190 184 186 168 C182 150 176 130 184 116 Z" />
                    <path d="M234 84 C246 80 258 90 262 104 C258 114 250 112 242 108 C236 104 232 94 234 84 Z" />
                </g>
                <path d="M196 124 C208 118 224 124 228 134 C222 140 208 140 198 136 C192 132 190 128 196 124 Z" fill="#cbb27c" opacity=".85" />
                <path d="M126 58 C140 54 154 58 160 66 C150 72 136 74 128 70 C122 66 120 60 126 58 Z" fill="#f7fbff" opacity=".95" />
                <path d="M96 250 C124 242 194 242 224 250 C196 260 124 260 96 250 Z" fill="#f7fbff" opacity=".95" />
                <g fill="none" stroke="#ffffff" strokeLinecap="round" opacity=".62" filter={`url(#${uid}-haze)`}>
                    <path d="M92 150 C110 142 128 150 142 146" strokeWidth="7" />
                    <path d="M154 96 C170 88 184 96 200 90" strokeWidth="6" />
                    <path d="M150 200 C172 194 190 204 214 196" strokeWidth="8" />
                    <path d="M84 206 C96 200 106 206 118 202" strokeWidth="5" />
                    <path d="M206 226 C220 220 232 226 244 220" strokeWidth="5" />
                </g>
            </g>
        }
        case "planet-mars":
            return <g className="planet-features">
                <path d="M118 66 C138 56 182 56 202 66 C190 76 130 76 118 66 Z" fill="#fff4ee" opacity=".9" />
                <path d="M86 150 C104 136 126 138 138 150 C146 160 128 168 112 166 C98 164 84 160 86 150 Z" fill={palette.shade} opacity=".28" />
                <path d="M186 196 C206 186 234 190 240 206 C232 220 206 224 190 216 C182 210 180 202 186 196 Z" fill={palette.shade} opacity=".24" />
                <ellipse cx="164" cy="226" rx="34" ry="8" fill={palette.shade} opacity=".18" />
            </g>
        case "planet-jupiter":
            return <g className="planet-features">
                <ellipse cx="204" cy="206" rx="26" ry="14" fill="#c9553a" opacity=".85" />
                <ellipse cx="204" cy="206" rx="17" ry="8" fill="#e2775a" opacity=".8" />
                <ellipse cx="206" cy="205" rx="8" ry="3.5" fill="#f4a58c" opacity=".7" />
            </g>
        case "planet-neptune":
            return <g className="planet-features">
                <ellipse cx="118" cy="196" rx="22" ry="10" fill={palette.shade} opacity=".55" />
                <ellipse cx="118" cy="196" rx="12" ry="5" fill="#0a1140" opacity=".6" />
                <ellipse cx="206" cy="112" rx="10" ry="4" fill={palette.light} opacity=".45" />
            </g>
        case "planet-pluto":
            // Mottled tan ice, the dark equatorial "whale" on the left and the pale Tombaugh heart on the right.
            return <g className="planet-features">
                <path d="M58 168 C76 150 104 146 128 154 C142 160 146 174 138 184 C126 196 104 200 84 196 C68 192 56 182 58 168 Z" fill="#6b4535" opacity=".5" filter={`url(#${uid}-haze)`} />
                <path d="M144 176 C150 164 164 160 176 168 C184 160 200 160 210 170 C222 184 216 206 200 222 C190 232 178 240 168 236 C154 228 138 208 138 192 C138 186 140 180 144 176 Z" fill="#f0e6da" opacity=".78" filter={`url(#${uid}-haze)`} />
                <path d="M150 178 C158 170 170 172 176 180 C184 172 196 174 202 182 C210 194 204 208 194 216 C186 224 178 228 172 226 C160 218 148 202 148 190 Z" fill="#f7f0e7" opacity=".55" />
                <g fill={palette.shade} opacity=".2">
                    <ellipse cx="108" cy="104" rx="22" ry="9" transform="rotate(-14 108 104)" />
                    <ellipse cx="206" cy="108" rx="14" ry="6" transform="rotate(12 206 108)" />
                    <circle cx="228" cy="140" r="5" />
                    <circle cx="176" cy="88" r="4" />
                    <ellipse cx="120" cy="228" rx="16" ry="6" />
                </g>
                <g fill={palette.light} opacity=".28">
                    <ellipse cx="150" cy="118" rx="18" ry="6" transform="rotate(-10 150 118)" />
                    <ellipse cx="228" cy="196" rx="10" ry="4" />
                </g>
            </g>
        case "planet-venus":
            return <g className="planet-features" fill={palette.light} opacity=".5" filter={`url(#${uid}-haze)`}>
                <path d="M84 132 C118 118 150 140 190 126 C220 116 236 128 244 140 C220 148 190 142 160 150 C126 158 100 150 84 132 Z" />
                <path d="M96 204 C130 190 172 208 212 194 C230 188 240 196 236 206 C204 214 170 210 130 220 C112 224 100 216 96 204 Z" />
            </g>
        default:
            return null
    }
}

/** Half of a tilted ring, drawn behind and then in front of the globe so it wraps around it. */
function ringArc(rx: number, ry: number, front: boolean) {
    return `M${-rx} 0 A${rx} ${ry} 0 0 ${front ? 0 : 1} ${rx} 0`
}

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
    const { clouds, ring } = palette
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
                {ring && <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor={palette.mist} stopOpacity=".55" />
                    <stop offset=".3" stopColor={palette.middle} stopOpacity=".9" />
                    <stop offset=".5" stopColor={palette.light} stopOpacity=".95" />
                    <stop offset=".7" stopColor={palette.middle} stopOpacity=".9" />
                    <stop offset="1" stopColor={palette.mist} stopOpacity=".55" />
                </linearGradient>}
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
                {ring && <g className="planet-ring" transform={`translate(160 160) rotate(${ring[2]})`} fill="none" stroke={`url(#${uid}-ring)`} strokeWidth={ring[3]} strokeLinecap="round">
                    <path data-ring="back" d={ringArc(ring[0], ring[1], false)} opacity=".75" />
                </g>}
                <circle cx="160" cy="160" r="103" fill={`url(#${uid}-sphere)`} />
                <g clipPath={`url(#${uid}-clip)`}>
                    {detailed && clouds !== "none" && <g className="planet-weather-texture" opacity=".44">
                        <rect x="55" y="55" width="210" height="210" fill={palette.cloud} filter={`url(#${uid}-cloud-texture)`} />
                    </g>}
                    <PlanetFeatures variant={variant} palette={palette} uid={uid} />
                    {clouds !== "none" && <g className="planet-clouds" fill="none" stroke={palette.cloud} opacity={clouds === "thin" ? .6 : 1} filter={detailed ? `url(#${uid}-wind)` : undefined}>
                        <path d={cloudLine(190, 1.9)} strokeWidth="18" opacity=".38" filter={`url(#${uid}-haze)`} />
                        <path d={cloudLine(215, 2.15)} strokeWidth="11" opacity=".21" filter={`url(#${uid}-haze)`} />
                        {BANDS.filter((_, i) => (detailed && clouds !== "thin") || i % 3 === 0).map((band, i) => <path key={i} d={band.path} strokeWidth={band.width} opacity={band.opacity} />)}
                        <path d="M69 115 C88 133 76 158 109 160 C141 162 115 137 99 146 C85 155 105 174 132 166 C153 160 151 152 175 156" strokeWidth="1.3" opacity=".26" />
                        <path d="M79 111 C104 138 82 149 111 151 C128 154 136 164 158 161" strokeWidth="3" opacity=".2" filter={`url(#${uid}-haze)`} />
                        <path d={cloudLine(104, 0.8, 0.4)} strokeWidth="1.5" opacity=".18" />
                        <path d={cloudLine(112, 0.95, 0.4)} strokeWidth=".7" opacity=".2" />
                    </g>}
                    <circle cx="160" cy="160" r="103" fill={`url(#${uid}-shine)`} />
                    <circle cx="160" cy="160" r="103" fill={`url(#${uid}-limb)`} />
                </g>
                <circle cx="160" cy="160" r="102.7" stroke={`url(#${uid}-rim)`} strokeWidth="1.5" fill="none" />
                {ring && <g className="planet-ring" transform={`translate(160 160) rotate(${ring[2]})`} fill="none" stroke={`url(#${uid}-ring)`} strokeWidth={ring[3]} strokeLinecap="round">
                    <path data-ring="front" d={ringArc(ring[0], ring[1], true)} />
                </g>}
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
