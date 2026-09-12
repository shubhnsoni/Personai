"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import { ORB_VARIANTS, resolveOrbVariant, type OrbVariantId } from "@/lib/orb-variants"
import { resolveOrbLook, resolvePixelSkin, type OrbLook, type PixelSkin } from "@/lib/pixel-skins"
import { AnimojiFace } from "@/components/animoji-face"
import { BloubOrb } from "@/components/bloub-orb"
import { RetroLcdOrb } from "@/components/retro-lcd-orb"
import { PremiumThemeOrb } from "@/components/premium-theme-orb"
import { PlanetOrb, isPlanetOrbVariant } from "@/components/planet-orb"
import { CosmicOrb, isCosmicOrbVariant } from "@/components/cosmic-orb"
import { MascotOrb, isMascotOrbVariant } from "@/components/mascot-orb"
import { ProfileOrbit } from "@/components/profile-orbit"
import { BotAura } from "@/components/bot-aura"
import { botExpressionStyle, resolveBotExpression } from "@/lib/bot-expression"
import { COLOR_BY_ID } from "@/lib/bloub/skins"
import { BLOUB_THEME_META, resolveBloubAura, resolveBloubColor, resolveThemedOrb, type AuraId } from "@/lib/bloub/catalog"
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
    aura?: AuraId | string
    theme?: string
    orbitProfile?: boolean
    profileImageUrl?: string | null
    speed?: number
    intensity?: number
    className?: string
    gaze?: { x: number; y: number } | null
    mood?: OrbMood
    reactToken?: number
    frozenAt?: number
    /** Skip gaze/blink rAF — for rows of decorative orbs. */
    still?: boolean
}

export { ORB_VARIANTS }

function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    query.addEventListener?.("change", onChange)
    return () => query.removeEventListener?.("change", onChange)
}

