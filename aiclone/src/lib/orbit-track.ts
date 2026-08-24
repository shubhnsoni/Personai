const BINS = 128
const RINGS = 20

export function wrapDeg(d: number) {
    return ((d % 360) + 360) % 360
}

export function signedDeg(d: number) {
    const w = wrapDeg(d)
    return w > 180 ? w - 360 : w
}

export function unwrapDeg(raw: number, prev: number) {
    const base = wrapDeg(raw)
    let best = base
    let dist = Math.abs(signedDeg(base - prev))
    for (const k of [-360, 360]) {
        const c = base + k
        const d = Math.abs(c - prev)
        if (d < dist) {
            dist = d
            best = c
        }
    }
    return best
}

export function polarRing(data: ImageData) {
    const w = data.width
    const px = data.data
    const mid = w / 2
    const r0 = mid * 0.18
    const r1 = mid * 0.46
    const out = new Float32Array(BINS)
    for (let b = 0; b < BINS; b++) {
        const a = (b / BINS) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        let sum = 0
        let n = 0
        for (let k = 0; k < RINGS; k++) {
            const r = r0 + (k / (RINGS - 1)) * (r1 - r0)
            const x = (mid + c * r) | 0
            const y = (mid + s * r) | 0
            if (x < 0 || y < 0 || x >= w || y >= w) continue
            const i = (y * w + x) * 4
            sum += px[i] * 0.28 + px[i + 1] * 0.54 + px[i + 2] * 0.18
            n++
        }
        out[b] = n ? sum / n : 0
    }
    let m = 0
    for (let i = 0; i < BINS; i++) m += out[i]
    m /= BINS
    let varsum = 0
    for (let i = 0; i < BINS; i++) {
        out[i] -= m
        varsum += out[i] * out[i]
    }
    return { ring: out, energy: varsum / BINS }
}

export function polarShift(ref: Float32Array, cur: Float32Array) {
    const n = ref.length
    let best = -Infinity
    let bestS = 0
    for (let s = 0; s < n; s++) {
        let dot = 0
        for (let i = 0; i < n; i++) dot += ref[i] * cur[(i + s) % n]
        if (dot > best) {
            best = dot
            bestS = s
        }
    }
    let e = 0
    for (let i = 0; i < n; i++) e += ref[i] * ref[i]
    const score = e > 8 ? best / e : 0
    return { deg: (bestS / n) * 360, score }
}

export function cropVideo(video: HTMLVideoElement, size = 128, canvas?: HTMLCanvasElement | null) {
    const c = canvas || document.createElement("canvas")
    if (c.width !== size) c.width = size
    if (c.height !== size) c.height = size
    const ctx = c.getContext("2d", { willReadFrequently: true })
    if (!ctx || !video.videoWidth) return null
    const side = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - side) / 2
    const sy = (video.videoHeight - side) / 2
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size)
    return ctx.getImageData(0, 0, size, size)
}

export function spreadOrbitYaws<T extends { yaw: number; kind?: string }>(frames: T[]) {
    const orbit = frames.filter((f) => f.kind !== "top")
    if (orbit.length < 3) return frames
    const ys = orbit.map((f) => wrapDeg(f.yaw))
    let min = 360
    let max = 0
    for (const y of ys) {
        min = Math.min(min, y)
        max = Math.max(max, y)
    }
    let span = max - min
    if (span > 180) {
        const shifted = ys.map((y) => (y < 180 ? y + 360 : y))
        span = Math.max(...shifted) - Math.min(...shifted)
    }
    if (span >= 55) return frames
    return frames.map((f) => {
        if (f.kind === "top") return f
        const idx = orbit.indexOf(f)
        return { ...f, yaw: (idx / orbit.length) * 360 }
    })
}
