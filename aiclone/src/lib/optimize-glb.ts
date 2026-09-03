import { NodeIO, type Document, type Texture } from "@gltf-transform/core"
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions"
import { dequantize, dedup, flatten, join, prune, quantize, reorder, simplify, weld } from "@gltf-transform/functions"
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer"
import jpeg from "jpeg-js"
import { PNG } from "pngjs"
import { strToU8 } from "three/examples/jsm/libs/fflate.module.js"
import { DEFAULT_AR_SIZE } from "@/lib/ar-scale"

export type GlbProfile = "web" | "ar"

const COLOR_PX = 512
const MAP_PX = 256
const COLOR_QUALITY = 70
const MAP_QUALITY = 62
const SIMPLIFY_RATIO = 0.16
const SIMPLIFY_ERROR = 0.006
const TRI_SOFT_CAP = 22_000

let ready = false

async function io() {
    if (!ready) {
        await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready])
        ready = true
    }
    return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            "meshopt.decoder": MeshoptDecoder,
            "meshopt.encoder": MeshoptEncoder,
        })
}

function triangleCount(doc: Document) {
    let tris = 0
    for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const indices = prim.getIndices()
            tris += indices ? Math.floor(indices.getCount() / 3) : Math.floor((prim.getAttribute("POSITION")?.getCount() || 0) / 3)
        }
    }
    return tris
}

function bilinear(src: Uint8Array, sw: number, sh: number, dw: number, dh: number) {
    const out = new Uint8Array(dw * dh * 4)
    for (let y = 0; y < dh; y++) {
        const fy = ((y + 0.5) * sh) / dh - 0.5
        const y0 = Math.max(0, Math.min(sh - 1, Math.floor(fy)))
        const y1 = Math.max(0, Math.min(sh - 1, y0 + 1))
        const ty = fy - y0
        for (let x = 0; x < dw; x++) {
            const fx = ((x + 0.5) * sw) / dw - 0.5
            const x0 = Math.max(0, Math.min(sw - 1, Math.floor(fx)))
            const x1 = Math.max(0, Math.min(sw - 1, x0 + 1))
            const tx = fx - x0
            const o = (y * dw + x) * 4
            for (let c = 0; c < 4; c++) {
                const a = src[(y0 * sw + x0) * 4 + c]
                const b = src[(y0 * sw + x1) * 4 + c]
                const d = src[(y1 * sw + x0) * 4 + c]
                const e = src[(y1 * sw + x1) * 4 + c]
                out[o + c] = Math.round(a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + d * (1 - tx) * ty + e * tx * ty)
            }
        }
    }
    return out
}

function decodeImage(bytes: Uint8Array, mime: string) {
    if (mime.includes("png")) {
        const png = PNG.sync.read(Buffer.from(bytes))
        return { width: png.width, height: png.height, data: new Uint8Array(png.data) }
    }
    const jpg = jpeg.decode(Buffer.from(bytes), { useTArray: true })
    return { width: jpg.width, height: jpg.height, data: new Uint8Array(jpg.data) }
}

function hasAlpha(data: Uint8Array) {
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true
    return false
}

function textureSlots(doc: Document, texture: Texture) {
    const slots: string[] = []
    const label = `${texture.getName()} ${texture.getURI()}`.toLowerCase()
    if (/normal/.test(label)) slots.push("normalTexture")
    if (/metallic|roughness|occlusion/.test(label)) slots.push("metallicRoughnessTexture")
    for (const mat of doc.getRoot().listMaterials()) {
        if (mat.getBaseColorTexture() === texture) slots.push("baseColorTexture")
        if (mat.getNormalTexture() === texture) slots.push("normalTexture")
        if (mat.getMetallicRoughnessTexture() === texture) slots.push("metallicRoughnessTexture")
        if (mat.getOcclusionTexture() === texture) slots.push("occlusionTexture")
        if (mat.getEmissiveTexture() === texture) slots.push("emissiveTexture")
    }
    return slots
}

function slotMaxPx(slots: string[]) {
    if (slots.some((s) => /normal|metallic|roughness|occlusion|specular|emissive/i.test(s))) return MAP_PX
    return COLOR_PX
}