function reducedMotionSnapshot() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function WelcomeOrb({
    size = 200,
    colors,
    variant,
    look: lookStyle,
    skin,
    shape,
    expression,
    color,
    aura,
    theme,
    orbitProfile = false,
    profileImageUrl,
    speed = 1,
    intensity = 1,
    className,
    gaze = null,
    mood = "idle",
    reactToken = 0,
    frozenAt,
    still = false,
}: WelcomeOrbProps) {
    const sceneRef = useRef<HTMLDivElement>(null)
    const [novaActive, setNovaActive] = useState(true)
    const nova = isCosmicOrbVariant(theme)
    const paused = still || (nova && !novaActive)
    const [look, setLook] = useState({ x: 0, y: 0 })
    const [lid, setLid] = useState<"none" | "blink" | "wink-left" | "wink-right">("none")
    const [delighted, setDelighted] = useState(false)
    const gazeRef = useRef(gaze)
    const delightedRef = useRef(false)
    const resolved = resolveOrbVariant(colors, variant)
    const resolvedLook = resolveOrbLook(lookStyle)
    const resolvedSkin = resolvePixelSkin(skin)
    const themed = resolveThemedOrb(theme)
    const retro = themed === "retro-lcd"
    const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => true)

    useEffect(() => {
        if (!nova) return
        let inView = true
        const update = () => setNovaActive(inView && !document.hidden)
        const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting
            update()
        }, { rootMargin: "60px" }) : null
        if (sceneRef.current) observer?.observe(sceneRef.current)
        document.addEventListener("visibilitychange", update)
        update()
        return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", update) }
    }, [nova])

    useEffect(() => {
        gazeRef.current = gaze
    }, [gaze])

    useEffect(() => {
        if (!reactToken || paused || reducedMotion || frozenAt !== undefined) return
        delightedRef.current = true
        let raf2 = 0
        const raf1 = window.requestAnimationFrame(() => {
            setDelighted(false)
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
    }, [reactToken, themed, paused, frozenAt, reducedMotion])

    useEffect(() => {
        if (paused || reducedMotion || frozenAt !== undefined || (!themed && resolvedLook === "bloub")) return
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (reducedMotion && themed) return

        let raf = 0
        let last = performance.now()
        let paintedAt = 0
        let paintedX = 0
        let paintedY = 0
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
            // Nova needs smooth eye movement, not a full React render every display frame.
            if (!nova || (now - paintedAt >= 1000 / 30 && (Math.abs(lx - paintedX) > .003 || Math.abs(ly - paintedY) > .003))) {
                setLook({ x: lx, y: ly })
                paintedAt = now; paintedX = lx; paintedY = ly
            }

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
    }, [paused, frozenAt, themed, resolvedLook, reducedMotion, nova])

    const pupil = {
        transform: `translate(calc(-50% + ${look.x * 42}%), calc(-50% + ${-look.y * 38}%))`,
    }
    const pixGx = Math.round(look.x * 2)
    const pixGy = Math.round(-look.y)
    const pixPx = Math.max(-1, Math.min(1, Math.round(look.x)))
    const pixPy = Math.max(-1, Math.min(1, Math.round(-look.y)))
    const rawAura = themed ? BLOUB_THEME_META[themed]?.thumb.dot : COLOR_BY_ID.get(resolveBloubColor(color))?.hex
    const auraColor = !rawAura || ["#f7f7f8", "#ffffff", "#0a0a0c"].includes(rawAura.toLowerCase()) ? "#70abd8" : rawAura
    const liveExpression = resolveBotExpression(expression, delighted ? "react" : mood)

    const orb = (
        <div
            ref={sceneRef}
            className={cn(
                "pl-orb-scene",
                size < 56 && "is-compact",
                !themed && resolvedLook === "pixel" && "is-pixel",
                !themed && resolvedLook === "animoji" && "is-animoji",
                !themed && resolvedLook === "bloub" && "is-bloub",
                retro && "is-retro-lcd",
                isPlanetOrbVariant(themed) && "is-planet",
                themed && !retro && "is-premium",
                className
            )}
            data-variant={resolved}
            data-bot-theme={themed ?? undefined}
            data-aura={resolveBloubAura(aura)}
            data-motion-paused={paused || reducedMotion || frozenAt !== undefined}
            data-expression={liveExpression}
            data-mood={mood}
            data-skin={resolvedLook === "pixel" ? resolvedSkin : undefined}
            style={{
                ...botExpressionStyle(liveExpression),
                ["--orb-s" as string]: `${size}px`,
                ["--orb-speed" as string]: String(Math.max(speed, 0.35)),
                ["--orb-aura" as string]: COLOR_BY_ID.get(resolveBloubColor(color))?.hex || "#f7f7f8",
                ["--orb-static-time" as string]: `${-(frozenAt ?? 0.8)}s`,
                ["--gaze-x" as string]: `${look.x * size * 0.06}px`,
                ["--gaze-y" as string]: `${-look.y * size * 0.07}px`,
                ["--pix-gx" as string]: pixGx,
                ["--pix-gy" as string]: pixGy,
                ["--pix-px" as string]: pixPx,
                ["--pix-py" as string]: pixPy,
            }}
            aria-hidden
        >
            <BotAura aura={resolveBloubAura(aura)} color={auraColor} speed={speed} intensity={intensity} still={paused || reducedMotion} frozenAt={frozenAt} />
            {resolvedLook === "animoji" ? (
                <AnimojiFace
                    id={skin}
                    mood={mood}
                    expression={liveExpression}
                    still={paused || reducedMotion || frozenAt !== undefined}
                    size={size}
                    gaze={look}
                />
            ) : themed ? (
                retro ? (
                    <RetroLcdOrb
                        size={size}
                        gaze={look}
                        lid={lid}
                        expression={liveExpression}
                        still={paused || reducedMotion || frozenAt !== undefined}
                        aura="still"
                        mood={delighted ? "react" : mood}
                    />
                ) : isCosmicOrbVariant(themed) ? (
                    <CosmicOrb
                        variant={themed}
                        size={size}
                        gaze={look}
                        lid={lid}
                        expression={liveExpression}
                        still={paused || reducedMotion}
                        frozenAt={frozenAt}
                        speed={speed}
                        intensity={intensity}
                        mood={delighted ? "react" : mood}
                    />
                ) : isMascotOrbVariant(themed) ? (
                    <MascotOrb
                        variant={themed}
                        size={size}
                        gaze={look}
                        lid={lid}
                        expression={liveExpression}
                        still={paused || reducedMotion || frozenAt !== undefined}
                        aura="still"
                        mood={delighted ? "react" : mood}
                    />
                ) : isPlanetOrbVariant(themed) ? (
                    <PlanetOrb
                        variant={themed}
                        size={size}
                        gaze={look}
                        lid={lid}
                        expression={liveExpression}
                        still={paused || reducedMotion}
                        frozenAt={frozenAt}
                        speed={speed}
                        mood={mood}
                    />
                ) : (
                    <PremiumThemeOrb
                        variant={themed}
                        size={size}
                        gaze={look}
                        lid={lid}
                        expression={liveExpression}
                        still={paused || reducedMotion || frozenAt !== undefined}
                        aura="still"
                        mood={delighted ? "react" : mood}
                    />
                )
            ) : resolvedLook === "bloub" ? (
                <BloubOrb
                    size={size}
                    shape={shape}
                    expression={liveExpression}
                    color={color}
                    variant={variant}
                    mood={mood}
                    reactToken={reactToken}
                    gaze={gaze}
                    frozenAt={paused || reducedMotion ? frozenAt ?? 0.8 : frozenAt}
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
                                    <path className="pl-orb-mouth" d={liveExpression === "surpris" || liveExpression === "effraye" ? "M18 12 a6 8 0 1 0 12 0 a6 8 0 1 0 -12 0" : liveExpression === "neutre" ? "M12 12 H36" : "M7 8 C16 17.5 32 17.5 41 8"} />
                                </svg>
                            </div>
                        </div>
                        <div className="pl-orb-highlight" />
                    </div>
                </>
            )}
        </div>
    )
    return orbitProfile && profileImageUrl?.trim() ? (
        <ProfileOrbit imageUrl={profileImageUrl.trim()} size={size} still={paused || reducedMotion} frozenAt={frozenAt} speed={speed}>
            {orb}
        </ProfileOrbit>
    ) : orb
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
