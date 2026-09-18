import { encodeQr } from "@/lib/qr-encode"

export type QrStyle = "soft-studio" | "clean-print" | "warm-editorial"

/** Legacy style ids still accepted by callers / stored prefs. */
type LegacyQrStyle = "cyan" | "ink" | "frost" | "soft"

export const QR_LOOKS: { id: QrStyle; label: string; swatch: string }[] = [
    { id: "soft-studio", label: "Soft Studio", swatch: "#00D7FF" },
    { id: "clean-print", label: "Clean Print", swatch: "#1a2a44" },
    { id: "warm-editorial", label: "Warm Editorial", swatch: "#a04b2d" },
]

const RATIO = 4 / 3

type Theme = {
    bg: string
    bg2: string
    fg: string
    muted: string
    accent: string
    rule: string
    cta: string
    plate: string
    qrFg: string
    frameInner: string
    frameOuter: string
    footerBand: string
    footerBand2: string
    footerText: string
    handle: string
    grain: number
    dark: boolean
    outerBorder: string
}

const THEMES: Record<QrStyle, Theme> = {
    "soft-studio": {
        bg: "#0b1220",
        bg2: "#0e1a2c",
        fg: "#ffffff",
        muted: "#b4c8d7",
        accent: "#00D7FF",
        rule: "#00D7FF",
        cta: "#00D7FF",
        plate: "#ffffff",
        qrFg: "#000000",
        frameInner: "#00d7ff",
        frameOuter: "#ffffff",
        footerBand: "#08283a",
        footerBand2: "#00a0be",
        footerText: "#ffffff",
        handle: "rgba(180,200,215,0.85)",
        grain: 0.065,
        dark: true,
        outerBorder: "rgba(255,255,255,0.10)",
    },
    "clean-print": {
        bg: "#f7f4ee",
        bg2: "#efe9df",
        fg: "#1a2a44",
        muted: "#465a6e",
        accent: "#1a2a44",
        rule: "#788c64",
        cta: "#465a6e",
        plate: "#ffffff",
        qrFg: "#141c28",
        frameInner: "#1a2a44",
        frameOuter: "#1a2a44",
        footerBand: "#1a2a44",
        footerBand2: "#1a2a44",
        footerText: "#ffffff",
        handle: "rgba(70,90,110,0.85)",
        grain: 0.10,
        dark: false,
        outerBorder: "rgba(26,42,68,0.16)",
    },
    "warm-editorial": {
        bg: "#f5ede2",
        bg2: "#ebddd0",
        fg: "#a04b2d",
        muted: "#5a3c2d",
        accent: "#a04b2d",
        rule: "#78553c",
        cta: "#5a3c2d",
        plate: "#fffcf7",
        qrFg: "#322319",
        frameInner: "#646e46",
        frameOuter: "#483024",
        footerBand: "#483024",
        footerBand2: "#483024",
        footerText: "#ffffff",
        handle: "rgba(90,60,45,0.8)",
        grain: 0.10,
        dark: false,
        outerBorder: "rgba(72,48,36,0.18)",
    },
}

const LEGACY_MAP: Record<LegacyQrStyle, QrStyle> = {
    cyan: "soft-studio",
    frost: "soft-studio",
    ink: "clean-print",
    soft: "warm-editorial",
}

function resolveStyle(style?: string | null): QrStyle {
    if (!style) return "soft-studio"
    if (style === "soft-studio" || style === "clean-print" || style === "warm-editorial") return style
    if (style in LEGACY_MAP) return LEGACY_MAP[style as LegacyQrStyle]
    return "soft-studio"
}

let logoPromise: Promise<HTMLImageElement | null> | null = null

function loadLogo(): Promise<HTMLImageElement | null> {
    if (typeof Image === "undefined") return Promise.resolve(null)
    if (logoPromise) return logoPromise
    logoPromise = (async () => {
        const candidates = [
            "/brand/main/introify-logo-dark-still.png",
            "/brand/main/introify-logo-dark-still.svg",
            "/brand/main/introify-white.png",
            "/brand/introify-logo-dark-still.png",
        ]
        for (const src of candidates) {
            const img = await tryLoadImage(src)
            if (img) return img
        }
        return null
    })()
    return logoPromise
}