function slotQuality(slots: string[]) {
    if (slots.some((s) => /normal|metallic|roughness|occlusion/i.test(s))) return MAP_QUALITY
    return COLOR_QUALITY
}

function resizeTexture(doc: Document, texture: Texture) {
    const bytes = texture.getImage()
    const mime = texture.getMimeType() || "image/jpeg"
    if (!bytes || bytes.byteLength < 32) return
    const slots = textureSlots(doc, texture)
    const maxPx = slotMaxPx(slots)
    let decoded: { width: number; height: number; data: Uint8Array }
    try {
        decoded = decodeImage(bytes, mime)
    } catch {
        return
    }
    const scale = Math.min(1, maxPx / Math.max(decoded.width, decoded.height))
    const dw = Math.max(1, Math.round(decoded.width * scale))
    const dh = Math.max(1, Math.round(decoded.height * scale))
    const rgba = scale < 0.999 ? bilinear(decoded.data, decoded.width, decoded.height, dw, dh) : decoded.data
    const keepPng = mime.includes("png") && hasAlpha(rgba)
    if (keepPng) {
        const png = new PNG({ width: dw, height: dh })
        png.data = Buffer.from(rgba)
        texture.setImage(new Uint8Array(PNG.sync.write(png, { deflateLevel: 9 })))
        texture.setMimeType("image/png")
        return
    }
    const encoded = jpeg.encode({ data: Buffer.from(rgba), width: dw, height: dh }, slotQuality(slots))
    texture.setImage(new Uint8Array(encoded.data))
    texture.setMimeType("image/jpeg")
}

function stripArUnsafeExtensions(doc: Document) {
    for (const ext of [...doc.getRoot().listExtensionsUsed()]) {
        const name = ext.extensionName
        if (name === "EXT_meshopt_compression" || name === "KHR_mesh_quantization") ext.dispose()
    }
}

async function transformDoc(doc: Document, profile: GlbProfile, sizeMeters?: number) {
    // Scene Viewer rejects required KHR_mesh_quantization ("object can't be loaded").
    await doc.transform(dequantize())
    stripArUnsafeExtensions(doc)
    const tris = triangleCount(doc)
    await doc.transform(dedup(), flatten(), join())
    if (tris > TRI_SOFT_CAP) {
        await doc.transform(
            weld({ overwrite: true }),
            simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY_RATIO, error: SIMPLIFY_ERROR }),
        )
    } else {
        await doc.transform(weld({ overwrite: true }))
    }
    for (const texture of doc.getRoot().listTextures()) resizeTexture(doc, texture)
    await doc.transform(prune({ keepAttributes: false }))
    if (profile === "web") {
        await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize())
        doc.createExtension(EXTMeshoptCompression).setRequired(true)
    } else {
        stripArUnsafeExtensions(doc)
        if (sizeMeters && sizeMeters > 0) {
            const mesh = doc.getRoot().listMeshes()[0]
            const prim = mesh?.listPrimitives()[0]
            const pos = prim?.getAttribute("POSITION")
            if (pos) {
                const arr = floats(pos)
                if (arr.length) {
                    scaleAndSeat(arr, sizeMeters)
                    pos.setArray(arr)
                }
            }
        }
    }
    const root = doc.getRoot()
    const asset = root.getAsset()
    asset.generator = "PersonaLink"
    delete (asset as { extras?: unknown }).extras
}

export async function optimizeGlb(input: Buffer, profile: GlbProfile = "web", sizeMeters?: number): Promise<Buffer> {
    const fileIO = await io()
    const doc = await fileIO.readBinary(new Uint8Array(input))
    await transformDoc(doc, profile, sizeMeters)
    const out = Buffer.from(await fileIO.writeBinary(doc))
    if (profile === "ar") return out
    return out.length < input.length ? out : input
}

export async function optimizeGlbFile(src: string, dest: string, profile: GlbProfile = "web") {
    const { readFile, writeFile } = await import("fs/promises")
    const input = await readFile(src)
    const out = await optimizeGlb(input, profile)
    if (out.length >= input.length * 0.97 && out.length >= input.length - 2048) {
        if (src !== dest) await writeFile(dest, input)
        return input.length
    }
    await writeFile(dest, out)
    return out.length
}

