/**
 * Canvas-drawn billboard shown next to a dish placed in AR.
 *
 * It exists in the 3D scene rather than in HTML because an AR session covers the
 * whole screen: in `immersive-ar` the page's own DOM is only composited when
 * `dom-overlay` is granted, which is optional. Drawing into the scene is the one
 * way to be sure the detail is visible on every device.
 *
 * Kept deliberately small — it is a glance, not a spec sheet.
 */

export type ArCardInfo = {
    title: string
    price: string
    diet?: string | null
    /** Mean of real OfferReview rows, or null when nothing has been reviewed. */
    rating?: number | null
    reviewCount?: number | null
}

const CARD_PX_W = 900
const CARD_PX_H = 420

/**
 * Frosted grain, generated once and reused.
 *
 * Real glassmorphism blurs whatever is behind the panel. That is not possible
 * here: this is a texture inside the AR scene, and blurring the background would
 * mean sampling the live camera feed, which WebXR only exposes through
 * `raw-camera-access` — not granted to ordinary pages. So the glass is faked with
 * grain, a rim light and a specular sheen, over a fill opaque enough to stay
 * readable against bright food or a pale table.
 */
let grainCanvas: HTMLCanvasElement | null = null

function grain(): HTMLCanvasElement {
    if (grainCanvas) return grainCanvas
    const c = document.createElement("canvas")
    c.width = 180
    c.height = 180
    const ctx = c.getContext("2d")
    if (ctx) {
        const img = ctx.createImageData(c.width, c.height)
        for (let i = 0; i < img.data.length; i += 4) {
            const v = 128 + (Math.random() - 0.5) * 90
            img.data[i] = v
            img.data[i + 1] = v
            img.data[i + 2] = v
            img.data[i + 3] = 26
        }
        ctx.putImageData(img, 0, 0)
    }
    grainCanvas = c
    return c
}

export function drawArCard(info: ArCardInfo): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = CARD_PX_W
    canvas.height = CARD_PX_H
    const ctx = canvas.getContext("2d")
    if (!ctx) return canvas

    const pad = 30
    const x = pad
    const y = pad
    const w = CARD_PX_W - pad * 2
    const h = CARD_PX_H - pad * 2
    const radius = 56

    // drop shadow, so the panel reads as floating above the dish
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.6)"
    ctx.shadowBlur = 44
    ctx.shadowOffsetY = 14
    round(ctx, x, y, w, h, radius)
    ctx.fillStyle = "rgba(12,18,30,0.9)"
    ctx.fill()
    ctx.restore()

    // everything textural is clipped to the panel
    ctx.save()
    round(ctx, x, y, w, h, radius)
    ctx.clip()

    const base = ctx.createLinearGradient(x, y, x, y + h)
    base.addColorStop(0, "rgba(32,44,66,0.92)")
    base.addColorStop(0.55, "rgba(16,24,38,0.93)")
    base.addColorStop(1, "rgba(9,13,22,0.95)")
    ctx.fillStyle = base
    ctx.fillRect(x, y, w, h)

    // frosted grain
    const g = grain()
    for (let gy = y; gy < y + h; gy += g.height) {
        for (let gx = x; gx < x + w; gx += g.width) ctx.drawImage(g, gx, gy)
    }

    // broad sheen across the upper half
    const sheen = ctx.createLinearGradient(x, y, x + w * 0.35, y + h)
    sheen.addColorStop(0, "rgba(255,255,255,0.17)")
    sheen.addColorStop(0.45, "rgba(255,255,255,0.04)")
    sheen.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = sheen
    ctx.fillRect(x, y, w, h)

    // narrow specular streak, the giveaway that a surface is glass
    ctx.save()
    ctx.translate(x + w * 0.16, y)
    ctx.rotate(0.42)
    const streak = ctx.createLinearGradient(0, 0, 150, 0)
    streak.addColorStop(0, "rgba(255,255,255,0)")
    streak.addColorStop(0.5, "rgba(255,255,255,0.11)")
    streak.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = streak
    ctx.fillRect(0, -40, 150, h + 120)
    ctx.restore()

    // cyan bloom in the lower right, tying it to the accent colour
    const bloom = ctx.createRadialGradient(x + w * 0.86, y + h * 0.9, 0, x + w * 0.86, y + h * 0.9, w * 0.4)
    bloom.addColorStop(0, "rgba(63,224,255,0.16)")
    bloom.addColorStop(1, "rgba(63,224,255,0)")
    ctx.fillStyle = bloom
    ctx.fillRect(x, y, w, h)

    ctx.restore()

    // outer rim, brightest at the top where light would catch a glass edge
    round(ctx, x, y, w, h, radius)
    const rim = ctx.createLinearGradient(x, y, x, y + h)
    rim.addColorStop(0, "rgba(255,255,255,0.4)")
    rim.addColorStop(0.5, "rgba(150,220,255,0.18)")
    rim.addColorStop(1, "rgba(255,255,255,0.1)")
    ctx.strokeStyle = rim
    ctx.lineWidth = 3.5
    ctx.stroke()

    // inner highlight just inside the top edge, for panel thickness
    ctx.save()
    round(ctx, x + 4, y + 4, w - 8, h - 8, radius - 4)
    ctx.clip()
    ctx.beginPath()
    ctx.moveTo(x + radius * 0.6, y + 5)
    ctx.lineTo(x + w - radius * 0.6, y + 5)
    ctx.strokeStyle = "rgba(255,255,255,0.3)"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    const left = x + 40
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"

    // row 1 — diet mark then the dish name
    const dietColor = dietFill(info.diet)
    let titleLeft = left
    if (dietColor) {
        drawDietMark(ctx, left, y + 62, 40, dietColor)
        titleLeft = left + 60
    }
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.5)"
    ctx.shadowBlur = 8
    ctx.fillStyle = "#f6fbff"
    ctx.font = "700 60px ui-sans-serif, system-ui, -apple-system, sans-serif"
    ctx.fillText(fit(ctx, info.title, x + w - 40 - titleLeft), titleLeft, y + 96)
    ctx.restore()

    // row 2 — rating on the left, price on the right
    const rowY = y + h - 62
    const rating = typeof info.rating === "number" && info.rating > 0 ? info.rating : null
    if (rating) {
        drawStar(ctx, left, rowY - 34, 40, "#fbbf24")
        ctx.fillStyle = "#f6fbff"
        ctx.font = "700 48px ui-sans-serif, system-ui, -apple-system, sans-serif"
        ctx.fillText(rating.toFixed(1), left + 54, rowY)
        const count = info.reviewCount || 0
        if (count > 0) {
            ctx.fillStyle = "rgba(238,247,255,0.62)"
            ctx.font = "500 38px ui-sans-serif, system-ui, -apple-system, sans-serif"
            ctx.fillText(`(${count})`, left + 54 + ctx.measureText(rating.toFixed(1)).width + 46, rowY)
        }
    } else {
        ctx.fillStyle = "rgba(238,247,255,0.52)"
        ctx.font = "500 38px ui-sans-serif, system-ui, -apple-system, sans-serif"
        ctx.fillText("No reviews yet", left, rowY)
    }

    ctx.save()
    ctx.textAlign = "right"
    ctx.shadowColor = "rgba(0,0,0,0.45)"
    ctx.shadowBlur = 10
    ctx.fillStyle = "#5ce7ff"
    ctx.font = "800 58px ui-sans-serif, system-ui, -apple-system, sans-serif"
    ctx.fillText(info.price, x + w - 40, rowY + 4)
    ctx.restore()

    return canvas
}

