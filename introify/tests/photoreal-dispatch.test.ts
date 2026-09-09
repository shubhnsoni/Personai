import { createHash } from "crypto"
import { resolve } from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    enabled: true, jobs: [] as Record<string, unknown>[], query: vi.fn(), createTask: vi.fn(), getTask: vi.fn(), download: vi.fn(), optimize: vi.fn(),
    readPhoto: vi.fn(), writeFile: vi.fn(), reserve: vi.fn(), settle: vi.fn(), limit: vi.fn(), productUpdate: vi.fn(), ledger: vi.fn(), storage: vi.fn(),
    reservations: new Map<string, Record<string, unknown>>(), products: [] as Record<string, unknown>[],
}))

function matches(row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
    return Object.entries(where).every(([key, expected]) => {
        if (key === "AND") return (expected as Record<string, unknown>[]).every(condition => matches(row, condition))
        if (key === "OR") return (expected as Record<string, unknown>[]).some(condition => matches(row, condition))
        const value = row[key]
        if (expected && typeof expected === "object" && !(expected instanceof Date)) {
            const op = expected as { in?: unknown[]; lt?: Date; lte?: Date; gte?: Date; gt?: number }
            if (op.in) return op.in.includes(value)
            if (op.lt) return value instanceof Date && value < op.lt
            if (op.lte) return value instanceof Date && value <= op.lte
            if (op.gte) return value instanceof Date && value >= op.gte
            if (op.gt !== undefined) return Number(value) > op.gt
        }
        if (expected instanceof Date) return value instanceof Date && +value === +expected
        return value === expected
    })
}
function update(row: Record<string, unknown>, data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "increment" in value ? Number(row[key] || 0) + Number(value.increment) : value
}
const database = {
    $executeRaw: mocks.query,
    profile: { findUniqueOrThrow: vi.fn(async () => ({ billingAccountId: "account" })), findMany: vi.fn(async () => [{ id: "profile" }]) },
    arBuild: {
        findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => mocks.jobs.filter(row => matches(row, where)).map(row => ({ ...row, product: { title: "Ceramic cup" } }))),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => mocks.jobs.find(row => matches(row, where)) || null),
        count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => mocks.jobs.filter(row => matches(row, where)).length),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { providerTaskId: null, leaseUntil: null, attempts: 0, ...data }; mocks.jobs.push(row); return row }),
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { const selected = mocks.jobs.filter(row => matches(row, where)); selected.forEach(row => update(row, data)); return { count: selected.length } }),
        update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { const row = mocks.jobs.find(row => matches(row, where))!; update(row, data); return row }),
    },
    digitalProduct: { findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => mocks.products.filter(row => matches(row, where))), findFirst: vi.fn(async () => mocks.products[0]), updateMany: mocks.productUpdate },
    billingReservation: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => mocks.reservations.get(where.id) || null), findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => mocks.reservations.get(where.id)) },
    billingLedgerEntry: { count: vi.fn(async () => 0), create: mocks.ledger },
    billingStorageObject: { findMany: vi.fn(async () => []), upsert: mocks.storage },
}
vi.mock("@/lib/prisma", () => ({ prisma: database }))
vi.mock("@/lib/billing/config", () => ({ photorealAvailable: () => mocks.enabled }))
vi.mock("@/lib/billing/service", () => ({
    billingTransaction: async (work: (tx: typeof database) => Promise<unknown>) => work(database),
    lockBillingAccount: vi.fn(), accountContext: async () => ({ planId: "pro", subscriptionStatus: "ACTIVE" }),
    assertAccountLimit: mocks.limit, reserveUsageInTransaction: mocks.reserve, settleUsageInTransaction: mocks.settle,
}))
vi.mock("@/lib/meshy-internal", () => ({
    STANDARD_3D_RECIPE: "standard-meshy6-2k-v1", TaskRejectedError: class TaskRejectedError extends Error {},
    createImageTo3dTask: mocks.createTask, getImageTo3dTask: mocks.getTask, downloadAsset: mocks.download, publicError: () => "Could not build this model",
}))
vi.mock("@/lib/optimize-glb", () => ({ optimizeModelSet: mocks.optimize }))
vi.mock("@/lib/uploads-storage", () => ({ uploadsDirectory: () => resolve("validation", "uploads"), readUploadedFile: mocks.readPhoto, validUploadSegments: (parts: string[]) => parts.every(part => /^[a-z0-9._-]+$/i.test(part) && part !== "..") }))
vi.mock("fs/promises", () => { const methods = { mkdir: vi.fn(), writeFile: mocks.writeFile }; return { ...methods, default: methods } })

