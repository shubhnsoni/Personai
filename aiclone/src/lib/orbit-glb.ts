import { spreadOrbitYaws } from "./orbit-track"

export type OrbitFrame = {
    dataUrl: string
    yaw: number
    pitch?: number
    kind?: "orbit" | "top"
}

const BINS = 16
export const ORBIT_TARGET = BINS
export const ORBIT_MIN = 8

type View = {
    yaw: number
    elev: number
    mask: Uint8Array
    rgb: Uint8ClampedArray
    size: number
    kind: "orbit" | "top"
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("Could not read a frame"))
        img.src = src
    })
}

async function raster(src: string, size: number) {
    const img = await loadImage(src)
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) throw new Error("No canvas")
    const side = Math.min(img.width, img.height)
    const sx = (img.width - side) / 2
    const sy = (img.height - side) / 2
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    return ctx.getImageData(0, 0, size, size)
}

function segment(data: ImageData) {
    const { width: w, height: h, data: px } = data
    const mask = new Uint8Array(w * h)
    const table = [0, 0, 0]
    let tn = 0
    const mid = w / 2
    const ring = w * 0.48
    const ring2 = ring * ring
    const inner2 = (w * 0.22) * (w * 0.22)
    const sample = (x: number, y: number) => {
        const i = (y * w + x) * 4
        table[0] += px[i]
        table[1] += px[i + 1]
        table[2] += px[i + 2]
        tn++
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = x + 0.5 - mid
            const dy = y + 0.5 - mid
            if (dx * dx + dy * dy >= ring2) sample(x, y)
        }
    }
    if (!tn) return mask
    table[0] /= tn
    table[1] /= tn
    table[2] /= tn
    const thresh = 26 * 26
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = x + 0.5 - mid
            const dy = y + 0.5 - mid
            const d2 = dx * dx + dy * dy
            if (d2 > ring2) continue
            if (d2 < inner2) {
                mask[y * w + x] = 1
                continue
            }
            const i = (y * w + x) * 4
            const dr = px[i] - table[0]
            const dg = px[i + 1] - table[1]
            const db = px[i + 2] - table[2]
            if (dr * dr + dg * dg + db * db > thresh) mask[y * w + x] = 1
        }
    }
    closeMask(mask, w, h)
    return mask
}

function closeMask(mask: Uint8Array, w: number, h: number) {
    const tmp = new Uint8Array(mask)
    const pass = (src: Uint8Array, dst: Uint8Array, on: number) => {
        dst.set(src)
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                if (src[y * w + x] === on) continue
                if (
                    src[y * w + x - 1] === on ||
                    src[y * w + x + 1] === on ||
                    src[(y - 1) * w + x] === on ||
                    src[(y + 1) * w + x] === on
                ) dst[y * w + x] = on
            }
        }
    }
    pass(mask, tmp, 1)
    pass(tmp, mask, 1)
    pass(mask, tmp, 0)
    pass(tmp, mask, 0)
}

function lookAt(eye: [number, number, number], target: [number, number, number]) {
    const zx = eye[0] - target[0]
    const zy = eye[1] - target[1]
    const zz = eye[2] - target[2]
    const zl = Math.hypot(zx, zy, zz) || 1
    const z0 = zx / zl
    const z1 = zy / zl
    const z2 = zz / zl
    let x0 = 0 * z2 - 1 * z1
    let x1 = 1 * z0 - 0 * z2
    let x2 = 0 * z1 - 0 * z0
    const xl = Math.hypot(x0, x1, x2) || 1
    x0 /= xl
    x1 /= xl
    x2 /= xl
    const y0 = z1 * x2 - z2 * x1
    const y1 = z2 * x0 - z0 * x2
    const y2 = z0 * x1 - z1 * x0
    return { x: [x0, x1, x2], y: [y0, y1, y2], z: [z0, z1, z2], eye }
}

function project(view: ReturnType<typeof lookAt>, p: [number, number, number], fov = 0.72) {
    const dx = p[0] - view.eye[0]
    const dy = p[1] - view.eye[1]
    const dz = p[2] - view.eye[2]
    const cx = dx * view.x[0] + dy * view.x[1] + dz * view.x[2]
    const cy = dx * view.y[0] + dy * view.y[1] + dz * view.y[2]
    const cz = dx * view.z[0] + dy * view.z[1] + dz * view.z[2]
    if (cz < 0.05) return null
    const u = 0.5 + (cx / (cz * fov)) * 0.5
    const v = 0.5 - (cy / (cz * fov)) * 0.5
    return { u, v, ndot: -cz }
}

