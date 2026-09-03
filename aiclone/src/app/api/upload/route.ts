import { createHash, randomUUID } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import { dirname, resolve, sep } from "path"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_MULTIPART_OVERHEAD = 1024 * 1024
const MAX_BODY_SIZE = MAX_FILE_SIZE + MAX_MULTIPART_OVERHEAD
const RATE_WINDOW_MS = 60 * 1000
const MAX_UPLOADS_PER_WINDOW = 20
const RATE_EVENT = "security.upload.rate"
const ARTIFACT_EVENT = "security.upload.artifact"

type AuthorizationResult =
  | Readonly<{ ok: true; profileId: string }>
  | Readonly<{ ok: false; response: Response }>

type PersistedArtifact = Readonly<{ url: string; filename: string }>

export type UploadRouteDependencies = Readonly<{
  authorize(claimedProfileId?: string): Promise<AuthorizationResult>
  consumeUsage(profileId: string, operation: string, max: number, windowMs: number): Promise<boolean>
  persistArtifact(input: Readonly<{
    profileId: string
    filename: string
    bytes: Buffer
    mediaType: string
  }>): Promise<PersistedArtifact>
  generateId(): string
}>

type FileKind = "jpeg" | "png" | "webp" | "gif" | "pdf" | "mp4" | "webm" | "mp3" | "wav" | "glb" | "gltf" | "usdz"

type FileSpec = Readonly<{
  extension: string
  extensions: readonly string[]
  mediaTypes: readonly string[]
}>

const FILE_SPECS: Readonly<Record<FileKind, FileSpec>> = Object.freeze({
  jpeg: { extension: "jpg", extensions: ["jpg", "jpeg"], mediaTypes: ["image/jpeg"] },
  png: { extension: "png", extensions: ["png"], mediaTypes: ["image/png"] },
  webp: { extension: "webp", extensions: ["webp"], mediaTypes: ["image/webp"] },
  gif: { extension: "gif", extensions: ["gif"], mediaTypes: ["image/gif"] },
  pdf: { extension: "pdf", extensions: ["pdf"], mediaTypes: ["application/pdf"] },
  mp4: { extension: "mp4", extensions: ["mp4"], mediaTypes: ["video/mp4"] },
  webm: { extension: "webm", extensions: ["webm"], mediaTypes: ["video/webm"] },
  mp3: { extension: "mp3", extensions: ["mp3"], mediaTypes: ["audio/mpeg"] },
  wav: { extension: "wav", extensions: ["wav"], mediaTypes: ["audio/wav", "audio/x-wav"] },
  glb: { extension: "glb", extensions: ["glb"], mediaTypes: ["model/gltf-binary"] },
  gltf: { extension: "gltf", extensions: ["gltf"], mediaTypes: ["model/gltf+json"] },
  usdz: { extension: "usdz", extensions: ["usdz"], mediaTypes: ["model/vnd.usdz+zip"] },
})

class RequestRejection extends Error {
  constructor(readonly status: 400 | 413 | 415) {
    super("Request rejected")
  }
}

function jsonError(status: number, error = "Request could not be completed"): Response {
  return Response.json({ error }, { status })
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value)
}

function sniffFile(bytes: Buffer): FileKind | null {
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg"
  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png"
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp"
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "gif"
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") return "pdf"
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") return "mp4"
  if (bytes.length >= 4 && startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm"
  if (bytes.length >= 3 && bytes.toString("ascii", 0, 3) === "ID3") return "mp3"
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3"
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") return "wav"
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "glTF" && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length) return "glb"
  if (bytes.length >= 4 && startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "usdz"

  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as { asset?: { version?: unknown } }
    if (parsed && typeof parsed === "object" && parsed.asset?.version === "2.0") return "gltf"
  } catch {
    // Non-JSON content is not glTF JSON.
  }
  return null
}

function originalExtension(name: string): string | null {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/u)
  return match?.[1] ?? null
}

function validateFile(file: File, bytes: Buffer): FileSpec | null {
  if (file.type === "application/octet-stream") return null
  const kind = sniffFile(bytes)
  const extension = originalExtension(file.name)
  if (!kind || !extension) return null
  const spec = FILE_SPECS[kind]
  if (!spec.extensions.includes(extension) || !spec.mediaTypes.includes(file.type.toLowerCase())) return null
  return spec
}

