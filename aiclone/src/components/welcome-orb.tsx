"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ORB_VARIANTS, resolveOrbVariant, type OrbVariantId } from "@/lib/orb-variants"
import { resolveOrbLook, resolvePixelSkin, type OrbLook, type PixelSkin } from "@/lib/pixel-skins"
import { BloubOrb } from "@/components/bloub-orb"
import "./welcome-orb.css"
import "./welcome-pixel.css"

export type OrbMood = "idle" | "listening" | "thinking" | "speaking" | "success" | "error" | "greeting"

interface WelcomeOrbProps {
    size?: number
    colors?: [string, string]
    variant?: OrbVariantId | string
    look?: OrbLook | string
    skin?: PixelSkin | string
    shape?: string
    expression?: string
    color?: string
    speed?: number
    intensity?: number
    className?: string
    gaze?: { x: number; y: number } | null
    mood?: OrbMood
    reactToken?: number
    frozenAt?: number
}

export { ORB_VARIANTS }

export function WelcomeOrb({
    size = 200,
    colors,
    variant,
    look: lookStyle,
    skin,
    shape,
    expression,
    color,
    speed = 1,
    className,
    gaze = null,
    mood = "idle",
    reactToken = 0,
    frozenAt,
}: WelcomeOrbProps) {
    const [look, setLook] = useState({ x: 0, y: 0 })
    const [lid, setLid] = useState<"none" | "blink" | "wink-left" | "wink-right">("none")
    const [delighted, setDelighted] = useState(false)
    const gazeRef = useRef(gaze)
    const delightedRef = useRef(false)
    gazeRef.current = gaze
    const resolved = resolveOrbVariant(colors, variant)
    const resolvedLook = resolveOrbLook(lookStyle)
    const resolvedSkin = resolvePixelSkin(skin)

    useEffect(() => {
        if (!reactToken) return
        delightedRef.current = true
        setDelighted(false)
        let raf2 = 0
        const raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => setDelighted(true))
        })
        const clear = window.setTimeout(() => {
            setDelighted(false)
            delightedRef.current = false
        }, 720)
        return () => {
            window.cancelAnimationFrame(raf1)
            window.cancelAnimationFrame(raf2)
            window.clearTimeout(clear)
        }
    }, [reactToken])

    useEffect(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

        let raf = 0
        let last = performance.now()
        let lx = 0
        let ly = 0
        let tx = 0
        let ty = 0
        let idleX = 0
        let idleY = 0
        let nextSaccade = last + 900 + Math.random() * 1600
        let nextLid = last + 1600 + Math.random() * 2200
        let lidUntil = 0

        const tick = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000)
            last = now
            const g = gazeRef.current

            if (g) {
                tx = g.x
                ty = g.y
            } else if (!reduced && now >= nextSaccade) {
                const reach = 0.3 + Math.random() * 0.4
                const ang = Math.random() * Math.PI * 2
                idleX = Math.cos(ang) * reach
                idleY = Math.sin(ang) * reach * 0.5
                nextSaccade = now + 800 + Math.random() * 2400
                tx = idleX
                ty = idleY
            } else if (!g) {
                tx = idleX
                ty = idleY
            }

            const k = 1 - Math.exp(-dt * (g ? 16 : 8))
            lx += (tx - lx) * k
            ly += (ty - ly) * k
            setLook({ x: lx, y: ly })

            if (!reduced && !delightedRef.current && now >= nextLid) {
                const roll = Math.random()
                const kind = roll < 0.18 ? "wink-left" : roll < 0.32 ? "wink-right" : "blink"
                setLid(kind)
                lidUntil = now + (kind === "blink" ? 90 : 140)
                nextLid = now + (roll < 0.12 ? 200 : 1800 + Math.random() * 3800)
            }
            if (lidUntil && now >= lidUntil) {
                setLid("none")
                lidUntil = 0
            }

            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [])

    const pupil = {
        transform: `translate(calc(-50% + ${look.x * 42}%), calc(-50% + ${-look.y * 38}%))`,
    }
    const pixGx = Math.round(look.x * 2)
    const pixGy = Math.round(-look.y)
    const pixPx = Math.max(-1, Math.min(1, Math.round(look.x)))
    const pixPy = Math.max(-1, Math.min(1, Math.round(-look.y)))

    return (
        <div
            className={cn(
                "pl-orb-scene",
                size < 56 && "is-compact",
                resolvedLook === "pixel" && "is-pixel",
                resolvedLook === "bloub" && "is-bloub",
                className
            )}
            data-variant={resolved}
            data-skin={resolvedLook === "pixel" ? resolvedSkin : undefined}
            style={{
                ["--orb-s" as string]: `${size}px`,
                ["--orb-speed" as string]: String(Math.max(speed, 0.35)),
                ["--gaze-x" as string]: `${look.x * size * 0.06}px`,
                ["--gaze-y" as string]: `${-look.y * size * 0.07}px`,
                ["--pix-gx" as string]: pixGx,
                ["--pix-gy" as string]: pixGy,
                ["--pix-px" as string]: pixPx,
                ["--pix-py" as string]: pixPy,
            }}
            aria-hidden
        >
            {resolvedLook === "bloub" ? (
                <BloubOrb
                    size={size}
                    shape={shape}
                    expression={expression}
                    color={color}
                    mood={mood}
                    reactToken={reactToken}
                    gaze={gaze}
                    frozenAt={frozenAt}
                    className={size < 56 ? "is-compact" : undefined}
                />
            ) : resolvedLook === "pixel" ? (
                <>
                    <div
                        className={cn(
                            "pl-pix",
                            `is-${resolvedSkin}`,
                            `is-${mood}`,
                            lid === "blink" && "is-blinking",
                            lid === "wink-left" && "is-wink-left",
                            lid === "wink-right" && "is-wink-right",
                            delighted && "is-delighted"
                        )}
                    >
                        <PixelEye skin={resolvedSkin} />
                        <PixelEye skin={resolvedSkin} />
                    </div>
                </>
            ) : (
                <>
                    <div
                        className={cn(
                            "pl-orb",
                            `is-${mood}`,
                            lid === "blink" && "is-blinking",
                            lid === "wink-left" && "is-wink-left",
                            lid === "wink-right" && "is-wink-right",
                            delighted && "is-delighted"
                        )}
                    >
                        <div className="pl-orb-core" />
                        <div className="pl-orb-face">
                            <div className="pl-orb-eye">
                                <div className="pl-orb-pupil" style={pupil} />
                                <div className="pl-orb-spark" />
                            </div>
                            <div className="pl-orb-eye">
                                <div className="pl-orb-pupil" style={pupil} />
                                <div className="pl-orb-spark" />
                            </div>
                            <div className="pl-orb-smile">
                                <svg className="pl-orb-mouth-svg" viewBox="0 0 48 24" aria-hidden>
                                    <path className="pl-orb-mouth" d="M7 8 C16 17.5 32 17.5 41 8" />
                                </svg>
                            </div>
                        </div>
                        <div className="pl-orb-highlight" />
                    </div>
                    <div className="pl-orb-shadow" />
                </>
            )}
        </div>
    )
}

function PixelEye({ skin }: { skin: PixelSkin }) {
    if (skin === "spark") {
        return (
            <div className="pl-pix-eye">
                <i className="pl-pix-arm is-h" />
                <i className="pl-pix-arm is-v" />
                <i className="pl-pix-arm is-c" />
            </div>
        )
    }
    if (skin === "crt") {
        return (
            <div className="pl-pix-eye">
                <span className="pl-pix-phos" />
                <span className="pl-pix-scan" />
            </div>
        )
    }
    return <div className="pl-pix-eye" />
}