const { workerTick, enqueueArBatch, tickBatch, isOwnedProductPhoto } = await import("@/lib/ar-builds")
const { TaskRejectedError } = await import("@/lib/meshy-internal")
const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0])
const photoUrl = `/uploads/${createHash("sha256").update("profile").digest("hex").slice(0, 32)}/photo.jpg`
function job(overrides: Record<string, unknown> = {}) {
    return { id: "job-one", profileId: "profile", productId: "product", batchId: "batch", imageUrl: photoUrl, status: "QUEUED", providerTaskId: null, reservationId: "reservation", requestKey: "operation", recipe: JSON.stringify({ version: "standard-meshy6-2k-v1", sourceHash: createHash("sha256").update(photoBytes).digest("hex") }), stripeSessionId: null, glbUrl: null, usdzUrl: null, credits: 30, costCents: 60, chargeCents: 0, attempts: 0, nextAttemptAt: null, leaseUntil: null, error: null, createdAt: new Date(), ...overrides }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.enabled = true
    mocks.jobs = []
    mocks.reservations = new Map([["reservation", { id: "reservation", accountId: "account", profileId: "profile", state: "RESERVED", unit: "PHOTOREAL", amount: 1 }]])
    mocks.products = [{ id: "product", profileId: "profile", title: "Ceramic cup", thumbnailUrl: photoUrl, galleryUrls: null }]
    mocks.readPhoto.mockResolvedValue(photoBytes)
    mocks.createTask.mockResolvedValue("provider-task")
    mocks.getTask.mockResolvedValue({ status: "IN_PROGRESS" })
    mocks.download.mockResolvedValue(Buffer.from("model"))
    mocks.optimize.mockResolvedValue({ web: Buffer.from("web"), ar: Buffer.from("ar"), usdz: Buffer.from("usdz") })
    mocks.reserve.mockResolvedValue({ id: "reservation", created: true, state: "RESERVED" })
    mocks.settle.mockResolvedValue(undefined)
    mocks.limit.mockResolvedValue(undefined)
})

