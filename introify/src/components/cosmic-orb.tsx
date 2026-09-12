"use client"

import { useId, type CSSProperties } from "react"
import { resolveBotExpression } from "@/lib/bot-expression"
import "./cosmic-orb.css"

export type CosmicOrbVariant = "cosmic-space" | "cosmic-comic"
type CosmicLid = "none" | "blink" | "wink-left" | "wink-right"

export function isCosmicOrbVariant(value: string | null | undefined): value is CosmicOrbVariant {
    return value === "cosmic-space" || value === "cosmic-comic"
}

export interface CosmicOrbProps {
    size: number
    variant?: CosmicOrbVariant
    expression?: string
    mood?: string
    gaze?: { x: number; y: number }
    lid?: CosmicLid
    speed?: number
    intensity?: number
    still?: boolean
    frozenAt?: number
}

// The same uneven, flame-shaped silhouette belongs to both editions of Nova.
// The small outward curls are part of the character, not an enclosing backplate.
const SILHOUETTE = "M155 44 C179 30 210 39 228 57 C242 70 246 68 241 53 C256 60 259 72 255 85 C277 88 289 109 278 127 C278 109 268 106 268 119 C271 139 288 149 284 174 C284 192 276 207 273 218 C287 208 289 200 290 193 C299 219 277 237 262 241 C250 265 231 272 207 273 C192 289 178 282 164 285 C139 299 115 285 99 277 C67 279 46 255 48 233 C26 219 28 192 38 177 C18 171 25 147 40 140 C34 152 43 162 48 148 C49 132 45 119 56 108 C69 94 80 91 69 82 C91 82 84 70 89 61 C97 45 116 39 128 43 C109 45 101 58 109 64 C126 69 133 50 155 44 Z"

// Open flowing spines keep the middle of the face dark and readable. Closely
// spaced strands around each spine make the light feel like a volume of gas.
const STREAMS = [
    "M110 67 C85 93 130 108 163 95 C207 77 204 52 177 55 C142 59 121 70 132 89 C143 109 186 107 196 130",
    "M208 57 C258 86 219 112 222 140 C224 165 266 163 261 193 C258 213 235 222 221 224",
    "M270 128 C282 168 248 190 217 187 C187 184 177 166 187 149 C194 136 186 122 172 114",
    "M243 225 C205 240 194 253 166 248 C131 242 166 224 140 209 C121 197 91 204 78 183",
    "M90 103 C63 126 94 145 88 163 C81 189 49 193 66 219 C83 244 119 226 131 250 C139 264 167 278 192 266",
    "M57 224 C74 261 109 248 108 228 C108 206 76 211 72 189 C70 169 91 148 117 135 C145 120 124 112 108 118",
    "M106 268 C133 289 178 276 190 259 C208 235 243 258 262 232",
]

const RIBBONS = [
    "M106 66 C79 92 118 115 155 101 C195 87 212 54 176 53 C212 40 234 79 198 99 C165 118 133 119 143 134 C129 126 132 111 155 104 C127 113 86 107 93 82 Z",
    "M206 56 C252 69 259 102 233 124 C216 142 251 151 263 166 C291 208 242 226 218 227 C254 207 266 191 239 180 C199 167 204 145 220 126 C242 102 243 82 206 56 Z",
    "M274 139 C288 165 266 194 236 197 C207 200 178 182 181 163 C178 192 214 217 244 205 C226 224 191 207 178 190 C158 160 182 142 174 125 C192 142 183 152 193 169 C211 194 264 189 274 139 Z",
    "M237 233 C215 242 198 260 170 259 C141 258 134 246 149 236 C165 221 130 210 112 212 C89 214 77 201 75 188 C100 211 117 194 136 205 C159 218 183 225 166 242 C158 252 199 253 219 239 Z",
    "M88 101 C67 119 82 139 90 147 C101 165 79 180 73 193 C59 216 91 224 112 235 C131 249 120 261 100 256 C118 251 106 238 87 237 C50 232 44 207 62 182 C82 157 82 155 75 145 C60 127 64 112 88 101 Z",
    "M95 266 C119 285 149 272 154 265 C169 246 193 255 209 259 C233 265 247 248 260 235 C249 270 226 272 205 268 C182 263 174 259 163 272 C148 291 113 285 95 266 Z",
]