function fmt(n: number) {
    return n.toFixed(5)
}

function scaleAndSeat(positions: Float32Array, sizeMeters: number) {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i])
        minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1])
        minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2])
    }
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1
    const s = sizeMeters / extent
    const midX = (minX + maxX) / 2
    const midZ = (minZ + maxZ) / 2
    for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (positions[i] - midX) * s
        positions[i + 1] = (positions[i + 1] - minY) * s
        positions[i + 2] = (positions[i + 2] - midZ) * s
    }
}

function floats(accessor: { getArray(): ArrayLike<number> | null; getCount(): number; getElementSize(): number }) {
    const raw = accessor.getArray()
    if (!raw) return new Float32Array(0)
    const out = new Float32Array(accessor.getCount() * accessor.getElementSize())
    out.set(raw as ArrayLike<number>)
    return out
}

export async function glbToUsdz(input: Buffer, sizeMeters = DEFAULT_AR_SIZE): Promise<Buffer> {
    const fileIO = await io()
    const doc = await fileIO.readBinary(new Uint8Array(input))
    await doc.transform(dequantize())
    const mesh = doc.getRoot().listMeshes()[0]
    const prim = mesh?.listPrimitives()[0]
    const posAcc = prim?.getAttribute("POSITION")
    if (!prim || !posAcc) throw new Error("no_mesh")
    const positions = floats(posAcc)
    scaleAndSeat(positions, sizeMeters)
    const nrmAcc = prim.getAttribute("NORMAL")
    const uvAcc = prim.getAttribute("TEXCOORD_0")
    const idxAcc = prim.getIndices()
    const vcount = posAcc.getCount()
    const indices = idxAcc ? Array.from(idxAcc.getArray() as ArrayLike<number>) : Array.from({ length: vcount }, (_, i) => i)
    const faceCount = Math.floor(indices.length / 3)

    const pts: string[] = []
    const nrms: string[] = []
    const uvs: string[] = []
    const nrm = nrmAcc ? floats(nrmAcc) : null
    const uv = uvAcc ? floats(uvAcc) : null
    for (let i = 0; i < vcount; i++) {
        pts.push(`(${fmt(positions[i * 3])}, ${fmt(positions[i * 3 + 1])}, ${fmt(positions[i * 3 + 2])})`)
        if (nrm) nrms.push(`(${fmt(nrm[i * 3])}, ${fmt(nrm[i * 3 + 1])}, ${fmt(nrm[i * 3 + 2])})`)
        if (uv) uvs.push(`(${fmt(uv[i * 2])}, ${fmt(1 - uv[i * 2 + 1])})`)
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i])
        minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1])
        minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2])
    }

    const mat = prim.getMaterial()
    const baseTex = mat?.getBaseColorTexture()
    const zipEntries: Array<[string, Uint8Array]> = []
    let textureDecl = ""
    if (baseTex?.getImage()) {
        const img = baseTex.getImage()!
        const mime = baseTex.getMimeType() || "image/jpeg"
        const decoded = decodeImage(img, mime)
        const jpegBytes = Buffer.from(jpeg.encode({
            data: Buffer.from(decoded.data),
            width: decoded.width,
            height: decoded.height,
        }, COLOR_QUALITY).data)
        zipEntries.push(["0/0.jpg", new Uint8Array(jpegBytes)])
        textureDecl = `
			def Shader "uvReader_st"
			{
				uniform token info:id = "UsdPrimvarReader_float2"
				float2 inputs:fallback = (0, 0)
				token inputs:varname = "st"
				float2 outputs:result
			}
			def Shader "color_map"
			{
				uniform token info:id = "UsdUVTexture"
				asset inputs:file = @0/0.jpg@
				float2 inputs:st.connect = </Materials/Material/uvReader_st.outputs:result>
				token inputs:sourceColorSpace = "sRGB"
				token inputs:wrapS = "repeat"
				token inputs:wrapT = "repeat"
				float4 outputs:rgba
				float3 outputs:rgb
			}
			def Shader "PreviewSurface"
			{
				uniform token info:id = "UsdPreviewSurface"
				color3f inputs:diffuseColor.connect = </Materials/Material/color_map.outputs:rgb>
				float inputs:roughness = 0.55
				float inputs:metallic = 0
				int inputs:useSpecularWorkflow = 0
				token outputs:surface
			}
`
    } else {
        textureDecl = `
			def Shader "PreviewSurface"
			{
				uniform token info:id = "UsdPreviewSurface"
				color3f inputs:diffuseColor = (0.82, 0.82, 0.8)
				float inputs:roughness = 0.55
				float inputs:metallic = 0
				int inputs:useSpecularWorkflow = 0
				token outputs:surface
			}
`
    }

    const model = `#usda 1.0
(
    customLayerData = {
        string creator = "PersonaLink"
    }
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Root"
{
    def Scope "Scenes" (
        kind = "sceneLibrary"
    )
    {
        def Xform "Scene" (
            sceneName = "Scene"
        )
        {
            token preliminary:anchoring:type = "plane"
            token preliminary:planeAnchoring:alignment = "horizontal"
            def Xform "Object" (
                prepend apiSchemas = ["MaterialBindingAPI"]
            )
            {
                rel material:binding = </Materials/Material>
                def Mesh "Mesh"
                {
                    float3[] extent = [(${fmt(minX)}, ${fmt(minY)}, ${fmt(minZ)}), (${fmt(maxX)}, ${fmt(maxY)}, ${fmt(maxZ)})]
                    int[] faceVertexCounts = [${Array(faceCount).fill(3).join(", ")}]
                    int[] faceVertexIndices = [${indices.join(", ")}]
                    ${nrm ? `normal3f[] normals = [${nrms.join(", ")}] (\n                        interpolation = "vertex"\n                    )` : ""}
                    point3f[] points = [${pts.join(", ")}]
                    ${uv ? `texCoord2f[] primvars:st = [${uvs.join(", ")}] (\n                        interpolation = "vertex"\n                    )` : ""}
                    uniform token subdivisionScheme = "none"
                }
            }
        }
    }
}

def "Materials"
{
    def Material "Material"
    {
${textureDecl}
        token outputs:surface.connect = </Materials/Material/PreviewSurface.outputs:surface>
    }
}
`
    zipEntries.unshift(["model.usda", strToU8(model)])
    return packUsdz(zipEntries)
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[n] = c >>> 0
    }
    return table
})()

