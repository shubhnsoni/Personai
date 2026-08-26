import { encodeQr } from "@/lib/qr-encode"

export type QrStyle = "cyan" | "ink" | "frost" | "soft"

export const QR_LOOKS: { id: QrStyle; label: string; swatch: string }[] = [
    { id: "cyan", label: "Cyan", swatch: "#00D7FF" },
    { id: "ink", label: "Ink", swatch: "#1c1917" },
    { id: "frost", label: "Frost", swatch: "#c4e8ff" },
    { id: "soft", label: "Soft", swatch: "#e2c4a8" },
]

const RATIO = 5 / 4

type Finish = "flat" | "frost" | "soft"

type Theme = {
    finish: Finish
    bgA: string
    bgB: string
    glow: string
    glow2: string
    plate: string
    plateShine: string
    plateEdge: string
    plateInner: string
    module: string
    moduleHi: string
    moduleLo: string
    finder: string
    finderGap: string
    name: string
    handle: string
    mute: string
    brand: string
    grain: number
    dark: boolean
}

const THEMES: Record<QrStyle, Theme> = {
    cyan: {
        finish: "flat",
        bgA: "#07090c",
        bgB: "#0b1520",
        glow: "rgba(0,215,255,0.30)",
        glow2: "rgba(26,77,255,0.16)",
        plate: "rgba(8,14,20,0.86)",
        plateShine: "rgba(255,255,255,0.06)",
        plateEdge: "rgba(0,215,255,0.38)",
        plateInner: "rgba(255,255,255,0.06)",
        module: "#f3f7f8",
        moduleHi: "#ffffff",
        moduleLo: "#c9d4d8",
        finder: "#00D7FF",
        finderGap: "#0a1218",
        name: "#f7fafb",
        handle: "#00D7FF",
        mute: "rgba(232,240,244,0.48)",
        brand: "rgba(0,215,255,0.9)",
        grain: 0.035,
        dark: true,
    },
    ink: {
        finish: "flat",
        bgA: "#f4efe6",
        bgB: "#e5d9c6",
        glow: "rgba(0,215,255,0.12)",
        glow2: "rgba(9,9,11,0.05)",
        plate: "#fbf7ef",
        plateShine: "rgba(255,255,255,0.55)",
        plateEdge: "rgba(28,25,23,0.2)",
        plateInner: "rgba(255,255,255,0.7)",
        module: "#141311",
        moduleHi: "#2a2724",
        moduleLo: "#0c0b0a",
        finder: "#0e7490",
        finderGap: "#fbf7ef",
        name: "#141311",
        handle: "#0e7490",
        mute: "rgba(28,25,23,0.48)",
        brand: "#0e7490",
        grain: 0.028,
        dark: false,
    },
    frost: {
        finish: "frost",
        bgA: "#071018",
        bgB: "#12304a",
        glow: "rgba(125,211,252,0.32)",
        glow2: "rgba(0,215,255,0.18)",
        plate: "rgba(210,236,255,0.10)",
        plateShine: "rgba(255,255,255,0.22)",
        plateEdge: "rgba(186,230,253,0.55)",
        plateInner: "rgba(255,255,255,0.28)",
        module: "#eaf6ff",
        moduleHi: "#ffffff",
        moduleLo: "#b7d4ea",
        finder: "#7dd3fc",
        finderGap: "rgba(6,18,28,0.72)",
        name: "#f5fbff",
        handle: "#7dd3fc",
        mute: "rgba(226,232,240,0.55)",
        brand: "rgba(186,230,253,0.95)",
        grain: 0.02,
        dark: true,
    },
    soft: {
        finish: "soft",
        bgA: "#f3e4d4",
        bgB: "#e3cbb3",
        glow: "rgba(196,140,90,0.18)",
        glow2: "rgba(90,58,36,0.08)",
        plate: "#f7eee4",
        plateShine: "rgba(255,252,246,0.7)",
        plateEdge: "rgba(140,96,62,0.24)",
        plateInner: "rgba(90,58,36,0.08)",
        module: "#3a2a20",
        moduleHi: "#6a5040",
        moduleLo: "#241810",
        finder: "#b45309",
        finderGap: "#f7eee4",
        name: "#3a2a20",
        handle: "#9a5b2a",
        mute: "rgba(58,42,32,0.48)",
        brand: "#9a5b2a",
        grain: 0.03,
        dark: false,
    },
}

