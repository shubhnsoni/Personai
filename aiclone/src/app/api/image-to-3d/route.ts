import { createHash, randomUUID } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import { dirname, resolve, sep } from "path"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_JSON_BODY_SIZE = 14 * 1024 * 1024
const MAX_MODEL_SIZE = 50 * 1024 * 1024
const RATE_WINDOW_MS = 60 * 60 * 1000
const MAX_COMPUTE_PER_WINDOW = 3
const RATE_EVENT = "security.image-to-3d.rate"
const ARTIFACT_EVENT = "security.image-to-3d.artifact"

type AuthorizationResult =
  | Readonly<{ ok: true; profileId: string }>
  | Readonly<{ ok: false; response: Response }>

export type ImageTo3dRouteDependencies = Readonly<{
  authorize(claimedProfileId?: string): Promise<AuthorizationResult>
  consumeUsage(profileId: string, operation: string, max: number, windowMs: number): Promise<boolean>
  invokeProvider(dataUrl: string): Promise<Buffer>
  persistArtifact(input: Readonly<{ profileId: string; filename: string; bytes: Buffer }>): Promise<Readonly<{ url: string }>>
  generateId(): string
}>

class RequestRejection extends Error {
  constructor(readonly status: 400 | 413 | 415) {
    super("Request rejected")
  }
}

function jsonError(status: number, error = "Request could not be completed"): Response {
  return Response.json({ error }, { status })
}

async function readBoundedBody(request: Request): Promise<Buffer> {
  const declared = request.headers.get("content-length")
  if (declared !== null) {
    if (!/^\d+$/u.test(declared)) throw new RequestRejection(400)
    if (Number(declared) > MAX_JSON_BODY_SIZE) throw new RequestRejection(413)
  }
  if (!request.body) throw new RequestRejection(400)

  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_JSON_BODY_SIZE) {
      await reader.cancel()
      throw new RequestRejection(413)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

function sniffImage(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  return null
}

function parseImageDataUrl(value: unknown): string {
  if (typeof value !== "string") throw new RequestRejection(400)
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/u)
  if (!match || match[2].length === 0 || match[2].length % 4 !== 0) throw new RequestRejection(415)
  const bytes = Buffer.from(match[2], "base64")
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_SIZE) throw new RequestRejection(bytes.length > MAX_IMAGE_SIZE ? 413 : 415)
  if (bytes.toString("base64") !== match[2] || sniffImage(bytes) !== match[1]) throw new RequestRejection(415)
  return value
}

function isValidGlb(bytes: Buffer): boolean {
  return bytes.length >= 12
    && bytes.length <= MAX_MODEL_SIZE
    && bytes.toString("ascii", 0, 4) === "glTF"
    && bytes.readUInt32LE(4) === 2
    && bytes.readUInt32LE(8) === bytes.length
}

function safeGeneratedFilename(id: string): string {
  const safeId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(id)
    ? id.toLowerCase()
    : createHash("sha256").update(id).digest("hex").slice(0, 32)
  return `${safeId}.glb`
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

async function persistOwnedArtifact(input: Readonly<{ profileId: string; filename: string; bytes: Buffer }>): Promise<Readonly<{ url: string }>> {
  const { prisma } = await import("../../../lib/prisma")
  const baseDirectory = resolve(process.cwd(), "public", "uploads")
  const owner = ownerDirectory(input.profileId)
  const directory = resolve(baseDirectory, owner)
  const fullPath = resolve(directory, input.filename)
  if (!directory.startsWith(`${baseDirectory}${sep}`) || dirname(fullPath) !== directory) throw new Error("Unsafe artifact path")

  await mkdir(directory, { recursive: true })
  await writeFile(fullPath, input.bytes, { flag: "wx" })
  const url = `/uploads/${owner}/${input.filename}`
  try {
    await prisma.profileEvent.create({
      data: {
        profileId: input.profileId,
        name: ARTIFACT_EVENT,
        path: url,
        meta: JSON.stringify({ mediaType: "model/gltf-binary", size: input.bytes.length, source: "sf3d" }),
      },
    })
  } catch (error) {
    await unlink(fullPath).catch(() => undefined)
    throw error
  }
  return Object.freeze({ url })
}

const productionDependencies: ImageTo3dRouteDependencies = Object.freeze({
  async authorize(claimedProfileId) {
    const { ownershipRefusalResponse, requireOwnedProfile } = await import("../../../lib/security")
    const result = await requireOwnedProfile({ claimedProfileId })
    return result.ok
      ? Object.freeze({ ok: true as const, profileId: result.value.profile.id })
      : Object.freeze({ ok: false as const, response: ownershipRefusalResponse(result.refusal) })
  },
  consumeUsage: consumeDurableUsage,
  async invokeProvider(dataUrl) {
    const { imageTo3dGlb } = await import("../../../lib/image-to-3d")
    return imageTo3dGlb(dataUrl)
  },
  persistArtifact: persistOwnedArtifact,
  generateId: randomUUID,
})

export function createImageTo3dRoute(dependencies: ImageTo3dRouteDependencies) {
  return async function imageTo3dRoute(request: Request): Promise<Response> {
    const authorization = await dependencies.authorize(request.headers.get("x-profile-id") ?? undefined)
    if (!authorization.ok) return authorization.response

    let allowed: boolean
    try {
      allowed = await dependencies.consumeUsage(authorization.profileId, RATE_EVENT, MAX_COMPUTE_PER_WINDOW, RATE_WINDOW_MS)
    } catch {
      return jsonError(503)
    }
    if (!allowed) return jsonError(429)

    let dataUrl: string
    try {
      const rawBody = await readBoundedBody(request)
      const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)) as { image?: unknown }
      dataUrl = parseImageDataUrl(parsed?.image)
    } catch (error) {
      if (error instanceof RequestRejection) return jsonError(error.status, "Request rejected")
      return jsonError(400, "Request rejected")
    }

    let model: Buffer
    try {
      model = await dependencies.invokeProvider(dataUrl)
    } catch {
      return jsonError(502)
    }
    if (!isValidGlb(model)) return jsonError(502)

    try {
      const filename = safeGeneratedFilename(dependencies.generateId())
      const artifact = await dependencies.persistArtifact({ profileId: authorization.profileId, filename, bytes: model })
      return Response.json({ ...artifact, source: "sf3d" })
    } catch {
      return jsonError(500)
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  return createImageTo3dRoute(productionDependencies)(request)
}
