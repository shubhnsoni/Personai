export type ArShape = "plate" | "stand" | "card"

function pad4(n: number) {
    return (4 - (n % 4)) % 4
}

function concat(parts: Uint8Array[]) {
    const len = parts.reduce((s, p) => s + p.length, 0)
    const out = new Uint8Array(len)
    let o = 0
    for (const p of parts) {
        out.set(p, o)
        o += p.length
    }
    return out
}

function f32(arr: number[]) {
    return new Uint8Array(new Float32Array(arr).buffer)
}

function u16(arr: number[]) {
    return new Uint8Array(new Uint16Array(arr).buffer)
}

async function imageToCanvas(src: string, size = 512) {
    const img = await loadImage(src)
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No canvas")
    return { canvas, ctx, img, size }
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("Could not read photo"))
        img.src = src
    })
}

function paintTexture(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number, shape: ArShape) {
    const mid = size / 2
    ctx.fillStyle = shape === "stand" ? "#1c1917" : "#efe6d6"
    ctx.fillRect(0, 0, size, size)

    ctx.save()
    ctx.beginPath()
    if (shape === "card") {
        const m = size * 0.08
        if (typeof ctx.roundRect === "function") ctx.roundRect(m, m, size - m * 2, size - m * 2, size * 0.04)
        else ctx.rect(m, m, size - m * 2, size - m * 2)
    } else {
        ctx.arc(mid, mid, size * (shape === "plate" ? 0.46 : 0.42), 0, Math.PI * 2)
    }
    ctx.clip()
    const scale = Math.max(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    ctx.restore()

    if (shape === "plate") {
        const g = ctx.createRadialGradient(mid, mid, size * 0.4, mid, mid, size * 0.5)
        g.addColorStop(0, "rgba(239,230,214,0)")
        g.addColorStop(0.55, "rgba(239,230,214,0.15)")
        g.addColorStop(1, "rgba(196,178,148,1)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(mid, mid, size * 0.5, 0, Math.PI * 2)
        ctx.fill()
    }
}

function lathe(shape: ArShape) {
    const segs = 36
    const rings = 18
    const pos: number[] = []
    const nor: number[] = []
    const uv: number[] = []
    const idx: number[] = []

    for (let i = 0; i <= rings; i++) {
        const t = i / rings
        let r = 0
        let y = 0
        if (shape === "plate") {
            if (t < 0.62) {
                const u = t / 0.62
                r = 0.38 * u
                y = 0.11 * Math.cos((u * Math.PI) / 2)
            } else if (t < 0.78) {
                const u = (t - 0.62) / 0.16
                r = 0.38 + 0.08 * u
                y = 0.012
            } else {
                const u = (t - 0.78) / 0.22
                r = 0.46 + 0.09 * u
                y = 0.012 + 0.018 * Math.sin(u * Math.PI)
            }
        } else if (shape === "stand") {
            if (t < 0.18) {
                r = 0.28 * (t / 0.18)
                y = 0
            } else if (t < 0.72) {
                r = 0.22
                y = ((t - 0.18) / 0.54) * 0.42
            } else {
                r = 0.22 + 0.08 * ((t - 0.72) / 0.28)
                y = 0.42
            }
        } else {
            r = t < 0.08 || t > 0.92 ? 0.01 : 0.28
            y = t * 0.48
        }
        for (let j = 0; j <= segs; j++) {
            const a = (j / segs) * Math.PI * 2
            const x = Math.cos(a) * r
            const z = Math.sin(a) * r
            pos.push(x, y, z)
            const ny = shape === "card" ? 0.15 : 0.55
            const len = Math.hypot(x, ny, z) || 1
            nor.push(x / len, ny / len, z / len)
            uv.push(0.5 + x * 0.92, 0.5 + z * 0.92)
        }
    }
    const stride = segs + 1
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
            const a = i * stride + j
            const b = a + 1
            const c = a + stride
            const d = c + 1
            idx.push(a, c, b, b, c, d)
        }
    }
    return { pos, nor, uv, idx }
}

function mins(arr: number[], off: number) {
    let m = Infinity
    for (let i = off; i < arr.length; i += 3) m = Math.min(m, arr[i])
    return m
}
function maxs(arr: number[], off: number) {
    let m = -Infinity
    for (let i = off; i < arr.length; i += 3) m = Math.max(m, arr[i])
    return m
}

function canvasPng(canvas: HTMLCanvasElement) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) reject(new Error("Could not encode texture"))
            else void blob.arrayBuffer().then(resolve)
        }, "image/png")
    })
}