export async function drawQrCard(opts: {
    url: string
    name: string
    style?: QrStyle
    size?: number
}) {
    const modules = encodeQr(opts.url)
    const n = modules.size
    const w = opts.size || 1080
    const h = Math.round(w * RATIO)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No canvas")

    const theme = THEMES[opts.style || "cyan"]
    const family = fontFamily()
    const pad = w * 0.078
    const top = w * 0.118
    const plate = w - pad * 2
    const plateY = top
    const quiet = plate * 0.084
    const field = plate - quiet * 2
    const cell = field / n
    const ox = pad + quiet
    const oy = plateY + quiet
    const plateR = w * (theme.finish === "soft" ? 0.072 : 0.046)

    paintBackdrop(ctx, w, h, theme)
    grain(ctx, w, h, theme.grain)

    ctx.strokeStyle = theme.dark ? "rgba(255,255,255,0.08)" : "rgba(9,9,11,0.14)"
    ctx.lineWidth = Math.max(1, w * 0.002)
    roundRect(ctx, w * 0.012, w * 0.012, w - w * 0.024, h - w * 0.024, w * 0.048)
    ctx.stroke()

    ctx.fillStyle = theme.brand
    ctx.font = `600 ${Math.round(w * 0.022)}px ${family}`
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(w * 0.004)}px`
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    const brandY = pad * 0.78
    ctx.beginPath()
    ctx.arc(pad, brandY, w * 0.009, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillText("PERSONALINK", pad + w * 0.028, brandY)
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"

    paintPlate(ctx, pad, plateY, plate, plateR, w, theme)

    const radius = cell * (theme.finish === "soft" ? 0.38 : theme.finish === "frost" ? 0.28 : 0.18)
    const inset = cell * (theme.finish === "soft" ? 0.08 : 0.055)
    paintModules(ctx, modules, n, ox, oy, cell, radius, inset, theme)

    drawFinder(ctx, ox, oy, cell, 0, 0, theme)
    drawFinder(ctx, ox, oy, cell, 0, n - 7, theme)
    drawFinder(ctx, ox, oy, cell, n - 7, 0, theme)

    const textX = w / 2
    const nameY = plateY + plate + w * 0.072
    const display = fitText(ctx, opts.name.trim() || "PersonaLink", `600 ${Math.round(w * 0.052)}px ${family}`, w - pad * 2)
    ctx.fillStyle = theme.name
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.font = display.font
    ctx.fillText(display.text, textX, nameY)

    ctx.fillStyle = theme.handle
    ctx.font = `500 ${Math.round(w * 0.03)}px ${family}`
    ctx.fillText(handleFrom(opts.url), textX, nameY + w * 0.046)

    ctx.strokeStyle = theme.finder + "55"
    ctx.lineWidth = Math.max(1, w * 0.002)
    ctx.beginPath()
    ctx.moveTo(textX - w * 0.06, nameY + w * 0.062)
    ctx.lineTo(textX + w * 0.06, nameY + w * 0.062)
    ctx.stroke()

    ctx.fillStyle = theme.mute
    ctx.font = `400 ${Math.round(w * 0.022)}px ${family}`
    ctx.fillText("Scan to chat · book · buy", textX, h - pad * 0.7)

    return canvas
}

function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme) {
    roundRect(ctx, 0, 0, w, h, w * 0.055)
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, theme.bgA)
    bg.addColorStop(1, theme.bgB)
    ctx.fillStyle = bg
    ctx.fill()

    const g1 = ctx.createRadialGradient(w * 0.18, h * 0.02, 0, w * 0.22, h * 0.08, w * 0.72)
    g1.addColorStop(0, theme.glow)
    g1.addColorStop(1, "transparent")
    ctx.fillStyle = g1
    ctx.fill()

    const g2 = ctx.createRadialGradient(w * 0.88, h * 0.92, 0, w * 0.8, h * 0.86, w * 0.7)
    g2.addColorStop(0, theme.glow2)
    g2.addColorStop(1, "transparent")
    ctx.fillStyle = g2
    ctx.fill()

    if (theme.finish === "frost") {
        const orb = ctx.createRadialGradient(w * 0.72, h * 0.22, 0, w * 0.72, h * 0.22, w * 0.42)
        orb.addColorStop(0, "rgba(255,255,255,0.16)")
        orb.addColorStop(1, "transparent")
        ctx.fillStyle = orb
        ctx.fill()
        const orb2 = ctx.createRadialGradient(w * 0.28, h * 0.7, 0, w * 0.28, h * 0.7, w * 0.38)
        orb2.addColorStop(0, "rgba(0,215,255,0.14)")
        orb2.addColorStop(1, "transparent")
        ctx.fillStyle = orb2
        ctx.fill()
    }
}

function paintPlate(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    r: number,
    w: number,
    theme: Theme,
) {
    ctx.save()
    if (theme.finish === "soft") {
        ctx.shadowColor = "rgba(92,58,34,0.28)"
        ctx.shadowBlur = w * 0.055
        ctx.shadowOffsetY = w * 0.018
    } else {
        ctx.shadowColor = theme.glow
        ctx.shadowBlur = w * 0.05
    }
    roundRect(ctx, x, y, size, size, r)
    ctx.fillStyle = theme.plate
    ctx.fill()
    ctx.restore()

    roundRect(ctx, x, y, size, size, r)
    ctx.save()
    ctx.clip()

    if (theme.finish === "frost") {
        const mist = ctx.createLinearGradient(x, y, x + size, y + size)
        mist.addColorStop(0, "rgba(255,255,255,0.16)")
        mist.addColorStop(0.45, "rgba(255,255,255,0.02)")
        mist.addColorStop(1, "rgba(0,215,255,0.08)")
        ctx.fillStyle = mist
        ctx.fill()

        ctx.translate(x + size * 0.15, y - size * 0.1)
        ctx.rotate((-22 * Math.PI) / 180)
        const streak = ctx.createLinearGradient(0, 0, size * 0.28, 0)
        streak.addColorStop(0, "transparent")
        streak.addColorStop(0.45, "rgba(255,255,255,0.22)")
        streak.addColorStop(1, "transparent")
        ctx.fillStyle = streak
        ctx.fillRect(-size, 0, size * 2.4, size * 0.22)
    } else if (theme.finish === "soft") {
        const cave = ctx.createLinearGradient(x, y, x, y + size)
        cave.addColorStop(0, theme.plateShine)
        cave.addColorStop(0.35, "transparent")
        cave.addColorStop(1, theme.plateInner)
        ctx.fillStyle = cave
        ctx.fill()
    } else {
        const shine = ctx.createLinearGradient(x, y, x, y + size * 0.45)
        shine.addColorStop(0, theme.plateShine)
        shine.addColorStop(1, "transparent")
        ctx.fillStyle = shine
        ctx.fill()
    }

    ctx.restore()

    ctx.strokeStyle = theme.plateEdge
    ctx.lineWidth = Math.max(1.5, w * (theme.finish === "frost" ? 0.0042 : 0.0032))
    roundRect(ctx, x, y, size, size, r)
    ctx.stroke()

    if (theme.finish === "frost") {
        ctx.strokeStyle = theme.plateInner
        ctx.lineWidth = Math.max(1, w * 0.002)
        const inset = w * 0.008
        roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, Math.max(2, r - inset))
        ctx.stroke()
    }
}

function paintModules(
    ctx: CanvasRenderingContext2D,
    modules: { size: number; get: (r: number, c: number) => boolean },
    n: number,
    ox: number,
    oy: number,
    cell: number,
    radius: number,
    inset: number,
    theme: Theme,
) {
    const cells: { x: number; y: number; s: number }[] = []
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!modules.get(r, c) || inFinder(r, c, n)) continue
            cells.push({
                x: ox + c * cell + inset,
                y: oy + r * cell + inset,
                s: cell - inset * 2,
            })
        }
    }

    if (theme.finish === "soft") {
        const lift = Math.max(1, cell * 0.1)
        ctx.fillStyle = theme.moduleLo
        for (const m of cells) {
            roundRect(ctx, m.x, m.y + lift, m.s, m.s, radius)
            ctx.fill()
        }
        ctx.fillStyle = theme.module
        for (const m of cells) {
            roundRect(ctx, m.x, m.y, m.s, m.s, radius)
            ctx.fill()
        }
        ctx.fillStyle = theme.moduleHi
        for (const m of cells) {
            roundRect(ctx, m.x + m.s * 0.12, m.y + m.s * 0.1, m.s * 0.46, m.s * 0.32, radius * 0.7)
            ctx.fill()
        }
        return
    }

    if (theme.finish === "frost") {
        for (const m of cells) {
            roundRect(ctx, m.x, m.y, m.s, m.s, radius)
            ctx.fillStyle = theme.module
            ctx.fill()
            const hi = ctx.createLinearGradient(m.x, m.y, m.x, m.y + m.s)
            hi.addColorStop(0, theme.moduleHi)
            hi.addColorStop(0.45, "transparent")
            ctx.fillStyle = hi
            ctx.fill()
        }
        return
    }

    ctx.fillStyle = theme.module
    for (const m of cells) {
        roundRect(ctx, m.x, m.y, m.s, m.s, radius)
        ctx.fill()
    }
}

function handleFrom(url: string) {
    try {
        const u = new URL(url)
        const path = u.pathname.replace(/\/$/, "") || "/"
        return path.startsWith("/") ? path : `/${path}`
    } catch {
        return url.replace(/^https?:\/\/[^/]+/i, "") || url
    }
}

function fontFamily() {
    if (typeof document === "undefined") return "ui-sans-serif, system-ui, sans-serif"
    const family = getComputedStyle(document.body).fontFamily
    return family || "ui-sans-serif, system-ui, sans-serif"
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: string, max: number) {
    ctx.font = font
    if (ctx.measureText(text).width <= max) return { font, text }
    const size = /([\d.]+)px/.exec(font)
    let px = size ? Number(size[1]) : 32
    while (px > 18) {
        px -= 1
        ctx.font = font.replace(/[\d.]+px/, `${px}px`)
        if (ctx.measureText(text).width <= max) return { font: ctx.font, text }
    }
    let cut = text
    while (cut.length > 4 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
    return { font: ctx.font, text: `${cut}…` }
}

function inFinder(r: number, c: number, n: number) {
    const box = (rr: number, cc: number) => rr >= 0 && rr < 7 && cc >= 0 && cc < 7
    return box(r, c) || box(r, c - (n - 7)) || box(r - (n - 7), c)
}

function drawFinder(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    cell: number,
    r: number,
    c: number,
    theme: Theme,
) {
    const x = ox + c * cell
    const y = oy + r * cell
    const rad = cell * (theme.finish === "soft" ? 0.72 : 0.55)

    if (theme.finish === "soft") {
        const lift = cell * 0.12
        roundRect(ctx, x, y + lift, cell * 7, cell * 7, rad)
        ctx.fillStyle = theme.moduleLo
        ctx.fill()
        roundRect(ctx, x, y, cell * 7, cell * 7, rad)
        ctx.fillStyle = theme.finder
        ctx.fill()
        roundRect(ctx, x + cell, y + cell, cell * 5, cell * 5, rad * 0.7)
        ctx.fillStyle = theme.finderGap
        ctx.fill()
        roundRect(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, rad * 0.5)
        ctx.fillStyle = theme.finder
        ctx.fill()
        roundRect(ctx, x + cell * 2.35, y + cell * 2.25, cell * 1.5, cell * 1.05, rad * 0.35)
        ctx.fillStyle = theme.moduleHi
        ctx.globalAlpha = 0.35
        ctx.fill()
        ctx.globalAlpha = 1
        return
    }

    if (theme.finish === "frost") {
        roundRect(ctx, x, y, cell * 7, cell * 7, rad)
        ctx.fillStyle = theme.finder
        ctx.fill()
        const rim = ctx.createLinearGradient(x, y, x, y + cell * 3)
        rim.addColorStop(0, "rgba(255,255,255,0.4)")
        rim.addColorStop(1, "transparent")
        ctx.fillStyle = rim
        ctx.fill()
        roundRect(ctx, x + cell, y + cell, cell * 5, cell * 5, rad * 0.7)
        ctx.fillStyle = theme.finderGap
        ctx.fill()
        roundRect(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, rad * 0.45)
        ctx.fillStyle = theme.finder
        ctx.fill()
        return
    }

    roundRect(ctx, x, y, cell * 7, cell * 7, rad)
    ctx.fillStyle = theme.finder
    ctx.fill()
    roundRect(ctx, x + cell, y + cell, cell * 5, cell * 5, rad * 0.7)
    ctx.fillStyle = theme.finderGap
    ctx.fill()
    roundRect(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, rad * 0.45)
    ctx.fillStyle = theme.finder
    ctx.fill()
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const span = amount * 255
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * span
        d[i] = clamp(d[i] + n)
        d[i + 1] = clamp(d[i + 1] + n)
        d[i + 2] = clamp(d[i + 2] + n)
    }
    ctx.putImageData(img, 0, 0)
}

function clamp(v: number) {
    return v < 0 ? 0 : v > 255 ? 255 : v
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rad = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.arcTo(x + w, y, x + w, y + h, rad)
    ctx.arcTo(x + w, y + h, x, y + h, rad)
    ctx.arcTo(x, y + h, x, y, rad)
    ctx.arcTo(x, y, x + w, y, rad)
    ctx.closePath()
}
