"use client"

import { useEffect, useId, useRef, useState } from "react"
import { BotEngine, type BotFrame } from "@/lib/bloub/engine"
import { NOTIF_BLUE } from "@/lib/bloub/decor"
import { EXPRESSION_BY_ID, type ExpressionId } from "@/lib/bloub/expressions"
import { COLOR_BY_ID, SHAPE_BY_ID, mixHex } from "@/lib/bloub/skins"
import { DEMI_VIEWBOX, RAYON } from "@/lib/bloub/repere"
import { resolveBloubColor, resolveBloubExpression, resolveBloubShape } from "@/lib/bloub/catalog"
import type { StateId } from "@/lib/bloub/states"
import { cn } from "@/lib/utils"

type OrbMood = "idle" | "listening" | "thinking" | "speaking" | "success" | "error" | "greeting"

const VB = DEMI_VIEWBOX

const MOOD_EXPR: Record<OrbMood, ExpressionId | null> = {
    idle: null,
    listening: "attentif",
    thinking: null,
    speaking: "curieux",
    success: "heureux",
    error: "triste",
    greeting: "excite",
}

const MOOD_STATE: Partial<Record<OrbMood, StateId>> = {
    thinking: "thinking",
    greeting: "idle",
}

export function BloubOrb({
    size = 200,
    shape,
    expression,
    color,
    mood = "idle",
    reactToken = 0,
    gaze = null,
    frozenAt,
    paper = "var(--background, #f9f9f9)",
    className,
}: {
    size?: number
    shape?: string
    expression?: string
    color?: string
    mood?: OrbMood
    reactToken?: number
    gaze?: { x: number; y: number } | null
    frozenAt?: number
    paper?: string
    className?: string
}) {
    const uid = useId().replace(/:/g, "")
    const maskId = `bloub-mask-${uid}`
    const engineRef = useRef<BotEngine | null>(null)
    const clockRef = useRef(0)
    const [frame, setFrame] = useState<BotFrame | null>(null)
    const [wink, setWink] = useState(false)

    const shapeId = resolveBloubShape(shape)
    const restExpr = resolveBloubExpression(expression)
    const colorId = resolveBloubColor(color)
    const ink = COLOR_BY_ID.get(colorId)?.hex ?? "#0a0a0c"
    const liveExprId = wink ? restExpr : (MOOD_EXPR[mood] ?? restExpr)
    const liveState: StateId = wink ? "wink" : MOOD_STATE[mood] ?? "idle"

    useEffect(() => {
        if (!reactToken) return
        setWink(true)
        const clear = window.setTimeout(() => setWink(false), 1600)
        return () => window.clearTimeout(clear)
    }, [reactToken])

    if (!engineRef.current) {
        const radii = SHAPE_BY_ID.get(shapeId)?.radii ?? null
        const expr = EXPRESSION_BY_ID.get(restExpr) ?? null
        engineRef.current = new BotEngine(RAYON, "idle", radii, expr)
    }

    useEffect(() => {
        const engine = engineRef.current
        if (!engine) return
        const now = clockRef.current
        engine.setShape(SHAPE_BY_ID.get(shapeId)?.radii ?? null, now)
        engine.setExpression(EXPRESSION_BY_ID.get(liveExprId) ?? null, now)
        engine.setState(liveState, now)
        if (frozenAt !== undefined) setFrame(engine.sample(frozenAt))
    }, [shapeId, liveExprId, liveState, frozenAt])

    useEffect(() => {
        const engine = engineRef.current
        if (!engine) return
        if (gaze) {
            engine.setLook(
                {
                    yaw: gaze.x * 16,
                    pitch: 10 - gaze.y * 13,
                    mix: 1,
                    spin: 0,
                    wander: 0.15,
                },
                clockRef.current
            )
        } else {
            engine.setLook(null, clockRef.current)
        }
    }, [gaze])

    useEffect(() => {
        if (frozenAt !== undefined) {
            setFrame(engineRef.current!.sample(frozenAt))
            return
        }
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (reduced) {
            setFrame(engineRef.current!.sample(0.8))
            return
        }
        let raf = 0
        let last = 0
        const tick = (ms: number) => {
            raf = requestAnimationFrame(tick)
            const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
            last = ms
            clockRef.current += dt
            setFrame(engineRef.current!.sample(clockRef.current))
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [frozenAt])

    if (!frame) {
        return <div className={className} style={{ width: size, height: size }} aria-hidden />
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
            className={cn("block", className)}
            role="img"
            aria-hidden
        >
            <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x={-VB} y={-VB} width={VB * 2} height={VB * 2}>
                    <path d={frame.bodyPath} fill="#fff" />
                    {frame.eyes.map((eye, i) => (
                        <path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
                    ))}
                    {frame.notch ? <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" /> : null}
                </mask>
                {frame.arcs.map((arc) => (
                    <linearGradient
                        key={arc.id}
                        id={`${uid}-${arc.id}`}
                        gradientUnits="userSpaceOnUse"
                        x1={arc.grad.x1}
                        y1={arc.grad.y1}
                        x2={arc.grad.x2}
                        y2={arc.grad.y2}
                    >
                        {arc.grad.stops.map((c, i) => (
                            <stop key={i} offset={i / Math.max(1, arc.grad.stops.length - 1)} stopColor={c} />
                        ))}
                    </linearGradient>
                ))}
            </defs>

            <g fill="none" strokeLinecap="round">
                {frame.arcs.map((arc) => (
                    <path
                        key={`b${arc.id}`}
                        d={arc.back}
                        stroke={`url(#${uid}-${arc.id})`}
                        strokeWidth={arc.width}
                        opacity={arc.opacity}
                    />
                ))}
            </g>

            {frame.dotsBehind
                ? frame.dots.map((dot, i) => <BloubDot key={`pb${i}`} dot={dot} ink={ink} paper={paper} />)
                : null}

            <g opacity={frame.bodyAlpha}>
                <path d={frame.bodyPath} fill={paper} />
                <g mask={`url(#${maskId})`}>
                    <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={ink} />
                </g>
            </g>

            {!frame.dotsBehind
                ? frame.dots.map((dot, i) => <BloubDot key={`pf${i}`} dot={dot} ink={ink} paper={paper} />)
                : null}

            {frame.notif ? <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} /> : null}

            <g fill="none" strokeLinecap="round">
                {frame.arcs.map((arc) => (
                    <path
                        key={`f${arc.id}`}
                        d={arc.front}
                        stroke={`url(#${uid}-${arc.id})`}
                        strokeWidth={arc.width}
                        opacity={arc.opacity}
                    />
                ))}
            </g>
        </svg>
    )
}

function BloubDot({
    dot,
    ink,
    paper,
}: {
    dot: BotFrame["dots"][number]
    ink: string
    paper: string
}) {
    const fill = dot.color ?? (dot.depth === undefined ? ink : mixHex(paper.startsWith("#") ? paper : "#f9f9f9", ink, dot.depth))
    if (dot.d) {
        return (
            <path
                d={dot.d}
                fill={fill}
                opacity={dot.opacity}
                transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
            />
        )
    }
    return <circle cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />
}