function safeGeneratedFilename(id: string, extension: string): string {
  const safeId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(id)
    ? id.toLowerCase()
    : createHash("sha256").update(id).digest("hex").slice(0, 32)
  return `${safeId}.${extension}`
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = request.headers.get("content-length")
  if (declared !== null) {
    if (!/^\d+$/u.test(declared)) throw new RequestRejection(400)
    if (Number(declared) > maxBytes) throw new RequestRejection(413)
  }
  if (!request.body) throw new RequestRejection(400)

  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new RequestRejection(413)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

async function parseBoundedMultipart(request: Request): Promise<File> {
  const body = await readBoundedBody(request, MAX_BODY_SIZE)
  const boundedRequest = new Request("https://upload.invalid/", {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") ?? "" },
    body: Uint8Array.from(body),
  })
  let formData: FormData
  try {
    formData = await boundedRequest.formData()
  } catch {
    throw new RequestRejection(400)
  }
  const candidate = formData.get("file")
  if (!(candidate instanceof File)) throw new RequestRejection(400)
  if (candidate.size === 0 || candidate.size > MAX_FILE_SIZE) throw new RequestRejection(candidate.size > MAX_FILE_SIZE ? 413 : 400)
  return candidate
}

function ownerDirectory(profileId: string): string {
  return createHash("sha256").update(profileId).digest("hex").slice(0, 32)
}

async function consumeDurableUsage(profileId: string, operation: string, max: number, windowMs: number): Promise<boolean> {
  const { prisma } = await import("../../../lib/prisma")
  const bucketStartMs = Math.floor(Date.now() / windowMs) * windowMs
  const bucket = `${operation}:${bucketStartMs}`
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}), hashtext(${bucket}))`
    const count = await tx.profileEvent.count({
      where: { profileId, name: operation, createdAt: { gte: new Date(bucketStartMs) } },
    })
    if (count >= max) return false
    await tx.profileEvent.create({
      data: { profileId, name: operation, meta: JSON.stringify({ bucketStartMs, windowMs }) },
    })
    return true
  }, { isolationLevel: "Serializable" })
}

async function persistOwnedArtifact(input: Readonly<{
  profileId: string
  filename: string
  bytes: Buffer
  mediaType: string
}>): Promise<PersistedArtifact> {
  const { prisma } = await import("../../../lib/prisma")
  const baseDirectory = resolve(process.cwd(), "public", "uploads")
  const owner = ownerDirectory(input.profileId)
  const directory = resolve(baseDirectory, owner)
  const fullPath = resolve(directory, input.filename)
  if (!directory.startsWith(`${baseDirectory}${sep}`) || dirname(fullPath) !== directory) throw new Error("Unsafe artifact path")

  await mkdir(directory, { recursive: true })
  let bytes = input.bytes
  if (input.filename.toLowerCase().endsWith(".glb")) {
    try {
      const { optimizeModelSet } = await import("../../../lib/optimize-glb")
      const set = await optimizeModelSet(input.bytes)
      bytes = set.web
      await writeFile(fullPath.replace(/\.glb$/i, "-ar.glb"), set.ar)
      if (set.usdz) await writeFile(fullPath.replace(/\.glb$/i, ".usdz"), set.usdz)
    } catch {
      bytes = input.bytes
    }
  }
  await writeFile(fullPath, bytes, { flag: "wx" })
  const url = `/uploads/${owner}/${input.filename}`
  try {
    await prisma.profileEvent.create({
      data: {
        profileId: input.profileId,
        name: ARTIFACT_EVENT,
        path: url,
        meta: JSON.stringify({ mediaType: input.mediaType, size: bytes.length }),
      },
    })
  } catch (error) {
    await unlink(fullPath).catch(() => undefined)
    throw error
  }
  return Object.freeze({ url, filename: input.filename })
}

const productionDependencies: UploadRouteDependencies = Object.freeze({
  async authorize(claimedProfileId) {
    const { ownershipRefusalResponse, requireOwnedProfile } = await import("../../../lib/security")
    const result = await requireOwnedProfile({ claimedProfileId })
    return result.ok
      ? Object.freeze({ ok: true as const, profileId: result.value.profile.id })
      : Object.freeze({ ok: false as const, response: ownershipRefusalResponse(result.refusal) })
  },
  consumeUsage: consumeDurableUsage,
  persistArtifact: persistOwnedArtifact,
  generateId: randomUUID,
})

export function createUploadRoute(dependencies: UploadRouteDependencies) {
  return async function uploadRoute(request: Request): Promise<Response> {
    const authorization = await dependencies.authorize(request.headers.get("x-profile-id") ?? undefined)
    if (!authorization.ok) return authorization.response

    let allowed: boolean
    try {
      allowed = await dependencies.consumeUsage(authorization.profileId, RATE_EVENT, MAX_UPLOADS_PER_WINDOW, RATE_WINDOW_MS)
    } catch {
      return jsonError(503)
    }
    if (!allowed) return jsonError(429)

    try {
      const file = await parseBoundedMultipart(request)
      const bytes = Buffer.from(await file.arrayBuffer())
      const spec = validateFile(file, bytes)
      if (!spec) throw new RequestRejection(415)

      const filename = safeGeneratedFilename(dependencies.generateId(), spec.extension)
      const artifact = await dependencies.persistArtifact({
        profileId: authorization.profileId,
        filename,
        bytes,
        mediaType: file.type.toLowerCase(),
      })
      return Response.json(artifact)
    } catch (error) {
      if (error instanceof RequestRejection) return jsonError(error.status, "Request rejected")
      return jsonError(500)
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  return createUploadRoute(productionDependencies)(request)
}