describe("durable photoreal generation", () => {
    it("does not reserve or contact a provider while rollout is disabled", async () => {
        mocks.enabled = false
        await expect(enqueueArBatch({ profileId: "profile", accountId: "account", actorId: "actor", productIds: ["product"], requestKey: "00000000-0000-4000-8000-000000000001" })).rejects.toThrow("currently unavailable")
        expect(await workerTick()).toEqual({ processed: 0 })
        expect(mocks.reserve).not.toHaveBeenCalled()
        expect(mocks.createTask).not.toHaveBeenCalled()
    })

    it("queues one unit and replays the same request without reserving or submitting twice", async () => {
        const input = { profileId: "profile", accountId: "account", actorId: "actor", productIds: ["product"], requestKey: "00000000-0000-4000-8000-000000000001" }
        const first = await enqueueArBatch(input)
        const again = await enqueueArBatch(input)
        expect(again).toEqual({ batchId: first.batchId, replayed: true })
        expect(mocks.reserve).toHaveBeenCalledOnce()
        expect(mocks.jobs).toHaveLength(1)
        expect(mocks.jobs[0].status).toBe("QUEUED")
        expect(mocks.jobs[0].chargeCents).toBe(0)
        expect(mocks.createTask).not.toHaveBeenCalled()
        await expect(enqueueArBatch({ ...input, productIds: ["another-product"] })).rejects.toThrow("different selection")
    })

    it("rejects another profile's image and arbitrary URLs before reservation", async () => {
        expect(isOwnedProductPhoto("other-profile", photoUrl)).toBe(false)
        for (const source of ["http://127.0.0.1/internal", "data:image/jpeg;base64,test", "/uploads/other/photo.jpg"]) {
            mocks.products[0].thumbnailUrl = source
            await expect(enqueueArBatch({ profileId: "profile", accountId: "account", actorId: "actor", productIds: ["product"], requestKey: "00000000-0000-4000-8000-000000000001" })).rejects.toThrow("Upload a JPG or PNG")
        }
        expect(mocks.reserve).not.toHaveBeenCalled()
        expect(mocks.createTask).not.toHaveBeenCalled()
    })

    it.each([null, "local", "pi_looksPaid", "cs_live_looksPaid"])("holds legacy payment reference %s without treating its shape as evidence", async reference => {
        mocks.jobs = [job({ status: "PAID", reservationId: null, stripeSessionId: reference })]
        await workerTick()
        expect(mocks.jobs[0].status).toBe("HELD")
        expect(mocks.createTask).not.toHaveBeenCalled()
    })

    it("allows only one conditional queue claim to submit under concurrent workers", async () => {
        mocks.jobs = [job()]
        await Promise.all([workerTick(), workerTick()])
        expect(mocks.createTask).toHaveBeenCalledOnce()
        expect(mocks.jobs[0].status).toBe("RUNNING")
        expect(mocks.jobs[0].providerTaskId).toBe("provider-task")
    })

    it("holds a POST timeout and never re-posts its request or releases its unit", async () => {
        mocks.jobs = [job()]
        mocks.createTask.mockRejectedValue(new Error("timeout"))
        await workerTick()
        await workerTick()
        expect(mocks.jobs[0].status).toBe("UNKNOWN")
        expect(mocks.createTask).toHaveBeenCalledOnce()
        expect(mocks.settle).not.toHaveBeenCalled()
    })

    it("moves an expired dispatch lease to unknown without sending the task again", async () => {
        mocks.jobs = [job({ status: "DISPATCHING", leaseUntil: new Date(Date.now() - 1000) })]
        await workerTick()
        expect(mocks.jobs[0].status).toBe("UNKNOWN")
        expect(mocks.createTask).not.toHaveBeenCalled()
        expect(mocks.settle).not.toHaveBeenCalled()
    })

    it("returns the reserved unit after a definite rejection", async () => {
        mocks.jobs = [job()]
        mocks.createTask.mockRejectedValue(new TaskRejectedError("bad_photo"))
        await workerTick()
        expect(mocks.jobs[0].status).toBe("FAILED")
        expect(mocks.settle).toHaveBeenCalledWith(database, "reservation", "RELEASE")
    })

    it("returns the unit if a source changed before any provider request", async () => {
        mocks.jobs = [job()]
        mocks.readPhoto.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 1]))
        await workerTick()
        expect(mocks.createTask).not.toHaveBeenCalled()
        expect(mocks.jobs[0].error).toBe("source_changed")
        expect(mocks.settle).toHaveBeenCalledWith(database, "reservation", "RELEASE")
    })

    it("retries delivery against the same task and consumes only after the asset is stored", async () => {
        mocks.jobs = [job({ status: "RUNNING", providerTaskId: "original-task" })]
        mocks.getTask.mockResolvedValue({ status: "SUCCEEDED", consumed_credits: 30, model_urls: { glb: "https://assets.meshy.ai/model.glb" } })
        mocks.download.mockRejectedValueOnce(new Error("download failed"))
        await workerTick()
        expect(mocks.jobs[0].status).toBe("DELIVERY_RETRY")
        expect(mocks.settle).not.toHaveBeenCalled()
        mocks.jobs[0].nextAttemptAt = new Date(Date.now() - 1000)
        await workerTick()
        expect(mocks.jobs[0].status).toBe("READY")
        expect(mocks.getTask.mock.calls.map(call => call[0])).toEqual(["original-task", "original-task"])
        expect(mocks.createTask).not.toHaveBeenCalled()
        expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(database, "reservation", "CONSUME", expect.objectContaining({ providerConsumedCredits: 30, estimatedCostCents: 60 }))
        expect(mocks.storage).toHaveBeenCalledTimes(6)
        expect(mocks.productUpdate).toHaveBeenCalledOnce()
    })

    it("keeps a successfully generated asset separate when its product's photo has changed", async () => {
        mocks.jobs = [job({ status: "RUNNING", providerTaskId: "original-task" })]
        mocks.products[0].thumbnailUrl = photoUrl.replace("photo.jpg", "new.jpg")
        mocks.getTask.mockResolvedValue({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/model.glb" } })
        await workerTick()
        expect(mocks.jobs[0].status).toBe("READY")
        expect(mocks.productUpdate).not.toHaveBeenCalled()
    })

    it("does not create work from a browser status poll", async () => {
        mocks.jobs = [job()]
        expect(await tickBatch("batch", "profile")).toHaveLength(1)
        expect(mocks.createTask).not.toHaveBeenCalled()
        expect(mocks.getTask).not.toHaveBeenCalled()
    })
})
