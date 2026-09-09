// @vitest-environment node
import { createHash, randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const vendor = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), download: vi.fn() }))
vi.mock("@/lib/billing/config", () => ({ photorealAvailable: () => true }))
vi.mock("@/lib/meshy-internal", () => ({ STANDARD_3D_RECIPE: "standard-meshy6-2k-v1", TaskRejectedError: class TaskRejectedError extends Error {}, createImageTo3dTask: vendor.create, getImageTo3dTask: vendor.get, downloadAsset: vendor.download, publicError: () => "Generation unavailable" }))
vi.mock("@/lib/uploads-storage", () => ({ uploadsDirectory: () => resolve("isolated-ar-artifacts"), readUploadedFile: async () => Buffer.from([0xff, 0xd8, 0xff, 0]), validUploadSegments: () => true }))
vi.mock("@/lib/optimize-glb", () => ({ optimizeModelSet: async () => ({ web: Buffer.from("web"), ar: Buffer.from("ar"), usdz: Buffer.from("usdz") }) }))
vi.mock("fs/promises", () => { const methods = { mkdir: vi.fn(), writeFile: vi.fn() }; return { ...methods, default: methods } })

import { prisma } from "@/lib/prisma"
import { enqueueArBatch, workerTick } from "@/lib/ar-builds"
import { ensureDefaultBillingAccount } from "@/lib/billing/service"

const target = process.env.INTROIFY_BILLING_TEST_DATABASE_URL
const isolated = target && target === process.env.DATABASE_URL && /^postgresql:\/\/introify_test@127\.0\.0\.1:\d+\/introify_billing_integration_migrated\?schema=public$/.test(target)
const suite = isolated ? describe : describe.skip
const fixtureProfiles: string[] = []
async function fixture(count = 1) {
    const unique = randomUUID().replaceAll("-", "")
    const user = await prisma.user.create({ data: { clerkId: `ar-test-${unique}`, email: `${unique}@example.test`, emailVerifiedAt: new Date() } })
    const account = await ensureDefaultBillingAccount(user.id)
    const profile = await prisma.profile.create({ data: { userId: user.id, billingAccountId: account.id, slug: unique, displayName: "AR integration fixture" } })
    fixtureProfiles.push(profile.id)
    const photo = `/uploads/${createHash("sha256").update(profile.id).digest("hex").slice(0, 32)}/photo.jpg`
    const products = await Promise.all(Array.from({ length: count }, (_, index) => prisma.digitalProduct.create({ data: { profileId: profile.id, title: `Fixture ${index}`, type: "PHYSICAL", priceCents: 0, thumbnailUrl: photo } })))
    return { profile, account, user, products, input: { profileId: profile.id, accountId: account.id, actorId: user.id, productIds: products.map(product => product.id), requestKey: randomUUID() } }
}