function camPose(yaw: number, elev: number): [number, number, number] {
    const d = 1.35
    const e = (elev * Math.PI) / 180
    const t = (yaw * Math.PI) / 180
    return [Math.sin(t) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(t) * Math.cos(e) * d]
}

function carve(views: View[], nx: number, ny: number, nz: number, needRatio: number) {
    const occ = new Uint8Array(nx * ny * nz)
    const poses = views.map((v) => lookAt(camPose(v.yaw, v.elev), [0, 0.07, 0]))
    const rMax = 0.46
    const need = Math.max(2, Math.ceil(views.length * needRatio))
    for (let j = 0; j < ny; j++) {
        const y = ((j + 0.5) / ny) * 0.4
        for (let i = 0; i < nx; i++) {
            const x = (i + 0.5) / nx - 0.5
            for (let k = 0; k < nz; k++) {
                const z = (k + 0.5) / nz - 0.5
                if (x * x + z * z > rMax * rMax) continue
                let votes = 0
                let seen = 0
                for (let vi = 0; vi < views.length; vi++) {
                    const hit = project(poses[vi], [x, y, z])
                    if (!hit || hit.u < 0.02 || hit.u > 0.98 || hit.v < 0.02 || hit.v > 0.98) continue
                    seen++
                    const view = views[vi]
                    const px = Math.min(view.size - 1, Math.max(0, Math.floor(hit.u * view.size)))
                    const py = Math.min(view.size - 1, Math.max(0, Math.floor(hit.v * view.size)))
                    if (view.mask[py * view.size + px]) votes++
                }
                if (seen && votes >= Math.min(need, Math.max(2, Math.ceil(seen * needRatio)))) {
                    occ[i + j * nx + k * nx * ny] = 1
                }
            }
        }
    }
    return occ
}

function fillCore(nx: number, ny: number, nz: number) {
    const occ = new Uint8Array(nx * ny * nz)
    for (let j = 0; j < ny; j++) {
        const y = (j + 0.5) / ny
        const r = 0.3 * (1 - y * 0.35)
        for (let i = 0; i < nx; i++) {
            const x = (i + 0.5) / nx - 0.5
            for (let k = 0; k < nz; k++) {
                const z = (k + 0.5) / nz - 0.5
                if (x * x + z * z <= r * r && y < 0.55) occ[i + j * nx + k * nx * ny] = 1
            }
        }
    }
    return occ
}

function meshify(occ: Uint8Array, nx: number, ny: number, nz: number) {
    const pos: number[] = []
    const faces: number[][] = [
        [0, 1, 0],
        [0, -1, 0],
        [1, 0, 0],
        [-1, 0, 0],
        [0, 0, 1],
        [0, 0, -1],
    ]
    const quads: [number, number, number][][] = [
        [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
        [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]],
        [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]],
        [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]],
        [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]],
        [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]],
    ]
    const at = (i: number, j: number, k: number) => {
        if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return 0
        return occ[i + j * nx + k * nx * ny]
    }
    const toW = (i: number, j: number, k: number): [number, number, number] => [
        i / nx - 0.5,
        (j / ny) * 0.4,
        k / nz - 0.5,
    ]
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            for (let k = 0; k < nz; k++) {
                if (!at(i, j, k)) continue
                for (let f = 0; f < 6; f++) {
                    const [di, dj, dk] = faces[f]
                    if (at(i + di, j + dj, k + dk)) continue
                    const [a, b, c, d] = quads[f]
                    const p = [
                        toW(i + 0.5 + a[0] * 0.5, j + 0.5 + a[1] * 0.5, k + 0.5 + a[2] * 0.5),
                        toW(i + 0.5 + b[0] * 0.5, j + 0.5 + b[1] * 0.5, k + 0.5 + b[2] * 0.5),
                        toW(i + 0.5 + c[0] * 0.5, j + 0.5 + c[1] * 0.5, k + 0.5 + c[2] * 0.5),
                        toW(i + 0.5 + d[0] * 0.5, j + 0.5 + d[1] * 0.5, k + 0.5 + d[2] * 0.5),
                    ]
                    pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3])
                }
            }
        }
    }
    return pos
}