export function drawArOrb(glyph: string): HTMLCanvasElement {
    const s = 256
    const canvas = document.createElement("canvas")
    canvas.width = s
    canvas.height = s
    const ctx = canvas.getContext("2d")
    if (!ctx) return canvas

    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.5)"
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 6
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, 104, 0, Math.PI * 2)
    const g = ctx.createLinearGradient(0, 24, 0, s - 24)
    g.addColorStop(0, "rgba(16,26,42,0.94)")
    g.addColorStop(1, "rgba(5,9,16,0.9)")
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.arc(s / 2, s / 2, 104, 0, Math.PI * 2)
    ctx.lineWidth = 7
    ctx.strokeStyle = "rgba(63,224,255,0.75)"
    ctx.stroke()

    ctx.fillStyle = "#eaf9ff"
    ctx.font = "700 132px ui-sans-serif, system-ui, -apple-system, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(glyph, s / 2, s / 2 + 6)
    return canvas
}

function dietFill(diet?: string | null): string | null {
    switch (diet) {
        case "VEG":
        case "VEGAN":
            return "#10b981"
        case "EGG":
            return "#fbbf24"
        case "NONVEG":
            return "#f43f5e"
        default:
            return null
    }
}

/** The square-outline-with-a-dot mark used on Indian menus. */
function drawDietMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    round(ctx, x, y, size, size, 9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size * 0.26, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const r = size / 2
    const cx = x + r
    const cy = y + r
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45
        const a = (Math.PI / 5) * i - Math.PI / 2
        const px = cx + Math.cos(a) * rad
        const py = cy + Math.sin(a) * rad
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
    if (ctx.measureText(text).width <= max) return text
    let t = text
    while (t.length > 4 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
    return `${t}…`
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rad = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.arcTo(x + w, y, x + w, y + h, rad)
    ctx.arcTo(x + w, y + h, x, y + h, rad)
    ctx.arcTo(x, y + h, x, y, rad)
    ctx.arcTo(x, y, x + w, y, rad)
    ctx.closePath()
}