function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image()
        img.decoding = "async"
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
    })
}

export async function drawQrCard(opts: {
    url: string
    name: string
    style?: QrStyle | LegacyQrStyle | string
    size?: number
    cta?: string
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

    const theme = THEMES[resolveStyle(opts.style)]
    const sans = fontFamily()
    const script = `"Great Vibes", "Segoe Script", "Brush Script MT", Georgia, cursive`
    const s = w / 1080

    paintBackdrop(ctx, w, h, theme)
    softGrain(ctx, w, h, theme)

    // thin outer border
    ctx.strokeStyle = theme.outerBorder
    ctx.lineWidth = Math.max(1, w * 0.002)
    roundRect(ctx, w * 0.012, w * 0.012, w - w * 0.024, h - w * 0.024, w * 0.04)
    ctx.stroke()

    const textX = w / 2
    const nameText = (opts.name || "Introify").trim() || "Introify"

    // Title — elegant script / serif italic
    const titleY = Math.round(168 * s)
    const titleFit = fitScriptTitle(ctx, nameText, script, sans, w * 0.88, w)
    ctx.fillStyle = theme.fg
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.font = titleFit.font
    ctx.fillText(titleFit.text, textX, titleY)

    // CTA small-caps tracked line
    const ctaRaw = opts.cta || "Scan to chat · book · buy"
    const cta = normalizeCta(ctaRaw)
    const ctaY = titleY + Math.round(54 * s)
    const ctaSize = Math.round(21 * s)
    ctx.fillStyle = theme.cta
    ctx.font = `500 ${ctaSize}px ${sans}`
    drawTrackedCentered(ctx, cta, textX, ctaY, Math.round(5 * s))

    // thin rules beside CTA
    const ctaW = measureTracked(ctx, cta, Math.round(5 * s))
    const midY = ctaY - ctaSize * 0.35
    const ruleGap = Math.round(26 * s)
    const ruleLen = Math.round(78 * s)
    ctx.strokeStyle = theme.rule
    ctx.lineWidth = Math.max(1.5, 2 * s)
    ctx.beginPath()
    ctx.moveTo(textX - ctaW / 2 - ruleGap - ruleLen, midY)
    ctx.lineTo(textX - ctaW / 2 - ruleGap, midY)
    ctx.moveTo(textX + ctaW / 2 + ruleGap, midY)
    ctx.lineTo(textX + ctaW / 2 + ruleGap + ruleLen, midY)
    ctx.stroke()
    ctx.fillStyle = theme.rule
    ctx.beginPath()
    ctx.arc(textX - ctaW / 2 - ruleGap - ruleLen, midY, Math.max(2, 3 * s), 0, Math.PI * 2)
    ctx.arc(textX + ctaW / 2 + ruleGap + ruleLen, midY, Math.max(2, 3 * s), 0, Math.PI * 2)
    ctx.fill()

    // QR plate — white + double rounded frame, pure B/W modules
    const qrSize = Math.round(480 * s)
    const platePad = Math.round(28 * s)
    const plate = qrSize + platePad * 2
    const plateX = (w - plate) / 2
    const plateY = Math.round(500 * s)

    roundRect(ctx, plateX, plateY, plate, plate, Math.round(28 * s))
    ctx.fillStyle = theme.plate
    ctx.fill()

    // double frame
    const rOuter = Math.round(38 * s)
    const rInner = Math.round(30 * s)
    ctx.strokeStyle = theme.frameOuter
    ctx.lineWidth = Math.max(2, 3 * s)
    roundRect(ctx, plateX - 14 * s, plateY - 14 * s, plate + 28 * s, plate + 28 * s, rOuter)
    ctx.stroke()
    ctx.strokeStyle = theme.frameInner
    ctx.lineWidth = Math.max(1.5, 2 * s)
    roundRect(ctx, plateX - 5 * s, plateY - 5 * s, plate + 10 * s, plate + 10 * s, rInner)
    ctx.stroke()

    const quiet = platePad
    const field = qrSize
    const cell = field / n
    const ox = plateX + quiet
    const oy = plateY + quiet

    ctx.fillStyle = theme.qrFg
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!modules.get(r, c)) continue
            ctx.fillRect(ox + c * cell, oy + r * cell, Math.ceil(cell), Math.ceil(cell))
        }
    }

    // Handle under QR
    const handle = handleFrom(opts.url)
    const handleY = plateY + plate + Math.round(42 * s)
    ctx.fillStyle = theme.handle
    ctx.font = `500 ${Math.round(22 * s)}px ${sans}`
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(handle, textX, handleY)

    // Wave footer band
    drawWaveFooter(ctx, w, h, theme, s)

    // POWERED BY + Introify Option 9 wordmark (no botanicals)
    const logo = await loadLogo()
    const footerMidY = h - Math.round(100 * s)
    const powered = "POWERED BY"
    const poweredSize = Math.round(18 * s)
    ctx.fillStyle = theme.footerText
    ctx.font = `400 ${poweredSize}px ${sans}`
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(4 * s)}px`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const logoH = Math.round(48 * s)
    const gapY = Math.round(8 * s)
    const blockH = poweredSize + gapY + logoH
    const poweredY = footerMidY - blockH / 2 + poweredSize / 2
    ctx.fillText(powered, textX, poweredY)
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"

    if (logo) {
        const aspect = logo.naturalWidth / Math.max(1, logo.naturalHeight)
        const logoW = Math.round(logoH * aspect)
        const logoX = textX - logoW / 2
        const logoY = poweredY + poweredSize / 2 + gapY
        drawLogoOnDarkFooter(ctx, logo, logoX, logoY, logoW, logoH)
    } else {
        // fallback wordmark text
        ctx.fillStyle = theme.footerText
        ctx.font = `600 ${Math.round(28 * s)}px ${sans}`
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText("introify", textX, poweredY + poweredSize / 2 + gapY)
    }

    return canvas
}

function drawLogoOnDarkFooter(
    ctx: CanvasRenderingContext2D,
    logo: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    // Option 9 dark-still is dark-ish ink on transparent; finals need a light wordmark on dark footers.
    // Draw via offscreen, invert+boost if average luminance of opaque pixels is dark.
    const off = document.createElement("canvas")
    off.width = Math.max(1, Math.round(w))
    off.height = Math.max(1, Math.round(h))
    const octx = off.getContext("2d")
    if (!octx) {
        ctx.drawImage(logo, x, y, w, h)
        return
    }
    octx.clearRect(0, 0, off.width, off.height)
    octx.drawImage(logo, 0, 0, off.width, off.height)
    let sum = 0
    let count = 0
    try {
        const data = octx.getImageData(0, 0, off.width, off.height).data
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 40) continue
            sum += (data[i] + data[i + 1] + data[i + 2]) / 3
            count++
        }
    } catch {
        ctx.drawImage(logo, x, y, w, h)
        return
    }
    const avg = count ? sum / count : 255
    if (avg < 160) {
        // invert dark ink → light wordmark for dark footer bands
        octx.globalCompositeOperation = "source-in"
        octx.fillStyle = "#ffffff"
        octx.fillRect(0, 0, off.width, off.height)
        octx.globalCompositeOperation = "source-over"
    }
    ctx.drawImage(off, x, y)
}

function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme) {
    roundRect(ctx, 0, 0, w, h, w * 0.04)
    const bg = ctx.createLinearGradient(0, 0, w * 0.2, h)
    bg.addColorStop(0, theme.bg)
    bg.addColorStop(1, theme.bg2)
    ctx.fillStyle = bg
    ctx.fill()

    if (theme.dark) {
        const g1 = ctx.createRadialGradient(w * 0.2, h * 0.05, 0, w * 0.25, h * 0.1, w * 0.7)
        g1.addColorStop(0, "rgba(0,215,255,0.16)")
        g1.addColorStop(1, "transparent")
        ctx.fillStyle = g1
        ctx.fill()
    }
}

function softGrain(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme) {
    // Lightweight deterministic-ish grain without full getImageData cost on every pixel when huge —
    // still use ImageData for quality matching craft pack.
    const amount = theme.grain
    if (amount <= 0) return
    try {
        const img = ctx.getImageData(0, 0, w, h)
        const d = img.data
        const span = amount * 255
        // stride for speed on large canvases; still looks soft
        const step = theme.dark ? 3 : 2
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const n = (Math.random() - 0.5) * span
                for (let dy = 0; dy < step; dy++) {
                    for (let dx = 0; dx < step; dx++) {
                        const xx = x + dx
                        const yy = y + dy
                        if (xx >= w || yy >= h) continue
                        const i = (yy * w + xx) * 4
                        d[i] = clamp(d[i] + n)
                        d[i + 1] = clamp(d[i + 1] + n)
                        d[i + 2] = clamp(d[i + 2] + n)
                    }
                }
            }
        }
        ctx.putImageData(img, 0, 0)
    } catch {
        // tainted / unavailable — skip grain
    }
}

function drawWaveFooter(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme, s: number) {
    const amp = 78 * s
    const baseH = 188 * s
    ctx.beginPath()
    for (let x = 0; x <= w; x++) {
        const t = x / w
        const y = h - baseH - amp * (0.55 * Math.sin(Math.PI * t) + 0.25 * Math.sin(2 * Math.PI * t))
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    if (theme.footerBand !== theme.footerBand2) {
        const grad = ctx.createLinearGradient(0, h - baseH - amp, 0, h)
        grad.addColorStop(0, theme.footerBand2)
        grad.addColorStop(0.35, theme.footerBand)
        grad.addColorStop(1, theme.footerBand)
        ctx.fillStyle = grad
    } else {
        ctx.fillStyle = theme.footerBand
    }
    ctx.fill()

    // soft cyan glow along wave crest for soft-studio
    if (theme.dark && theme.footerBand2 !== theme.footerBand) {
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.strokeStyle = theme.footerBand2
        ctx.lineWidth = Math.max(2, 3 * s)
        ctx.beginPath()
        for (let x = 0; x <= w; x += 2) {
            const t = x / w
            const y = h - baseH - amp * (0.55 * Math.sin(Math.PI * t) + 0.25 * Math.sin(2 * Math.PI * t))
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
    }
}

function normalizeCta(cta: string) {
    let t = cta.trim()
    if (!t) t = "Scan to chat · book · buy"
    if (!/^scan/i.test(t)) t = `Scan ${t}`
    t = t.replace(/\s*[·•|]\s*/g, " · ")
    return t.toUpperCase()
}

function fitScriptTitle(
    ctx: CanvasRenderingContext2D,
    text: string,
    script: string,
    sans: string,
    max: number,
    w: number,
) {
    const s = w / 1080
    for (const px of [96, 88, 80, 72, 64, 56, 48, 42].map((v) => Math.round(v * s))) {
        const font = `italic 400 ${px}px ${script}`
        ctx.font = font
        if (ctx.measureText(text).width <= max) return { font, text }
    }
    for (const px of [68, 60, 52, 46, 40, 34].map((v) => Math.round(v * s))) {
        const font = `italic 600 ${px}px Georgia, "Times New Roman", serif`
        ctx.font = font
        if (ctx.measureText(text).width <= max) return { font, text }
    }
    for (const px of [48, 42, 36, 32, 28].map((v) => Math.round(v * s))) {
        const font = `600 ${px}px ${sans}`
        ctx.font = font
        if (ctx.measureText(text).width <= max) return { font, text }
    }
    const font = `600 ${Math.round(28 * s)}px ${sans}`
    ctx.font = font
    let cut = text
    while (cut.length > 4 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
    return { font, text: cut === text ? text : `${cut}…` }
}

function drawTrackedCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
    const total = measureTracked(ctx, text, tracking)
    let x = cx - total / 2
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    for (const ch of text) {
        ctx.fillText(ch, x, y)
        const cw = ch === " " ? Math.max(8, ctx.measureText("H").width / 3) : ctx.measureText(ch).width
        x += cw + tracking
    }
    ctx.textAlign = "center"
}

function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
    let total = 0
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        total += ch === " " ? Math.max(8, ctx.measureText("H").width / 3) : ctx.measureText(ch).width
        if (i < text.length - 1) total += tracking
    }
    return total
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