function weldAndSmooth(pos: number[]) {
    const key = (x: number, y: number, z: number) => `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`
    const map = new Map<string, number>()
    const verts: number[] = []
    const idx: number[] = []
    for (let i = 0; i < pos.length; i += 3) {
        const k = key(pos[i], pos[i + 1], pos[i + 2])
        let id = map.get(k)
        if (id === undefined) {
            id = verts.length / 3
            map.set(k, id)
            verts.push(pos[i], pos[i + 1], pos[i + 2])
        }
        idx.push(id)
    }
    const adj: number[][] = Array.from({ length: verts.length / 3 }, () => [])
    const link = (a: number, b: number) => {
        if (!adj[a].includes(b)) adj[a].push(b)
        if (!adj[b].includes(a)) adj[b].push(a)
    }
    for (let i = 0; i < idx.length; i += 3) {
        link(idx[i], idx[i + 1])
        link(idx[i + 1], idx[i + 2])
        link(idx[i + 2], idx[i])
    }
    const next = verts.slice()
    for (let pass = 0; pass < 6; pass++) {
        for (let v = 0; v < verts.length / 3; v++) {
            const y = verts[v * 3 + 1]
            if (y < 0.018) continue
            const nbs = adj[v]
            if (!nbs.length) continue
            let x = 0
            let yy = 0
            let z = 0
            for (const n of nbs) {
                x += verts[n * 3]
                yy += verts[n * 3 + 1]
                z += verts[n * 3 + 2]
            }
            const s = nbs.length
            next[v * 3] = verts[v * 3] * 0.45 + (x / s) * 0.55
            next[v * 3 + 1] = verts[v * 3 + 1] * 0.45 + (yy / s) * 0.55
            next[v * 3 + 2] = verts[v * 3 + 2] * 0.45 + (z / s) * 0.55
        }
        for (let i = 0; i < verts.length; i++) verts[i] = next[i]
    }
    let minY = Infinity
    for (let i = 1; i < verts.length; i += 3) minY = Math.min(minY, verts[i])
    for (let i = 1; i < verts.length; i += 3) verts[i] -= minY
    const nor = new Array(verts.length).fill(0)
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3
        const b = idx[i + 1] * 3
        const c = idx[i + 2] * 3
        const ax = verts[b] - verts[a]
        const ay = verts[b + 1] - verts[a + 1]
        const az = verts[b + 2] - verts[a + 2]
        const bx = verts[c] - verts[a]
        const by = verts[c + 1] - verts[a + 1]
        const bz = verts[c + 2] - verts[a + 2]
        const nx = ay * bz - az * by
        const ny = az * bx - ax * bz
        const nz = ax * by - ay * bx
        nor[a] += nx
        nor[a + 1] += ny
        nor[a + 2] += nz
        nor[b] += nx
        nor[b + 1] += ny
        nor[b + 2] += nz
        nor[c] += nx
        nor[c + 1] += ny
        nor[c + 2] += nz
    }
    for (let i = 0; i < nor.length; i += 3) {
        const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1
        nor[i] /= l
        nor[i + 1] /= l
        nor[i + 2] /= l
    }
    return { verts, nor, idx }
}

function paint(verts: number[], nor: number[], views: View[]) {
    const col = new Array(verts.length).fill(0)
    const poses = views.map((v) => lookAt(camPose(v.yaw, v.elev), [0, 0.07, 0]))
    for (let v = 0; v < verts.length / 3; v++) {
        const p: [number, number, number] = [verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]]
        const n: [number, number, number] = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]]
        let best = -1
        let r = 180
        let g = 150
        let b = 110
        for (let i = 0; i < views.length; i++) {
            const hit = project(poses[i], p)
            if (!hit) continue
            if (hit.u < 0 || hit.u > 1 || hit.v < 0 || hit.v > 1) continue
            const view = views[i]
            const px = Math.min(view.size - 1, Math.max(0, Math.floor(hit.u * view.size)))
            const py = Math.min(view.size - 1, Math.max(0, Math.floor(hit.v * view.size)))
            if (!view.mask[py * view.size + px] && view.kind !== "top") continue
            const eye = poses[i].eye
            const vx = eye[0] - p[0]
            const vy = eye[1] - p[1]
            const vz = eye[2] - p[2]
            const vl = Math.hypot(vx, vy, vz) || 1
            const ndot = (n[0] * vx + n[1] * vy + n[2] * vz) / vl
            const score = ndot + (view.kind === "top" ? 0.15 : 0)
            if (score < best) continue
            best = score
            const o = (py * view.size + px) * 4
            r = view.rgb[o]
            g = view.rgb[o + 1]
            b = view.rgb[o + 2]
        }
        col[v * 3] = r / 255
        col[v * 3 + 1] = g / 255
        col[v * 3 + 2] = b / 255
    }
    return col
}