function perimeter(radius: number, phase: number) {
    return Array.from({ length: 133 }, (_, index) => {
        const angle = index / 132 * Math.PI * 2
        const ripple = Math.sin(angle * 5 + phase) * 3.3 + Math.sin(angle * 11 - phase * .4) * 2 + Math.cos(angle * 19 + phase) * .9
        const r = radius + ripple
        return `${index ? "L" : "M"}${(160 + Math.cos(angle) * r).toFixed(2)} ${(162 + Math.sin(angle) * r * 1.035).toFixed(2)}`
    }).join(" ") + " Z"
}

const VEILS = Array.from({ length: 19 }, (_, index) => perimeter(105 + index * .79, index * .39))
const STARS = Array.from({ length: 167 }, (_, index) => {
    const angle = index * 2.3999632297
    const radius = Math.sqrt((index + .5) / 167) * 120
    return {
        x: 160 + Math.cos(angle) * radius,
        y: 161 + Math.sin(angle) * radius,
        radius: index % 23 === 0 ? 1.04 : index % 9 === 0 ? .7 : .26 + (index % 4) * .09,
        opacity: .2 + (index % 7) * .105,
    }
})

function eyePose(expression: string, index: number, closed: boolean) {
    if (closed) return "scale(1, .08)"
    if (["heureux", "hilare", "excite"].includes(expression)) return "translate(0, -2px) scale(1.2, .8)"
    if (expression === "attentif") return "scale(.85, 1.28)"
    if (expression === "curieux" || expression === "confus") return index ? "translate(0, -4px) scale(1.12)" : "translate(0, 1px) scale(.86)"
    if (expression === "surpris" || expression === "effraye") return "scale(1.4)"
    if (expression === "timide") return "translate(0, 4px) scale(.67, .78)"
    if (expression === "triste") return `translate(0, 4px) rotate(${index ? 18 : -18}deg) scale(.78, .8)`
    if (["somnolent", "blase", "mefiant"].includes(expression)) return "scale(1, .38)"
    if (expression === "vigilant") return "scale(.83, 1.12)"
    if (expression === "colere") return `rotate(${index ? 20 : -20}deg) scale(1, .53)`
    return "scale(1)"
}