function packTexturedGlb(mesh: { pos: number[]; nor: number[]; uv: number[]; idx: number[] }, png: ArrayBuffer) {
    const posB = f32(mesh.pos)
    const norB = f32(mesh.nor)
    const uvB = f32(mesh.uv)
    const idxB = u16(mesh.idx)
    const pngB = new Uint8Array(png)
    const align = (n: number) => n + pad4(n)
    let cursor = 0
    const views = [posB, norB, uvB, idxB, pngB].map((buf) => {
        const start = cursor
        cursor = align(cursor + buf.length)
        return { buf, start, length: buf.length }
    })
    const bin = new Uint8Array(cursor)
    for (const v of views) bin.set(v.buf, v.start)
    const json = {
        asset: { version: "2.0", generator: "PersonaLink AR" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: "Capture" }],
        meshes: [{
            primitives: [{
                attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
                indices: 3,
                material: 0,
            }],
        }],
        materials: [{
            name: "PhotoSkin",
            pbrMetallicRoughness: {
                baseColorTexture: { index: 0 },
                metallicFactor: 0.02,
                roughnessFactor: 0.78,
            },
            doubleSided: true,
        }],
        textures: [{ source: 0 }],
        images: [{ bufferView: 4, mimeType: "image/png" }],
        accessors: [
            {
                bufferView: 0, componentType: 5126, count: mesh.pos.length / 3, type: "VEC3",
                min: [mins(mesh.pos, 0), mins(mesh.pos, 1), mins(mesh.pos, 2)],
                max: [maxs(mesh.pos, 0), maxs(mesh.pos, 1), maxs(mesh.pos, 2)],
            },
            { bufferView: 1, componentType: 5126, count: mesh.nor.length / 3, type: "VEC3" },
            { bufferView: 2, componentType: 5126, count: mesh.uv.length / 2, type: "VEC2" },
            { bufferView: 3, componentType: 5123, count: mesh.idx.length, type: "SCALAR" },
        ],
        bufferViews: views.map((v, i) => ({
            buffer: 0,
            byteOffset: v.start,
            byteLength: v.length,
            target: i === 3 ? 34963 : i < 3 ? 34962 : undefined,
        })),
        buffers: [{ byteLength: bin.length }],
    }
    const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
    const jsonPad = pad4(jsonBytes.length)
    const binPad = pad4(bin.length)
    const jsonChunk = jsonBytes.length + jsonPad
    const binChunk = bin.length + binPad
    const total = 12 + 8 + jsonChunk + 8 + binChunk
    const out = new ArrayBuffer(total)
    const view = new DataView(out)
    const u8 = new Uint8Array(out)
    view.setUint32(0, 0x46546c67, true)
    view.setUint32(4, 2, true)
    view.setUint32(8, total, true)
    view.setUint32(12, jsonChunk, true)
    view.setUint32(16, 0x4e4f534a, true)
    u8.set(jsonBytes, 20)
    for (let i = 0; i < jsonPad; i++) u8[20 + jsonBytes.length + i] = 0x20
    const binHead = 20 + jsonChunk
    view.setUint32(binHead, binChunk, true)
    view.setUint32(binHead + 4, 0x004e4942, true)
    u8.set(bin, binHead + 8)
    return out
}

function heightGrid(ctx: CanvasRenderingContext2D, size: number) {
    const n = 72
    const img = ctx.getImageData(0, 0, size, size).data
    const h: number[][] = []
    const rMax = 0.46
    for (let j = 0; j <= n; j++) {
        const row: number[] = []
        for (let i = 0; i <= n; i++) {
            const u = i / n
            const v = j / n
            const x = u - 0.5
            const z = v - 0.5
            const r = Math.hypot(x, z)
            if (r > rMax) {
                row.push(0)
                continue
            }
            const px = Math.min(size - 1, Math.floor(u * size))
            const py = Math.min(size - 1, Math.floor(v * size))
            const o = (py * size + px) * 4
            const luma = (img[o] * 0.3 + img[o + 1] * 0.59 + img[o + 2] * 0.11) / 255
            const sat = Math.max(img[o], img[o + 1], img[o + 2]) - Math.min(img[o], img[o + 1], img[o + 2])
            const dome = Math.sqrt(Math.max(0, 1 - (r / rMax) * (r / rMax)))
            row.push(dome * (0.028 + (1 - luma) * 0.11 + (sat / 255) * 0.05))
        }
        h.push(row)
    }
    const pos: number[] = []
    const nor: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const vert = (i: number, j: number) => {
        const u = i / n
        const v = j / n
        return [(u - 0.5) * 0.92, h[j][i], (v - 0.5) * 0.92] as [number, number, number]
    }
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const a = vert(i, j)
            const b = vert(i + 1, j)
            const c = vert(i + 1, j + 1)
            const d = vert(i, j + 1)
            if (a[1] === 0 && b[1] === 0 && c[1] === 0 && d[1] === 0) continue
            const base = pos.length / 3
            const push = (p: [number, number, number], uu: number, vv: number) => {
                pos.push(p[0], p[1], p[2])
                uv.push(uu, 1 - vv)
            }
            push(a, i / n, j / n)
            push(b, (i + 1) / n, j / n)
            push(c, (i + 1) / n, (j + 1) / n)
            push(d, i / n, (j + 1) / n)
            const e1x = b[0] - a[0]
            const e1y = b[1] - a[1]
            const e1z = b[2] - a[2]
            const e2x = d[0] - a[0]
            const e2y = d[1] - a[1]
            const e2z = d[2] - a[2]
            let nx = e1y * e2z - e1z * e2y
            let ny = e1z * e2x - e1x * e2z
            let nz = e1x * e2y - e1y * e2x
            const len = Math.hypot(nx, ny, nz) || 1
            nx /= len
            ny /= len
            nz /= len
            for (let k = 0; k < 4; k++) nor.push(nx, ny, nz)
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
        }
    }
    return { pos, nor, uv, idx }
}

export async function photoToGlb(src: string, shape: ArShape = "plate") {
    const { canvas, ctx, img, size } = await imageToCanvas(src, 512)
    paintTexture(ctx, img, size, shape)
    return packTexturedGlb(lathe(shape), await canvasPng(canvas))
}

export async function photoToSculptedGlb(src: string) {
    const { canvas, ctx, img, size } = await imageToCanvas(src, 512)
    const mid = size / 2
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, size, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(mid, mid, size * 0.48, 0, Math.PI * 2)
    ctx.clip()
    const scale = Math.max(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    ctx.restore()
    return packTexturedGlb(heightGrid(ctx, size), await canvasPng(canvas))
}

export function glbToFile(buf: ArrayBuffer, name = "capture.glb") {
    return new File([buf], name, { type: "model/gltf-binary" })
}
