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

    return <svg className={`cosmic-orb cosmic-orb--${variant}`} width={size} height={size} viewBox="0 0 320 320"
        data-variant={variant} data-expression={effectiveExpression} data-mood={mood} data-still={still}
        data-frozen={frozen} data-detail={detailed} style={style} aria-hidden="true" focusable="false">
        <defs>
            <radialGradient id={`${uid}-eye-glow`}>
                <stop stopColor={comic ? "#fff3c5" : "#fffaff"} stopOpacity=".93" />
                <stop offset=".11" stopColor={comic ? "#ffe5a4" : "#fbd6ff"} stopOpacity=".74" />
                <stop offset=".4" stopColor={comic ? "#ffc88a" : "#d66aff"} stopOpacity=".22" />
                <stop offset="1" stopColor={comic ? "#ffb787" : "#ae48f2"} stopOpacity="0" />
            </radialGradient>
        </defs>
        <g className="cosmic-character">
            {/* Pre-rendered nebula keeps turbulence and hundreds of strands off the frame loop. */}
            <image className="cosmic-artwork" href={`/bots/nova/${comic ? "comic" : "space"}-body.webp`} x="0" y="0" width="320" height="320" />
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
