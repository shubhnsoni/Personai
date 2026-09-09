import { createHash, randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import { dirname, resolve, sep } from "path"
import type { ArBuild } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { parseGallery } from "@/lib/commerce"
import { AR_CREDITS_PER_ITEM, arCostCents } from "@/lib/ar-price"
import { createImageTo3dTask, downloadAsset, getImageTo3dTask, publicError, STANDARD_3D_RECIPE, TaskRejectedError } from "@/lib/meshy-internal"
import { optimizeModelSet } from "@/lib/optimize-glb"
import { arSizeFor } from "@/lib/ar-scale"
import { readUploadedFile, uploadsDirectory, validUploadSegments } from "@/lib/uploads-storage"
import { photorealAvailable } from "@/lib/billing/config"
import { accountContext, assertAccountLimit, billingTransaction, lockBillingAccount, reserveUsageInTransaction, settleUsageInTransaction } from "@/lib/billing/service"

export type ArBuildRow = ArBuild & { title?: string }
const IN_FLIGHT = ["QUEUED", "DISPATCHING", "RUNNING", "DELIVERY_RETRY", "UNKNOWN", "HELD"]
const WORKER_LEASE_MS = 10 * 60_000
const PHOTO_MAXIMUM = 10 * 1024 * 1024
const READY_SELECT = { product: { select: { title: true } } } as const

function ownerDir(profileId: string) { return createHash("sha256").update(profileId).digest("hex").slice(0, 32) }
export function photoForProduct(product: { thumbnailUrl?: string | null; galleryUrls?: string | null }) { return parseGallery(product.galleryUrls, product.thumbnailUrl)[0] || null }
export function isOwnedProductPhoto(profileId: string, url: string | null | undefined) {
    if (!url?.startsWith(`/uploads/${ownerDir(profileId)}/`)) return false
    const parts = url.slice("/uploads/".length).split("/")
    return parts.length === 2 && validUploadSegments(parts) && /\.(?:jpg|jpeg|png)$/i.test(parts[1])
}

function sniffMime(bytes: Buffer) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
    return null
}

export async function imageToDataUri(url: string, profileId: string) {
    if (!isOwnedProductPhoto(profileId, url)) throw new Error("need_photo")
    const bytes = await readUploadedFile(url.slice("/uploads/".length).split("/"))
    const mime = sniffMime(bytes)
    if (!mime || bytes.length > PHOTO_MAXIMUM) throw new Error("bad_photo")
    return { dataUri: `data:${mime};base64,${bytes.toString("base64")}`, hash: createHash("sha256").update(bytes).digest("hex") }
}

export function publicBuild(row: ArBuildRow) {
    const errors: Record<string, string> = {
        payment_unverified: "This earlier generation is on hold until its payment is verified.",
        outcome_unknown: "We’re checking whether this generation started. Its unit remains reserved; the same request will not be sent again.",
        delivery_retry: "Your model was generated. Delivery is being retried without buying another generation.",
        status_retry: "We’re checking the existing generation again. No new generation will be submitted.",
        delivery_review: "Your generated model needs a delivery review. Its unit remains reserved.",
        storage_full: "Make room in your account storage to finish delivering this model. Its unit remains reserved.",
        source_changed: "The source photo changed before generation started. Your reserved unit was returned.",
        account_on_hold: "This account is on hold. The queued generation was stopped and its unit returned.",
    }
    return { id: row.id, productId: row.productId, batchId: row.batchId, imageUrl: row.imageUrl, status: row.status, glbUrl: row.glbUrl, usdzUrl: row.usdzUrl, chargeCents: row.chargeCents, error: row.error ? errors[row.error] || publicError(row.error) : null, title: row.title }
}

