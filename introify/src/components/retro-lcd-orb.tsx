"use client"

import { useId, useMemo } from "react"
import { LCD_CIRCLE_PATH, LCD_SIZE, lcdEyes, type LcdLid } from "@/lib/bloub/lcd"
import "./retro-lcd-orb.css"

export function RetroLcdOrb({
    size,
    gaze,
    lid,
    expression,
    still = false,
    aura = "still",
    mood = "idle",
}: {
    size: number
    gaze: { x: number; y: number }
    lid: LcdLid
    expression: string
    still?: boolean
    aura?: string
    mood?: string
}) {
    const gridId = `lcd-grid-${useId().replace(/:/g, "")}`
    const gx = still ? 0 : Math.round(gaze.x * 3) / 3
    const gy = still ? 0 : Math.round(gaze.y * 2) / 2
    const eyes = useMemo(() => lcdEyes({ gaze: { x: gx, y: gy }, lid: still ? "none" : lid, expression }), [gx, gy, lid, expression, still])

    return (
        <svg
            className="retro-lcd-orb"
            width={size}
            height={size}
            viewBox={`0 0 ${LCD_SIZE} ${LCD_SIZE}`}
            data-still={still}
            data-aura={aura}
            data-mood={mood}
            data-expression={expression}
            aria-hidden
            focusable="false"
        >
            <defs>
                <pattern id={gridId} width="1" height="1" patternUnits="userSpaceOnUse">
                    <path d="M0 1V0H1" fill="none" stroke="currentColor" strokeWidth="0.09" />
                </pattern>
            </defs>
            <g className="retro-lcd-character">
                <path className="retro-lcd-ink" d={LCD_CIRCLE_PATH} shapeRendering="crispEdges" />
                <g className="retro-lcd-eyes">
                    {eyes.map((d, i) => <path key={i} className="retro-lcd-paper" data-lcd-eye={i} d={d} shapeRendering="crispEdges" />)}
                </g>
                <path className="retro-lcd-grid" d={LCD_CIRCLE_PATH} fill={`url(#${gridId})`} shapeRendering="crispEdges" />
            </g>
        </svg>
    )
}