function crc32(buf: Uint8Array) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

function u16(n: number) {
    const b = Buffer.alloc(2)
    b.writeUInt16LE(n)
    return b
}

function u32(n: number) {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(n)
    return b
}

function packUsdz(entries: Array<[string, Uint8Array]>) {
    const locals: Buffer[] = []
    const centrals: Buffer[] = []
    let offset = 0
    for (const [name, data] of entries) {
        const nameBuf = Buffer.from(name, "utf8")
        const crc = crc32(data)
        const size = data.byteLength
        const headerWithoutExtra = 30 + nameBuf.length
        const extraLen = (64 - ((offset + headerWithoutExtra) % 64)) % 64
        const extra = Buffer.alloc(extraLen)
        const local = Buffer.concat([
            u32(0x04034b50),
            u16(20),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(crc),
            u32(size),
            u32(size),
            u16(nameBuf.length),
            u16(extraLen),
            nameBuf,
            extra,
            Buffer.from(data.buffer, data.byteOffset, data.byteLength),
        ])
        const central = Buffer.concat([
            u32(0x02014b50),
            u16(20),
            u16(20),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(crc),
            u32(size),
            u32(size),
            u16(nameBuf.length),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(offset),
            nameBuf,
        ])
        locals.push(local)
        centrals.push(central)
        offset += local.length
    }
    const centralDir = Buffer.concat(centrals)
    const eocd = Buffer.concat([
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(entries.length),
        u16(entries.length),
        u32(centralDir.length),
        u32(offset),
        u16(0),
    ])
    return Buffer.concat([...locals, centralDir, eocd])
}

export async function optimizeModelSet(glb: Buffer, sizeMeters = DEFAULT_AR_SIZE) {
    const web = await optimizeGlb(glb, "web")
    const ar = await optimizeGlb(glb, "ar", sizeMeters)
    let usdz: Buffer | null = null
    try {
        usdz = await glbToUsdz(ar, sizeMeters)
    } catch {
        usdz = null
    }
    return { web, ar, usdz }
}
