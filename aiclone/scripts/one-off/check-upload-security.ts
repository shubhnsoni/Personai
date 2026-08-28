import { createImageTo3dRoute, type ImageTo3dRouteDependencies } from "../../src/app/api/image-to-3d/route"
import { createUploadRoute, type UploadRouteDependencies } from "../../src/app/api/upload/route"
import {
  createOwnershipFoundation,
  ownershipRefusalResponse,
  type SecurityProfile,
  type SecurityUser,
  type ServerIdentitySource,
} from "../../src/lib/security/ownership"

type TestProfile = SecurityProfile & Readonly<{ role: "OWNER" }>

const failures: string[] = []
const assertions: string[] = []
const invert = process.env.INVERT_ASSERTION === "1"

function check(name: string, condition: unknown, central = false): void {
  assertions.push(name)
  const passed = central && invert ? !condition : Boolean(condition)
  if (!passed) failures.push(name)
}

class MutableIdentity implements ServerIdentitySource<TestProfile> {
  current: SecurityUser<TestProfile> | null = null
  async resolve(): Promise<SecurityUser<TestProfile> | null> {
    return this.current
  }
}

function validPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
}

function validGlb(): Buffer {
  const bytes = Buffer.alloc(12)
  bytes.write("glTF", 0, "ascii")
  bytes.writeUInt32LE(2, 4)
  bytes.writeUInt32LE(bytes.length, 8)
  return bytes
}

function validUsdz(): Buffer {
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])
}

function bodyBytes(bytes: Buffer): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes)
}

async function multipartRequest(bytes: Buffer, filename: string, mediaType: string, claimedProfileId?: string): Promise<Request> {
  const form = new FormData()
  form.append("file", new Blob([bodyBytes(bytes)], { type: mediaType }), filename)
  const encoded = new Request("https://test.invalid/api/upload", { method: "POST", body: form })
  const body = Buffer.from(await encoded.arrayBuffer())
  const headers = new Headers(encoded.headers)
  headers.set("content-length", String(body.length))
  if (claimedProfileId) headers.set("x-profile-id", claimedProfileId)
  return new Request("https://test.invalid/api/upload", { method: "POST", headers, body })
}

function jsonRequest(image: unknown, claimedProfileId?: string): Request {
  const body = Buffer.from(JSON.stringify({ image }))
  const headers = new Headers({ "content-type": "application/json", "content-length": String(body.length) })
  if (claimedProfileId) headers.set("x-profile-id", claimedProfileId)
  return new Request("https://test.invalid/api/image-to-3d", { method: "POST", headers, body })
}

async function statusAndText(response: Response): Promise<Readonly<{ status: number; text: string }>> {
  return Object.freeze({ status: response.status, text: await response.text() })
}