function pad4(n: number) {
    return (4 - (n % 4)) % 4
}

function f32(arr: number[]) {
    return new Uint8Array(new Float32Array(arr).buffer)
}

function u16(arr: number[]) {
    return new Uint8Array(new Uint16Array(arr).buffer)
}

function writeGlb(verts: number[], nor: number[], col: number[], idx: number[]) {
    const posB = f32(verts)
    const norB = f32(nor)
    const colB = f32(col)
    const idxB = u16(idx)
    const buffers = [posB, norB, colB, idxB]
    const align = (n: number) => n + pad4(n)
    let cursor = 0
    const views = buffers.map((buf) => {
        const start = cursor
        cursor = align(cursor + buf.length)
        return { buf, start, length: buf.length }
    })
    const bin = new Uint8Array(cursor)
    for (const v of views) bin.set(v.buf, v.start)
    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    for (let i = 0; i < verts.length; i += 3) {
        minX = Math.min(minX, verts[i])
        maxX = Math.max(maxX, verts[i])
        minY = Math.min(minY, verts[i + 1])
        maxY = Math.max(maxY, verts[i + 1])
        minZ = Math.min(minZ, verts[i + 2])
        maxZ = Math.max(maxZ, verts[i + 2])
    }
    const json = {
        asset: { version: "2.0", generator: "PersonaLink orbit" },
        extensionsUsed: ["KHR_materials_unlit"],
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: "Dish" }],
        meshes: [{
            primitives: [{
                attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
                indices: 3,
                material: 0,
            }],
        }],
        materials: [{
            name: "DishSkin",
            pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] },
            extensions: { KHR_materials_unlit: {} },
            doubleSided: true,
        }],
        accessors: [
            { bufferView: 0, componentType: 5126, count: verts.length / 3, type: "VEC3", min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
            { bufferView: 1, componentType: 5126, count: nor.length / 3, type: "VEC3" },
            { bufferView: 2, componentType: 5126, count: col.length / 3, type: "VEC3" },
            { bufferView: 3, componentType: 5123, count: idx.length, type: "SCALAR" },
        ],
        bufferViews: views.map((v, i) => ({
            buffer: 0,
            byteOffset: v.start,
            byteLength: v.length,
            target: i === 3 ? 34963 : 34962,
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

export function yawBin(yaw: number, origin: number) {
    const d = ((yaw - origin) % 360 + 360) % 360
    return Math.round(d / (360 / BINS)) % BINS
}

function countOcc(occ: Uint8Array) {
    let n = 0
    for (let i = 0; i < occ.length; i++) n += occ[i]
    return n
}

export async function orbitToGlb(frames: OrbitFrame[], onStatus?: (msg: string) => void) {
    if (frames.length < ORBIT_MIN) throw new Error(`A few more angles — need at least ${ORBIT_MIN}`)
    const ordered = spreadOrbitYaws(frames)
    onStatus?.("Reading the scan")
    const views: View[] = []
    for (const frame of ordered) {
        const img = await raster(frame.dataUrl, 256)
        const mask = segment(img)
        let fg = 0
        for (let i = 0; i < mask.length; i++) fg += mask[i]
        if (fg < mask.length * 0.02) {
            for (let i = 0; i < mask.length; i++) {
                const x = i % 256
                const y = Math.floor(i / 256)
                const dx = x - 128
                const dy = y - 128
                mask[i] = dx * dx + dy * dy < 100 * 100 ? 1 : 0
            }
        }
        views.push({
            yaw: frame.yaw,
            elev: frame.kind === "top" ? 78 : Math.min(62, Math.max(28, frame.pitch ?? 38)),
            mask,
            rgb: img.data,
            size: 256,
            kind: frame.kind || "orbit",
        })
    }
    onStatus?.("Carving the volume")
    await new Promise((r) => setTimeout(r, 20))
    let occ = carve(views, 48, 28, 48, 0.4)
    if (countOcc(occ) < 80) occ = carve(views, 48, 28, 48, 0.28)
    if (countOcc(occ) < 80) occ = fillCore(48, 28, 48)
    onStatus?.("Smoothing the dish")
    let raw = meshify(occ, 48, 28, 48)
    if (raw.length < 90) {
        occ = fillCore(48, 28, 48)
        raw = meshify(occ, 48, 28, 48)
    }
    const { verts, nor, idx } = weldAndSmooth(raw)
    onStatus?.("Painting from the photos")
    const col = paint(verts, nor, views)
    return writeGlb(verts, nor, col, idx)
}