/** Reservation and the durable queue record commit together; a replay returns the original batch. */
export async function enqueueArBatch(input: { profileId: string; accountId: string; actorId: string; productIds: string[]; requestKey: string }) {
    if (!photorealAvailable()) throw new Error("Photoreal generation is currently unavailable. No unit was reserved.")
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey)) throw new Error("A valid generation request key is required.")
    const ids = [...new Set(input.productIds)].sort()
    if (!ids.length || ids.length > 50 || ids.some(id => typeof id !== "string" || id.length > 80)) throw new Error("Choose between 1 and 50 products.")
    const batchId = `ar_${createHash("sha256").update(`${input.profileId}:${input.requestKey}`).digest("hex").slice(0, 32)}`
    return billingTransaction(async tx => {
        await lockBillingAccount(tx, input.accountId)
        const currentProfile = await tx.profile.findUniqueOrThrow({ where: { id: input.profileId }, select: { billingAccountId: true } })
        if (currentProfile.billingAccountId !== input.accountId) throw new Error("The business billing account changed. Refresh before generating.")
        const existing = await tx.arBuild.findMany({ where: { batchId, profileId: input.profileId }, orderBy: { productId: "asc" } })
        if (existing.length) {
            if (JSON.stringify(existing.map(row => row.productId)) !== JSON.stringify(ids)) throw new Error("This request key belongs to a different selection.")
            return { batchId, replayed: true }
        }
        const products = await tx.digitalProduct.findMany({ where: { profileId: input.profileId, id: { in: ids } }, select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true } })
        if (products.length !== ids.length) throw new Error("One or more selected products are not available in this business.")
        if (await tx.arBuild.count({ where: { profileId: input.profileId, productId: { in: ids }, status: { in: IN_FLIGHT } } })) throw new Error("A selected product already has a generation in progress or awaiting review.")
        await assertAccountLimit(tx, input.accountId, "storageBytes", 1)
        for (const product of products) {
            const imageUrl = photoForProduct(product)
            if (!imageUrl || !isOwnedProductPhoto(input.profileId, imageUrl)) throw new Error(`Upload a JPG or PNG product photo for ${product.title} before generating.`)
            const source = await imageToDataUri(imageUrl, input.profileId)
            const requestKey = `${batchId}:${product.id}`
            const reservation = await reserveUsageInTransaction(tx, { accountId: input.accountId, profileId: input.profileId, actorId: input.actorId, unit: "PHOTOREAL", amount: 1, operationKey: requestKey, metadata: { productId: product.id, sourceHash: source.hash, recipe: STANDARD_3D_RECIPE } })
            if (!reservation.created) throw new Error("The prior generation reservation requires review. No new task was created.")
            await tx.arBuild.create({ data: { id: randomUUID(), profileId: input.profileId, productId: product.id, batchId, imageUrl, status: "QUEUED", reservationId: reservation.id, requestKey, recipe: JSON.stringify({ version: STANDARD_3D_RECIPE, sourceHash: source.hash, title: product.title }), credits: AR_CREDITS_PER_ITEM, costCents: arCostCents(1), chargeCents: 0, nextAttemptAt: new Date() } })
        }
        return { batchId, replayed: false }
    })
}

/** Compatibility endpoint for old merchant checkout webhooks; payment-id spelling never authorizes dispatch. */
export async function markBatchPaid(batchId: string, paymentReference?: string | null) {
    await prisma.arBuild.updateMany({ where: { batchId, status: { in: ["DRAFT", "PAID"] }, reservationId: null }, data: { status: "HELD", stripeSessionId: paymentReference || null, error: "payment_unverified" } })
}

export async function listBatch(batchId: string, profileId?: string): Promise<ArBuildRow[]> {
    const rows = await prisma.arBuild.findMany({ where: { batchId, ...(profileId ? { profileId } : {}) }, include: READY_SELECT, orderBy: { createdAt: "asc" } })
    return rows.map(row => ({ ...row, title: row.product.title }))
}

/** Browser polling only reads progress. The background worker owns dispatch and delivery. */
export async function tickBatch(batchId: string, profileId: string) { return (await listBatch(batchId, profileId)).map(publicBuild) }

function boundedSetting(name: string, fallback: number, ceiling: number) {
    const value = Number(process.env[name] || fallback)
    return Number.isSafeInteger(value) && value > 0 && value <= ceiling ? value : fallback
}

