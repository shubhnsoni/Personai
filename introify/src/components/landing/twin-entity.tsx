"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export function TwinEntity({
    size = 320,
    gaze = { x: 0, y: 0 },
    className,
    onClick,
    label = "Introify AI",
}: {
    size?: number
    gaze?: { x: number; y: number }
    className?: string
    onClick?: () => void
    label?: string
}) {
    const ref = useRef<HTMLCanvasElement>(null)
    const gazeRef = useRef(gaze)
    gazeRef.current = gaze

    useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        let raf = 0
        const dpr = Math.min(2, window.devicePixelRatio || 1)

        const blobs = [
            { x: 0.46, y: 0.44, r: 0.34, vx: 0.00018, vy: 0.00012 },
            { x: 0.58, y: 0.52, r: 0.28, vx: -0.00014, vy: 0.00016 },
            { x: 0.42, y: 0.58, r: 0.22, vx: 0.00011, vy: -0.00013 },
            { x: 0.52, y: 0.38, r: 0.18, vx: -0.00009, vy: 0.0001 },
        ]

        const fit = () => {
            const s = Math.max(1, canvas.clientWidth)
            canvas.width = Math.round(s * dpr)
            canvas.height = Math.round(s * dpr)
        }
        fit()

        const draw = (t: number) => {
            const w = canvas.width
            const h = canvas.height
            const g = gazeRef.current
            ctx.clearRect(0, 0, w, h)

            const cx = w / 2
            const cy = h / 2
            const rad = Math.min(w, h) * 0.46

            ctx.save()
            ctx.beginPath()
            ctx.arc(cx, cy, rad, 0, Math.PI * 2)
            ctx.clip()

            const bg = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad)
            bg.addColorStop(0, "#14304a")
            bg.addColorStop(0.55, "#0a1730")
            bg.addColorStop(1, "#050816")
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, w, h)

            if (!reduce) {
                for (const b of blobs) {
                    b.x += Math.cos(t * b.vx) * 0.00008
                    b.y += Math.sin(t * b.vy) * 0.00008
                    const bx = cx + (b.x - 0.5) * rad * 1.6 + g.x * 10
                    const by = cy + (b.y - 0.5) * rad * 1.6 + g.y * 8
                    const br = rad * b.r
                    const grd = ctx.createRadialGradient(bx, by, 0, bx, by, br)
                    grd.addColorStop(0, "rgba(120, 230, 255, 0.55)")
                    grd.addColorStop(0.45, "rgba(90, 120, 255, 0.22)")
                    grd.addColorStop(1, "rgba(10, 16, 40, 0)")
                    ctx.fillStyle = grd
                    ctx.beginPath()
                    ctx.arc(bx, by, br, 0, Math.PI * 2)
                    ctx.fill()
                }
            }

            const spec = ctx.createRadialGradient(cx - rad * 0.28, cy - rad * 0.32, 2, cx - rad * 0.18, cy - rad * 0.22, rad * 0.55)
            spec.addColorStop(0, "rgba(255,255,255,0.55)")
            spec.addColorStop(0.25, "rgba(200,240,255,0.12)")
            spec.addColorStop(1, "rgba(255,255,255,0)")
            ctx.fillStyle = spec
            ctx.fillRect(0, 0, w, h)

            const eye = (ox: number) => {
                const ex = cx + ox + g.x * 10
                const ey = cy - rad * 0.04 + g.y * 8
                ctx.fillStyle = "rgba(8, 12, 22, 0.92)"
                ctx.beginPath()
                ctx.ellipse(ex, ey, rad * 0.07, rad * 0.1, 0, 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = "rgba(255,255,255,0.85)"
                ctx.beginPath()
                ctx.arc(ex - rad * 0.02, ey - rad * 0.03, rad * 0.018, 0, Math.PI * 2)
                ctx.fill()
            }
            eye(-rad * 0.11)
            eye(rad * 0.11)
            ctx.restore()

            ctx.beginPath()
            ctx.arc(cx, cy, rad, 0, Math.PI * 2)
            ctx.strokeStyle = "rgba(180, 230, 255, 0.28)"
            ctx.lineWidth = 1.5 * dpr
            ctx.stroke()

            raf = window.requestAnimationFrame(draw)
        }
        raf = window.requestAnimationFrame(draw)
        return () => window.cancelAnimationFrame(raf)
    }, [])

    return (
        <button type="button" className={cn("tw-entity", className)} style={{ width: size, height: size }} onClick={onClick} aria-label={label}>
            <canvas ref={ref} />
        </button>
    )
}