suite("AR queue and ledger on isolated PostgreSQL", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv("INTROIFY_FREE_TRIAL_DAILY_LIMIT", "1000")
        vi.stubEnv("INTROIFY_PHOTOREAL_CONCURRENCY", "20")
        vendor.create.mockResolvedValue(`fake-task-${randomUUID()}`)
        vendor.get.mockResolvedValue({ status: "IN_PROGRESS" })
        vendor.download.mockResolvedValue(Buffer.from("model"))
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("External network forbidden in isolated AR tests") }))
    })
    afterAll(async () => {
        if (isolated) {
            // Leave fixture records for inspection, held so a later worker cannot call their fake task ids.
            await prisma.arBuild.updateMany({ where: { profileId: { in: fixtureProfiles }, status: { notIn: ["READY", "FAILED"] } }, data: { status: "HELD", nextAttemptAt: null, leaseUntil: null } })
            await prisma.$disconnect()
        }
    })

    it("commits only one Free-trial job across concurrent different product requests", async () => {
        const f = await fixture(2)
        const results = await Promise.allSettled(f.products.map(product => enqueueArBatch({ ...f.input, productIds: [product.id], requestKey: randomUUID() })))
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
        expect(await prisma.arBuild.count({ where: { profileId: f.profile.id } })).toBe(1)
        expect(await prisma.billingReservation.count({ where: { accountId: f.account.id, unit: "PHOTOREAL" } })).toBe(1)
        expect(await prisma.billingTrialClaim.count({ where: { userId: f.user.id } })).toBe(1)
        expect(vendor.create).not.toHaveBeenCalled()
    })

    it("rolls back every row and trial claim when the entire selection cannot be reserved", async () => {
        const f = await fixture(2)
        await expect(enqueueArBatch(f.input)).rejects.toThrow("Not enough")
        expect(await prisma.arBuild.count({ where: { profileId: f.profile.id } })).toBe(0)
        expect(await prisma.billingReservation.count({ where: { accountId: f.account.id } })).toBe(0)
        expect(await prisma.billingTrialClaim.count({ where: { userId: f.user.id } })).toBe(0)
    })

    it("replays concurrent identical UUIDs into one batch and submits only once under racing workers", async () => {
        const f = await fixture()
        const batches = await Promise.all([enqueueArBatch(f.input), enqueueArBatch(f.input)])
        expect(new Set(batches.map(batch => batch.batchId)).size).toBe(1)
        expect(await prisma.arBuild.count({ where: { profileId: f.profile.id } })).toBe(1)
        await Promise.all([workerTick(8, f.profile.id), workerTick(8, f.profile.id)])
        expect(vendor.create).toHaveBeenCalledOnce()
        const row = await prisma.arBuild.findFirstOrThrow({ where: { profileId: f.profile.id } })
        expect(row.status).toBe("RUNNING")
        expect((await prisma.billingReservation.findUniqueOrThrow({ where: { id: row.reservationId! } })).state).toBe("RESERVED")
    })

    it("holds an ambiguous POST without releasing or resubmitting its reserved unit", async () => {
        const f = await fixture()
        await enqueueArBatch(f.input)
        vendor.create.mockRejectedValue(new Error("timeout after possible acceptance"))
        await workerTick(8, f.profile.id)
        await workerTick(8, f.profile.id)
        const row = await prisma.arBuild.findFirstOrThrow({ where: { profileId: f.profile.id } })
        expect(row.status).toBe("UNKNOWN")
        expect(vendor.create).toHaveBeenCalledOnce()
        expect((await prisma.billingReservation.findUniqueOrThrow({ where: { id: row.reservationId! } })).state).toBe("RESERVED")
    })

    it("commits delivery, asset accounting and exactly one credit consumption together", async () => {
        const f = await fixture()
        await enqueueArBatch(f.input)
        await workerTick(8, f.profile.id)
        await prisma.arBuild.updateMany({ where: { profileId: f.profile.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })
        vendor.get.mockResolvedValue({ status: "SUCCEEDED", consumed_credits: 30, model_urls: { glb: "https://assets.meshy.ai/fake.glb" } })
        await Promise.all([workerTick(8, f.profile.id), workerTick(8, f.profile.id)])
        const row = await prisma.arBuild.findFirstOrThrow({ where: { profileId: f.profile.id } })
        expect(row.status).toBe("READY")
        expect(await prisma.billingLedgerEntry.count({ where: { reservationId: row.reservationId, kind: "CONSUME" } })).toBe(1)
        expect(await prisma.billingStorageObject.count({ where: { accountId: f.account.id } })).toBe(6)
        expect((await prisma.billingReservation.findUniqueOrThrow({ where: { id: row.reservationId! } })).state).toBe("CONSUMED")
        expect((await prisma.digitalProduct.findUniqueOrThrow({ where: { id: f.products[0].id } })).arModelUrl).toBe(row.glbUrl)
        expect(vendor.create).toHaveBeenCalledOnce()
    })
})