async function claimDispatch(row: ArBuildRow) {
    return billingTransaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(721093, 2)`
        if (!row.reservationId) {
            await tx.arBuild.updateMany({ where: { id: row.id, status: "QUEUED" }, data: { status: "HELD", error: "payment_unverified" } })
            return null
        }
        const reservation = await tx.billingReservation.findUnique({ where: { id: row.reservationId } })
        if (!reservation || reservation.state !== "RESERVED" || reservation.profileId !== row.profileId || reservation.unit !== "PHOTOREAL" || reservation.amount !== 1) return null
        await lockBillingAccount(tx, reservation.accountId)
        const context = await accountContext(tx, reservation.accountId)
        if (["SUSPENDED", "DISPUTED"].includes(context.subscriptionStatus)) {
            const changed = await tx.arBuild.updateMany({ where: { id: row.id, status: "QUEUED" }, data: { status: "FAILED", error: "account_on_hold" } })
            if (changed.count) await settleUsageInTransaction(tx, reservation.id, "RELEASE")
            return null
        }
        const profiles = (await tx.profile.findMany({ where: { billingAccountId: reservation.accountId }, select: { id: true } })).map(profile => profile.id)
        const activeStates = ["DISPATCHING", "RUNNING", "DELIVERY_RETRY", "UNKNOWN"]
        const now = new Date()
        const today = new Date(now); today.setUTCHours(0, 0, 0, 0)
        const [globalCount, accountCount, dailyCount] = await Promise.all([
            tx.arBuild.count({ where: { status: { in: activeStates } } }),
            tx.arBuild.count({ where: { profileId: { in: profiles }, status: { in: activeStates } } }),
            tx.billingLedgerEntry.count({ where: { kind: "PROVIDER_DISPATCH", createdAt: { gte: today } } }),
        ])
        const concurrency = { free: 1, starter: 1, pro: 2, business: 3, scale: 5 }[context.planId]
        if (globalCount >= boundedSetting("INTROIFY_PHOTOREAL_CONCURRENCY", 4, 20) || accountCount >= concurrency || dailyCount >= boundedSetting("INTROIFY_PHOTOREAL_DAILY_LIMIT", 50, 10_000)) return null
        const leaseUntil = new Date(now.getTime() + WORKER_LEASE_MS)
        const changed = await tx.arBuild.updateMany({ where: { id: row.id, status: "QUEUED", reservationId: reservation.id }, data: { status: "DISPATCHING", leaseUntil, attempts: { increment: 1 }, error: null } })
        if (changed.count === 1) await tx.billingLedgerEntry.create({ data: { accountId: reservation.accountId, unit: "PHOTOREAL", kind: "PROVIDER_DISPATCH", amount: 0, reservationId: reservation.id, operationKey: `photoreal-start:${row.id}` } })
        return changed.count === 1 ? { leaseUntil, reservationId: reservation.id } : null
    })
}

async function failKnown(row: ArBuildRow, leaseUntil: Date, code: string) {
    await billingTransaction(async tx => {
        const changed = await tx.arBuild.updateMany({ where: { id: row.id, status: { in: ["DISPATCHING", "RUNNING", "DELIVERY_RETRY"] }, leaseUntil }, data: { status: "FAILED", error: code.slice(0, 80), leaseUntil: null, nextAttemptAt: null } })
        if (changed.count === 1 && row.reservationId) await settleUsageInTransaction(tx, row.reservationId, "RELEASE")
    })
}

async function startJob(row: ArBuildRow) {
    const claim = await claimDispatch(row)
    if (!claim) return
    let source: Awaited<ReturnType<typeof imageToDataUri>>
    let recipe: { version: string; sourceHash: string }
    try {
        recipe = JSON.parse(row.recipe || "{}")
        if (recipe.version !== STANDARD_3D_RECIPE) throw new Error("studio_recipe_unavailable")
        source = await imageToDataUri(row.imageUrl, row.profileId)
        if (source.hash !== recipe.sourceHash) throw new Error("source_changed")
    } catch (error) {
        await failKnown(row, claim.leaseUntil, error instanceof Error ? error.message : "bad_photo")
        return
    }
    try {
        const providerTaskId = await createImageTo3dTask(source.dataUri, recipe.version)
        await prisma.arBuild.updateMany({ where: { id: row.id, reservationId: row.reservationId, status: { in: ["DISPATCHING", "UNKNOWN"] }, providerTaskId: null }, data: { providerTaskId, status: "RUNNING", leaseUntil: null, nextAttemptAt: new Date(Date.now() + 15_000), error: null } })
    } catch (error) {
        if (error instanceof TaskRejectedError) await failKnown(row, claim.leaseUntil, error.message)
        else await prisma.arBuild.updateMany({ where: { id: row.id, status: "DISPATCHING", leaseUntil: claim.leaseUntil }, data: { status: "UNKNOWN", error: "outcome_unknown", leaseUntil: null, nextAttemptAt: null } })
    }
}

async function persistModels(row: ArBuildRow, glbBytes: Buffer) {
    const recipe = JSON.parse(row.recipe || "{}") as { title?: string }
    const set = await optimizeModelSet(glbBytes, arSizeFor(recipe.title || row.title || "product"))
    const stem = `model-${row.id}`
    const files = [{ name: `${stem}.glb`, bytes: set.web }, { name: `${stem}-ar.glb`, bytes: set.ar }, { name: `${stem}-sv.glb`, bytes: set.ar }]
    if (set.usdz) files.push({ name: `${stem}.usdz`, bytes: set.usdz }, { name: `${stem}.ar.usdz`, bytes: set.usdz }, { name: `${stem}.ql.usdz`, bytes: set.usdz })
    const base = uploadsDirectory()
    const owner = ownerDir(row.profileId)
    const directory = resolve(base, owner)
    if (!directory.startsWith(`${base}${sep}`)) throw new Error("studio_failed")
    await mkdir(directory, { recursive: true })
    for (const file of files) {
        const full = resolve(directory, file.name)
        if (dirname(full) !== directory) throw new Error("studio_failed")
        await writeFile(full, file.bytes)
    }
    return { glbUrl: `/uploads/${owner}/${stem}.glb`, usdzUrl: set.usdz ? `/uploads/${owner}/${stem}.usdz` : null, files: files.map(file => ({ path: `/uploads/${owner}/${file.name}`, bytes: file.bytes.length })) }
}

async function pollJob(row: ArBuildRow) {
    if (!row.providerTaskId) return
    const now = new Date()
    const leaseUntil = new Date(now.getTime() + WORKER_LEASE_MS)
    const claimed = await prisma.arBuild.updateMany({ where: { id: row.id, status: { in: ["RUNNING", "DELIVERY_RETRY"] }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { leaseUntil } })
    if (claimed.count !== 1) return
    let generated = false
    try {
        const task = await getImageTo3dTask(row.providerTaskId)
        if (task.status === "PENDING" || task.status === "IN_PROGRESS") {
            await prisma.arBuild.updateMany({ where: { id: row.id, leaseUntil }, data: { leaseUntil: null, nextAttemptAt: new Date(Date.now() + 30_000) } })
            return
        }
        if (task.status === "FAILED" || task.status === "CANCELED") { await failKnown(row, leaseUntil, "studio_failed"); return }
        if (task.status !== "SUCCEEDED" || !task.model_urls?.glb) throw new Error("delivery_retry")
        generated = true
        const models = await persistModels(row, await downloadAsset(task.model_urls.glb))
        await billingTransaction(async tx => {
            const current = await tx.arBuild.findFirst({ where: { id: row.id, leaseUntil, status: { in: ["RUNNING", "DELIVERY_RETRY"] } } })
            if (!current) return
            const reservation = row.reservationId ? await tx.billingReservation.findUniqueOrThrow({ where: { id: row.reservationId } }) : null
            if (reservation) {
                if (reservation.state !== "RESERVED") throw new Error("delivery_review")
                await lockBillingAccount(tx, reservation.accountId)
                const paths = models.files.map(file => file.path)
                const existing = await tx.billingStorageObject.findMany({ where: { path: { in: paths } }, select: { bytes: true } })
                const delta = models.files.reduce((sum, file) => sum + file.bytes, 0) - existing.reduce((sum, file) => sum + Number(file.bytes), 0)
                try { await assertAccountLimit(tx, reservation.accountId, "storageBytes", delta) } catch { throw new Error("storage_full") }
                for (const file of models.files) await tx.billingStorageObject.upsert({ where: { path: file.path }, create: { accountId: reservation.accountId, profileId: row.profileId, path: file.path, bytes: BigInt(file.bytes) }, update: { bytes: BigInt(file.bytes) } })
                await settleUsageInTransaction(tx, reservation.id, "CONSUME", { jobId: row.id, providerTaskId: row.providerTaskId, providerConsumedCredits: typeof task.consumed_credits === "number" && Number.isFinite(task.consumed_credits) ? task.consumed_credits : null, estimatedCostCents: row.costCents })
            }
            await tx.arBuild.update({ where: { id: row.id }, data: { status: "READY", glbUrl: models.glbUrl, usdzUrl: models.usdzUrl, error: null, leaseUntil: null, nextAttemptAt: null } })
            const product = await tx.digitalProduct.findFirst({ where: { id: row.productId, profileId: row.profileId }, select: { thumbnailUrl: true, galleryUrls: true } })
            if (product && photoForProduct(product) === row.imageUrl) await tx.digitalProduct.updateMany({ where: { id: row.productId, profileId: row.profileId, thumbnailUrl: product.thumbnailUrl, galleryUrls: product.galleryUrls }, data: { arModelUrl: models.glbUrl, arUsdzUrl: models.usdzUrl } })
        })
    } catch (error) {
        const exhausted = row.status === "DELIVERY_RETRY" && row.attempts >= 12
        await prisma.arBuild.updateMany({ where: { id: row.id, leaseUntil, status: { in: ["RUNNING", "DELIVERY_RETRY"] } }, data: { status: exhausted ? "HELD" : "DELIVERY_RETRY", error: error instanceof Error && error.message === "storage_full" ? "storage_full" : exhausted ? "delivery_review" : generated ? "delivery_retry" : "status_retry", attempts: { increment: 1 }, leaseUntil: null, nextAttemptAt: exhausted ? null : new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.min(row.attempts, 5))) } })
    }
}

/** Called by the server scheduler. No browser session or payment return is required. */
export async function workerTick(limit = 8, profileId?: string) {
    if (!photorealAvailable()) return { processed: 0 }
    const now = new Date()
    const scope = profileId ? { profileId } : {}
    // Lost POST outcomes stay held. Expired dispatch leases are never re-queued.
    await prisma.arBuild.updateMany({ where: { ...scope, status: "DISPATCHING", leaseUntil: { lt: now } }, data: { status: "UNKNOWN", error: "outcome_unknown", leaseUntil: null, nextAttemptAt: null } })
    await prisma.arBuild.updateMany({ where: { ...scope, status: "RUNNING", providerTaskId: null }, data: { status: "UNKNOWN", error: "outcome_unknown", leaseUntil: null, nextAttemptAt: null } })
    await prisma.arBuild.updateMany({ where: { ...scope, status: { in: ["PAID", "DRAFT"] }, reservationId: null }, data: { status: "HELD", error: "payment_unverified" } })
    const rows = await prisma.arBuild.findMany({ where: { ...scope, status: { in: ["QUEUED", "RUNNING", "DELIVERY_RETRY"] }, AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }] }, include: READY_SELECT, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }], take: Math.max(1, Math.min(20, Math.floor(limit) || 8)) })
    for (const row of rows) {
        const job = { ...row, title: row.product.title }
        try { if (row.status === "QUEUED") await startJob(job); else await pollJob(job) }
        catch { /* Durable state remains for the next lease or explicit review; never re-post an unknown task. */ }
    }
    return { processed: rows.length }
}
