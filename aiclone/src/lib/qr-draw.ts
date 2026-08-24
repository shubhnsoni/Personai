import { encodeQr } from "@/lib/qr-encode"

export type QrStyle = "cyan" | "ink" | "glass"

export async function drawQrCard(opts: {
    url: string
    name: string
    style?: QrStyle
    size?: number
}) {
    const modules = encodeQr(opts.url)
    const n = modules.size
    const canvas = document.createElement("canvas")
    const out = opts.size || 1080
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No canvas")

    const style = opts.style || "cyan"
    const ink = style === "ink"
    const glass = style === "glass"
    const bg = ink ? "#f4f4f5" : "#09090b"
    const fg = ink ? "#09090b" : "#00D7FF"
    const fg2 = ink ? "#18181b" : "#e4e4e7"
    const pad = out * 0.09
    const footer = out * 0.16
    const field = out - pad * 2 - footer
    const cell = field / n
    const radius = Math.max(1.2, cell * 0.32)

    // card
    ctx.fillStyle = bg
    roundRect(ctx, 0, 0, out, out, out * 0.06)
    ctx.fill()

    if (!ink) {
        const g = ctx.createRadialGradient(out * 0.2, 0, 20, out * 0.3, out * 0.1, out * 0.7)
        g.addColorStop(0, "rgba(0,215,255,0.18)")
        g.addColorStop(1, "rgba(0,215,255,0)")
        ctx.fillStyle = g
        ctx.fillRect(0, 0, out, out)
    }

    const ox = pad
    const oy = pad * 0.85

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!modules.get(r, c)) continue
            const finder = inFinder(r, c, n)
            ctx.fillStyle = finder ? fg : fg2
            const x = ox + c * cell
            const y = oy + r * cell
            const s = cell * (glass ? 0.78 : 0.88)
            const inset = (cell - s) / 2
            roundRect(ctx, x + inset, y + inset, s, s, radius)
            ctx.fill()
        }
    }

    // name + url
    ctx.fillStyle = ink ? "#09090b" : "#fafafa"
    ctx.font = `600 ${Math.round(out * 0.038)}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(opts.name.slice(0, 32), out / 2, out - footer * 0.62)
    ctx.fillStyle = ink ? "#52525b" : "#a1a1aa"
    ctx.font = `400 ${Math.round(out * 0.024)}px ui-sans-serif, system-ui, sans-serif`
    const label = opts.url.replace(/^https?:\/\//, "")
    ctx.fillText(label.slice(0, 48), out / 2, out - footer * 0.32)

    return canvas
}

function inFinder(r: number, c: number, n: number) {
    const box = (rr: number, cc: number) => rr < 7 && cc < 7
    return box(r, c) || box(r, n - 1 - c) || box(n - 1 - r, c)
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