function finiteClamp(value: number, fallback: number, min: number, max: number) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/** Nova: one star-eyed character, rendered as living nebula or inked comic art. */
export function CosmicOrb({
    size, variant = "cosmic-space", expression = "centre", mood = "idle",
    gaze = { x: 0, y: 0 }, lid = "none", speed = 1, intensity = 1, still = false, frozenAt,
}: CosmicOrbProps) {
    const uid = `cosmic-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
    const comic = variant === "cosmic-comic"
    const detailed = size >= 88
    const frozen = Number.isFinite(frozenAt)
    const effectiveExpression = resolveBotExpression(expression, mood)
    const motionSpeed = finiteClamp(speed, 1, .2, 3)
    const motionIntensity = finiteClamp(intensity, 1, 0, 2)
    const dx = finiteClamp(gaze.x, 0, -1, 1) * 5
    const dy = finiteClamp(-gaze.y, 0, -1, 1) * 4
    const style = {
        "--cosmic-unit": `${1 / motionSpeed}s`,
        "--cosmic-delay": `${frozen ? -Math.max(0, frozenAt!) : 0}s`,
        "--cosmic-lift": `${-2.5 * motionIntensity}px`,
        "--cosmic-drift": `${2.8 * motionIntensity}px`,
        "--cosmic-breathe": 1 + .018 * motionIntensity,
        "--cosmic-eye-color": comic ? "#fff2bb" : "#fff4ff",
    } as CSSProperties
    const ink = comic ? "#190e27" : "#231138"

    return <svg className={`cosmic-orb cosmic-orb--${variant}`} width={size} height={size} viewBox="0 0 320 320"
        data-variant={variant} data-expression={effectiveExpression} data-mood={mood} data-still={still}
        data-frozen={frozen} data-detail={detailed} style={style} aria-hidden="true" focusable="false">
        <defs>
            <radialGradient id={`${uid}-core`} cx="48%" cy="43%" r="65%">
                <stop offset="0" stopColor={comic ? "#20102f" : "#110d27"} />
                <stop offset=".42" stopColor={comic ? "#35103d" : "#201333"} />
                <stop offset=".73" stopColor={comic ? "#521542" : "#3c1b58"} stopOpacity={comic ? 1 : .72} />
                <stop offset="1" stopColor={comic ? "#21112f" : "#211333"} stopOpacity={comic ? 1 : 0} />
            </radialGradient>
            <linearGradient id={`${uid}-ribbon`} x1=".05" y1="0" x2=".93" y2="1">
                <stop offset="0" stopColor={comic ? "#9d368c" : "#956ee1"} />
                <stop offset=".29" stopColor={comic ? "#e35aaa" : "#d795ff"} />
                <stop offset=".5" stopColor={comic ? "#f981c2" : "#f6baff"} />
                <stop offset=".74" stopColor={comic ? "#c53494" : "#c969ec"} />
                <stop offset="1" stopColor={comic ? "#702460" : "#8764d0"} />
            </linearGradient>
            <linearGradient id={`${uid}-strand`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#8b72e5" stopOpacity=".36" />
                <stop offset=".35" stopColor="#e3a0ff" stopOpacity=".9" />
                <stop offset=".55" stopColor="#ffcaf8" />
                <stop offset=".75" stopColor="#d789f4" stopOpacity=".84" />
                <stop offset="1" stopColor="#8b73df" stopOpacity=".35" />
            </linearGradient>
            <radialGradient id={`${uid}-eye-glow`}>
                <stop stopColor={comic ? "#fff3c5" : "#fffaff"} stopOpacity=".93" />
                <stop offset=".11" stopColor={comic ? "#ffe5a4" : "#fbd6ff"} stopOpacity=".74" />
                <stop offset=".4" stopColor={comic ? "#ffc88a" : "#d66aff"} stopOpacity=".22" />
                <stop offset="1" stopColor={comic ? "#ffb787" : "#ae48f2"} stopOpacity="0" />
            </radialGradient>
            <clipPath id={`${uid}-silhouette`}><path d={SILHOUETTE} /></clipPath>
            <clipPath id={`${uid}-ribbons`}>{RIBBONS.map((d, i) => <path key={i} d={d} />)}</clipPath>
            {detailed && <>
                <filter id={`${uid}-wisps`} x="-9%" y="-9%" width="118%" height="118%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency={comic ? ".021 .032" : ".048 .077"} numOctaves="3" seed="13" result="wind" />
                    <feDisplacementMap in="SourceGraphic" in2="wind" scale={comic ? "2.5" : "19"} xChannelSelector="R" yChannelSelector="G" />
                </filter>
                <filter id={`${uid}-plasma`} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="soft-mask" />
                    <feTurbulence type="fractalNoise" baseFrequency=".028 .044" numOctaves="3" seed="8" result="cloud" />
                    <feColorMatrix in="cloud" type="matrix" values="0 0 0 0 .86  0 0 0 0 .48  0 0 0 0 1  2.9 0 0 0 -1.05" />
                    <feComposite in2="soft-mask" operator="in" />
                    <feGaussianBlur stdDeviation="1.1" />
                </filter>
                <filter id={`${uid}-edge`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.7" /></filter>
                <filter id={`${uid}-mist`} x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="3.3" /></filter>
                <pattern id={`${uid}-dots`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="1" cy="1" r=".76" fill={ink} /></pattern>
                <pattern id={`${uid}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)"><path d="M0 0 V5" stroke="#ffb1d6" strokeWidth=".65" opacity=".67" /></pattern>
            </>}
        </defs>
        <g className="cosmic-character">
            <path className="cosmic-silhouette" d={SILHOUETTE} fill={`url(#${uid}-core)`}
                stroke={comic ? ink : "none"} strokeWidth={comic ? 2.8 : undefined}
                filter={!comic && detailed ? `url(#${uid}-edge)` : undefined} />
            <g clipPath={`url(#${uid}-silhouette)`}>
                {!comic && detailed && <>
                    <g className="cosmic-gas cosmic-gas--soft" fill="none" stroke={`url(#${uid}-ribbon)`} strokeWidth="12" opacity=".32" filter={`url(#${uid}-mist)`}>
                        {STREAMS.map((d, i) => <path key={i} d={d} />)}
                    </g>
                    <g className="cosmic-gas cosmic-plasma" fill="none" stroke="#e8b1ff" strokeWidth="28" strokeLinecap="round" opacity=".34" filter={`url(#${uid}-plasma)`}>
                        {STREAMS.map((d, i) => <path key={i} d={d} />)}
                        <circle cx="160" cy="162" r="108" strokeWidth="25" />
                    </g>
                </>}
                <g className="cosmic-gas cosmic-ribbons" fill={`url(#${uid}-ribbon)`}
                    stroke={comic ? ink : "none"} strokeWidth={comic ? 1.6 : undefined} opacity={comic ? 1 : .025}
                    filter={!comic && detailed ? `url(#${uid}-wisps)` : undefined}>
                    {RIBBONS.map((d, i) => <path key={i} d={d} />)}
                    {comic && detailed && <g clipPath={`url(#${uid}-ribbons)`}>
                        <path d={SILHOUETTE} fill={`url(#${uid}-hatch)`} stroke="none" />
                        <path d={SILHOUETTE} fill={`url(#${uid}-dots)`} stroke="none" opacity=".65" />
                    </g>}
                </g>
                <g className="cosmic-gas cosmic-filaments" fill="none" stroke={`url(#${uid}-strand)`}
                    filter={detailed ? `url(#${uid}-wisps)` : undefined}>
                    {STREAMS.flatMap((d, streamIndex) => Array.from({ length: detailed ? (comic ? 7 : 21) : 3 }, (_, index) => {
                        const offset = index - (detailed ? (comic ? 3 : 10) : 1)
                        return <path key={`${streamIndex}-${index}`} d={d}
                            transform={`translate(${(offset * .56).toFixed(2)} ${(offset * .61).toFixed(2)})`}
                            strokeWidth={comic ? (index % 3 ? .5 : .8) : (index % 5 ? .29 : .6)}
                            opacity={comic ? .35 : (index % 4 ? .42 : .86)} />
                    }))}
                </g>
                <g className="cosmic-starfield">
                    {STARS.filter((_, i) => detailed || i % 8 === 0).map((star, i) => <circle key={i}
                        cx={star.x} cy={star.y} r={star.radius * (comic ? .85 : 1)}
                        fill={comic ? "#f5aad9" : i % 5 ? "#e6bbff" : "#ffffff"}
                        opacity={star.opacity} className={i % 13 ? undefined : "cosmic-spark"}
                        style={{ "--spark-delay": `${-i * .31}s` } as CSSProperties} />)}
                </g>
                {comic && detailed && <path d={SILHOUETTE} fill={`url(#${uid}-dots)`} opacity=".22" />}
            </g>
            {!comic && detailed && <g className="cosmic-veil" fill="none" stroke={`url(#${uid}-strand)`} filter={`url(#${uid}-wisps)`}>
                {VEILS.map((d, i) => <path key={i} d={d} strokeWidth={i % 4 ? .4 : .7} opacity={i % 3 ? .14 : .3} />)}
            </g>}
            {comic && <g className="cosmic-ink-accents" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round">
                <path d="M64 109 C40 126 55 138 40 152 M103 57 C113 42 126 41 139 43 M184 33 C208 29 229 43 238 56 M286 160 C300 185 286 215 277 223 M244 266 C222 283 206 274 197 280 M72 259 C82 272 91 267 100 276" />
                <path d="M75 74 Q66 67 71 60 M274 103 Q284 101 286 107 M44 237 Q34 236 33 228 M172 294 Q183 294 187 287" strokeWidth=".7" />
            </g>}
            <g className="cosmic-gaze" transform={`translate(${dx} ${dy})`}>
                <g className="cosmic-face">
                    {[124, 192].map((x, index) => {
                        const closed = !still && (lid === "blink" || lid === (index ? "wink-right" : "wink-left"))
                        return <g className="cosmic-eye-position" key={index} transform={`translate(${x} 157)`}>
                            <g className="cosmic-eye" data-eye={index} style={{ transform: eyePose(effectiveExpression, index, closed) }}>
                                <circle className="cosmic-eye-halo" r={detailed ? 29 : 25} fill={`url(#${uid}-eye-glow)`} />
                                <g className="cosmic-eye-light">
                                    <path className="cosmic-eye-rays" d="M0 -22 L1.45 -3.2 L4.8 -6.2 L2.75 -1.65 L23 0 L2.75 1.65 L5.4 6.2 L1.45 3.2 L0 22 L-1.45 3.2 L-5.4 6.2 L-2.75 1.65 L-23 0 L-2.75 -1.65 L-4.8 -6.2 L-1.45 -3.2 Z"
                                        fill={comic ? "#fff0b6" : "#f8dcff"} opacity=".75" />
                                    {detailed && <path d="M-12 -12 L-1 -2 L0 -8 L1 -2 L12 -12 L2 -1 L8 0 L2 1 L12 12 L1 2 L0 8 L-1 2 L-12 12 L-2 1 L-8 0 L-2 -1 Z"
                                        fill={comic ? "#ffe3a0" : "#edc4ff"} opacity=".6" />}
                                    <path d="M0 -9 Q.8 -1.2 9 0 Q.8 1.2 0 9 Q-.8 1.2 -9 0 Q-.8 -1.2 0 -9 Z" fill={comic ? "#fff7d8" : "#fffaff"} />
                                    <circle r={detailed ? 1.9 : 3} fill="#fffdf0" />
                                </g>
                            </g>
                        </g>
                    })}
                </g>
            </g>
        </g>
    </svg>
}