async function main(): Promise<void> {
  const identity = new MutableIdentity()
  const foundation = createOwnershipFoundation(identity)
  const writes: Array<{ route: string; profileId: string; filename: string; bytes: Buffer }> = []
  let computeCalls = 0
  let usageCalls = 0
  let limiterMode: "allow" | "deny" | "error" = "allow"
  let providerMode: "success" | "error" | "invalid" = "success"
  let persistMode: "success" | "error" = "success"

  const authorize = async (claimedProfileId?: string) => {
    const result = await foundation.requireOwnedProfile({ claimedProfileId })
    return result.ok
      ? { ok: true as const, profileId: result.value.profile.id }
      : { ok: false as const, response: ownershipRefusalResponse(result.refusal) }
  }

  const consumeUsage = async () => {
    usageCalls += 1
    if (limiterMode === "error") throw new Error("DATABASE_URL and key state must stay private")
    return limiterMode === "allow"
  }

  const uploadDependencies: UploadRouteDependencies = {
    authorize,
    consumeUsage,
    generateId: () => "11111111-1111-4111-8111-111111111111",
    async persistArtifact(input) {
      if (persistMode === "error") throw new Error("C:\\private\\upload\\path")
      writes.push({ route: "upload", ...input })
      return { url: `/uploads/owner/${input.filename}`, filename: input.filename }
    },
  }
  const computeDependencies: ImageTo3dRouteDependencies = {
    authorize,
    consumeUsage,
    generateId: () => "22222222-2222-4222-8222-222222222222",
    async invokeProvider() {
      computeCalls += 1
      if (providerMode === "error") throw new Error("provider key missing at C:\\secret")
      return providerMode === "invalid" ? Buffer.from("provider-html-error") : validGlb()
    },
    async persistArtifact(input) {
      if (persistMode === "error") throw new Error("C:\\private\\model\\path")
      writes.push({ route: "image-to-3d", ...input })
      return { url: `/uploads/owner/${input.filename}` }
    },
  }

  const upload = createUploadRoute(uploadDependencies)
  const imageTo3d = createImageTo3dRoute(computeDependencies)
  const pngDataUrl = `data:image/png;base64,${validPng().toString("base64")}`

  const beforeAnonymousWrites = writes.length
  const beforeAnonymousCompute = computeCalls
  const anonymousUpload = await statusAndText(await upload(await multipartRequest(validPng(), "photo.png", "image/png")))
  const anonymousCompute = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl)))
  check("anonymous upload is refused with the security foundation envelope", anonymousUpload.status === 401 && anonymousUpload.text.includes("UNAUTHORIZED"), true)
  check("anonymous image-to-3d is refused with the security foundation envelope", anonymousCompute.status === 401 && anonymousCompute.text.includes("UNAUTHORIZED"))
  check("anonymous refusals perform no artifact write or paid compute", writes.length === beforeAnonymousWrites && computeCalls === beforeAnonymousCompute && usageCalls === 0)

  identity.current = Object.freeze({
    id: "user-a",
    profiles: Object.freeze([{ id: "profile-a", role: "OWNER" } satisfies TestProfile]),
  })

  const beforeWrongTenantWrites = writes.length
  const beforeWrongTenantCompute = computeCalls
  const wrongTenantUpload = await statusAndText(await upload(await multipartRequest(validPng(), "photo.png", "image/png", "profile-b")))
  const wrongTenantCompute = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl, "profile-b")))
  check("authenticated foreign profile is refused on upload", wrongTenantUpload.status === 403 && wrongTenantUpload.text.includes("FORBIDDEN"))
  check("authenticated foreign profile is refused on image-to-3d", wrongTenantCompute.status === 403 && wrongTenantCompute.text.includes("FORBIDDEN"))
  check("wrong-tenant refusals perform no usage charge, write, or compute", writes.length === beforeWrongTenantWrites && computeCalls === beforeWrongTenantCompute && usageCalls === 0)

  const validUpload = await statusAndText(await upload(await multipartRequest(validPng(), "photo.png", "image/png")))
  check("valid authenticated owner upload succeeds", validUpload.status === 200 && validUpload.text.includes("11111111-1111-4111-8111-111111111111.png"))
  check("successful upload records server-derived ownership", writes.at(-1)?.profileId === "profile-a")

  const validCompute = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl)))
  check("valid authenticated owner image-to-3d succeeds end to end with stubbed compute", validCompute.status === 200 && validCompute.text.includes("22222222-2222-4222-8222-222222222222.glb"))
  check("successful image-to-3d records owner and invokes exactly one stubbed compute", writes.at(-1)?.profileId === "profile-a" && computeCalls === 1)

  const arGlb = await statusAndText(await upload(await multipartRequest(validGlb(), "dish.glb", "model/gltf-binary")))
  const arUsdz = await statusAndText(await upload(await multipartRequest(validUsdz(), "dish.usdz", "model/vnd.usdz+zip")))
  check("authenticated owner GLB upload preserves AR behavior", arGlb.status === 200 && arGlb.text.includes(".glb"))
  check("authenticated owner USDZ upload preserves AR Quick Look behavior", arUsdz.status === 200 && arUsdz.text.includes(".usdz"))

  const beforeOversizeWrites = writes.length
  const oversized = new Request("https://test.invalid/api/upload", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(52 * 1024 * 1024) },
    body: Buffer.from("not-buffered"),
  })
  const oversizedResponse = await statusAndText(await upload(oversized))
  check("oversized upload body is rejected before parsing or writing", oversizedResponse.status === 413 && writes.length === beforeOversizeWrites)

  const beforeInvalidWrites = writes.length
  const disguised = await statusAndText(await upload(await multipartRequest(Buffer.from("not a png"), "looks-safe.png", "image/png")))
  check("declared type and extension cannot lie about real bytes", disguised.status === 415 && writes.length === beforeInvalidWrites)

  const octet = await statusAndText(await upload(await multipartRequest(validGlb(), "dish.glb", "application/octet-stream")))
  check("application/octet-stream is not an upload bypass", octet.status === 415 && writes.length === beforeInvalidWrites)

  const traversal = await statusAndText(await upload(await multipartRequest(validPng(), "../../escape.png", "image/png")))
  const traversalWrite = writes.at(-1)
  check("caller filename cannot escape the owner directory", traversal.status === 200
    && traversalWrite?.filename === "11111111-1111-4111-8111-111111111111.png"
    && !traversalWrite.filename.includes("..") && !traversalWrite.filename.includes("/") && !traversalWrite.filename.includes("\\"))

  const beforeInvalidCompute = computeCalls
  const beforeInvalidComputeWrites = writes.length
  const disguisedImage = `data:image/png;base64,${Buffer.from("not-png").toString("base64")}`
  const invalidImage = await statusAndText(await imageTo3d(jsonRequest(disguisedImage)))
  check("image-to-3d validates image magic bytes before provider invocation", invalidImage.status === 415 && computeCalls === beforeInvalidCompute && writes.length === beforeInvalidComputeWrites)

  limiterMode = "deny"
  const beforeLimitedCompute = computeCalls
  const beforeLimitedWrites = writes.length
  const limited = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl)))
  check("durable usage refusal prevents compute and artifact write", limited.status === 429 && computeCalls === beforeLimitedCompute && writes.length === beforeLimitedWrites)

  limiterMode = "error"
  const limiterFailure = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl)))
  check("unavailable durable limiter fails closed with a generic error", limiterFailure.status === 503
    && !limiterFailure.text.includes("DATABASE_URL") && computeCalls === beforeLimitedCompute && writes.length === beforeLimitedWrites)

  limiterMode = "allow"
  providerMode = "error"
  const providerFailure = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl)))
  check("provider failures are generic and leak no key or filesystem state", providerFailure.status === 502
    && !providerFailure.text.includes("provider") && !providerFailure.text.includes("secret") && !providerFailure.text.includes("key"))

  providerMode = "invalid"
  const invalidProviderOutput = await statusAndText(await imageTo3d(jsonRequest(pngDataUrl)))
  check("invalid provider output is not written", invalidProviderOutput.status === 502 && writes.length === beforeLimitedWrites)

  providerMode = "success"
  persistMode = "error"
  const persistenceFailure = await statusAndText(await upload(await multipartRequest(validPng(), "photo.png", "image/png")))
  check("filesystem failures are generic and leak no path", persistenceFailure.status === 500
    && !persistenceFailure.text.includes("private") && !persistenceFailure.text.includes("path"))

  console.log(JSON.stringify({
    result: failures.length === 0 ? "PASS" : "FAIL",
    assertions: assertions.length,
    coverage: [
      "anonymous and wrong-tenant refusal before side effects",
      "valid owner upload and stubbed image-to-3d success",
      "bounded body handling",
      "real-byte content sniffing and octet-stream refusal",
      "safe generated owner-scoped filenames",
      "durable limiter fail-closed behavior",
      "generic provider, persistence, and limiter errors",
      "GLB and USDZ AR preservation",
    ],
    externalProviderCalled: "no, stubbed",
    dbAccess: "none",
    failures,
  }, null, 2))

  if (failures.length > 0) process.exitCode = 1
}

void main()
