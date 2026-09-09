// @vitest-environment node
import { resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ write: vi.fn(), remove: vi.fn(), limit: vi.fn(), storage: vi.fn(), event: vi.fn(), provider: vi.fn() }))
const tx = {
    profile: { findUniqueOrThrow: vi.fn(async () => ({ billingAccountId: "account" })) },
    profileEvent: { count: vi.fn(async () => 0), create: mocks.event },
    billingStorageObject: { create: mocks.storage },
    $executeRaw: vi.fn(),
}
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx) } }))
vi.mock("@/lib/security", () => ({ requireProfileAccess: async () => ({ ok: true, value: { profile: { id: "profile" } } }), ownershipRefusalResponse: () => new Response(null, { status: 403 }) }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: async () => ({ accountId: "account" }), withAccountLimit: mocks.limit }))
vi.mock("@/lib/uploads-storage", () => ({ uploadsDirectory: () => resolve("basic-3d-fixture") }))
vi.mock("@/lib/image-to-3d", () => ({ imageTo3dGlb: mocks.provider }))
vi.mock("@/lib/optimize-glb", () => ({ optimizeModelSet: async () => ({ web: Buffer.alloc(20), ar: Buffer.alloc(30), usdz: Buffer.alloc(40) }) }))
vi.mock("fs/promises", () => { const methods = { mkdir: vi.fn(), writeFile: mocks.write, unlink: mocks.remove }; return { ...methods, default: methods } })
const { handleImageTo3dPost } = await import("@/app/api/image-to-3d/handler")

function request() {
    return new Request("https://example.test/api/image-to-3d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: "data:image/jpeg;base64,/9j/AA==" }) })
}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.write.mockResolvedValue(undefined)
    mocks.remove.mockResolvedValue(undefined)
    mocks.event.mockResolvedValue({})
    mocks.storage.mockResolvedValue({})
    mocks.limit.mockImplementation(async (_account, _kind, _amount, work: (value: typeof tx) => Promise<unknown>) => work(tx))
    const glb = Buffer.alloc(12)
    glb.write("glTF"); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(12, 8)
    mocks.provider.mockResolvedValue(glb)
})

describe("basic 3D output storage accounting", () => {
    it("meters the web model and every derivative in the shared account storage allowance", async () => {
        const response = await handleImageTo3dPost(request())
        expect(response.status).toBe(200)
        expect(mocks.limit).toHaveBeenCalledWith("account", "storageBytes", 90, expect.any(Function))
        expect(mocks.storage.mock.calls.map(call => call[0].data.bytes)).toEqual([BigInt(20), BigInt(30), BigInt(40)])
        expect(mocks.write).toHaveBeenCalledTimes(3)
        expect(mocks.remove).not.toHaveBeenCalled()
    })

    it("writes no files when the shared storage allowance refuses the complete artifact set", async () => {
        mocks.limit.mockRejectedValue(new Error("Storage quota reached"))
        expect((await handleImageTo3dPost(request())).status).toBe(500)
        expect(mocks.write).not.toHaveBeenCalled()
        expect(mocks.storage).not.toHaveBeenCalled()
    })

    it("cleans every created derivative when storage accounting fails", async () => {
        mocks.storage.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Database failure"))
        expect((await handleImageTo3dPost(request())).status).toBe(500)
        expect(mocks.write).toHaveBeenCalledTimes(3)
        expect(mocks.remove.mock.calls.map(call => call[0]).sort()).toEqual(mocks.write.mock.calls.map(call => call[0]).sort())
    })
})
