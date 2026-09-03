import { createHash, randomBytes } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, resolve, sep } from "path"
import { prisma } from "@/lib/prisma"
import { parseGallery } from "@/lib/commerce"
import { arChargeCents, arCostCents, AR_CREDITS_PER_ITEM } from "@/lib/ar-price"
import { createImageTo3dTask, downloadAsset, getImageTo3dTask, publicError } from "@/lib/meshy-internal"
import { optimizeModelSet } from "@/lib/optimize-glb"
import { arSizeFor } from "@/lib/ar-scale"

export type ArBuildStatus = "DRAFT" | "PAID" | "RUNNING" | "READY" | "FAILED"

export type ArBuildRow = {
    id: string
    profileId: string
    productId: string
    batchId: string
    imageUrl: string
    status: ArBuildStatus
    providerTaskId: string | null
    glbUrl: string | null
    usdzUrl: string | null
    credits: number
    costCents: number
    chargeCents: number
    stripeSessionId: string | null
    error: string | null
    createdAt: Date
    updatedAt: Date
    title?: string
}

function newId() {
    return `c${randomBytes(12).toString("hex")}`
}

function ownerDir(profileId: string) {
    return createHash("sha256").update(profileId).digest("hex").slice(0, 32)
}

let tableReady = false

export async function ensureArBuildTable() {
    if (tableReady) return
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ArBuild" (
            id TEXT PRIMARY KEY,
            "profileId" TEXT NOT NULL,
            "productId" TEXT NOT NULL,
            "batchId" TEXT NOT NULL,
            "imageUrl" TEXT NOT NULL,
            status TEXT NOT NULL,
            "providerTaskId" TEXT,
            "glbUrl" TEXT,
            "usdzUrl" TEXT,
            credits INTEGER NOT NULL,
            "costCents" INTEGER NOT NULL,
            "chargeCents" INTEGER NOT NULL,
            "stripeSessionId" TEXT,
            error TEXT,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ArBuild_batchId_idx" ON "ArBuild"("batchId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ArBuild_profileId_idx" ON "ArBuild"("profileId")`)
    tableReady = true
}

export function photoForProduct(product: { thumbnailUrl?: string | null; galleryUrls?: string | null }) {
    return parseGallery(product.galleryUrls, product.thumbnailUrl)[0] || null
}

function sniffMime(bytes: Buffer) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
    if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp"
    return null
}

export async function imageToDataUri(url: string) {
    if (url.startsWith("data:image/")) return url
    if (url.startsWith("/")) {
        const base = resolve(process.cwd(), "public")
        const full = resolve(base, url.replace(/^\//, ""))
        if (!full.startsWith(`${base}${sep}`)) throw new Error("need_photo")
        const bytes = await readFile(full)
        const mime = sniffMime(bytes) || "image/jpeg"
        return `data:${mime};base64,${bytes.toString("base64")}`
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error("need_photo")
    const bytes = Buffer.from(await res.arrayBuffer())
    const mime = sniffMime(bytes) || "image/jpeg"
    return `data:${mime};base64,${bytes.toString("base64")}`
}

async function persistBytes(profileId: string, filename: string, bytes: Buffer) {
    const base = resolve(process.cwd(), "public", "uploads")
    const owner = ownerDir(profileId)
    const directory = resolve(base, owner)
    const full = resolve(directory, filename)
    if (!directory.startsWith(`${base}${sep}`) || dirname(full) !== directory) throw new Error("studio_failed")
    await mkdir(directory, { recursive: true })
    await writeFile(full, bytes)
    return `/uploads/${owner}/${filename}`
}

async function persistOptimizedModels(profileId: string, glbBytes: Buffer, productTitle?: string) {
    const stem = newId()
    const set = await optimizeModelSet(glbBytes, arSizeFor(productTitle || stem))
    const glbUrl = await persistBytes(profileId, `${stem}.glb`, set.web)
    await persistBytes(profileId, `${stem}-ar.glb`, set.ar)
    const usdzUrl = set.usdz ? await persistBytes(profileId, `${stem}.usdz`, set.usdz) : null
    return { glbUrl, usdzUrl }
}

function mapRow(row: Record<string, unknown>): ArBuildRow {
    return {
        id: String(row.id),
        profileId: String(row.profileId),
        productId: String(row.productId),
        batchId: String(row.batchId),
        imageUrl: String(row.imageUrl),
        status: row.status as ArBuildStatus,
        providerTaskId: (row.providerTaskId as string) || null,
        glbUrl: (row.glbUrl as string) || null,
        usdzUrl: (row.usdzUrl as string) || null,
        credits: Number(row.credits),
        costCents: Number(row.costCents),
        chargeCents: Number(row.chargeCents),
        stripeSessionId: (row.stripeSessionId as string) || null,
        error: (row.error as string) || null,
        createdAt: row.createdAt as Date,
        updatedAt: row.updatedAt as Date,
        title: typeof row.title === "string" ? row.title : undefined,
    }
}

export function publicBuild(row: ArBuildRow) {
    return {
        id: row.id,
        productId: row.productId,
        batchId: row.batchId,
        imageUrl: row.imageUrl,
        status: row.status,
        glbUrl: row.glbUrl,
        usdzUrl: row.usdzUrl,
        chargeCents: row.chargeCents,
        error: row.error ? publicError(row.error) : null,
        title: row.title,
    }
}

export async function createBatch(input: {
    profileId: string
    items: { productId: string; imageUrl: string }[]
}) {
    await ensureArBuildTable()
    const batchId = newId()
    const charge = arChargeCents(1)
    const cost = arCostCents(1)
    for (const item of input.items) {
        const id = newId()
        await prisma.$executeRaw`
            INSERT INTO "ArBuild" (id, "profileId", "productId", "batchId", "imageUrl", status, credits, "costCents", "chargeCents", "createdAt", "updatedAt")
            VALUES (${id}, ${input.profileId}, ${item.productId}, ${batchId}, ${item.imageUrl}, 'DRAFT', ${AR_CREDITS_PER_ITEM}, ${cost}, ${charge}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
    }
    return batchId
}

export async function markBatchPaid(batchId: string, stripeSessionId?: string | null) {
    await ensureArBuildTable()
    await prisma.$executeRaw`
        UPDATE "ArBuild"
        SET status = 'PAID', "stripeSessionId" = ${stripeSessionId || null}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "batchId" = ${batchId} AND status = 'DRAFT'
    `
}

export async function listBatch(batchId: string, profileId?: string) {
    await ensureArBuildTable()
    const rows = profileId
        ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT b.*, p.title
            FROM "ArBuild" b
            JOIN "DigitalProduct" p ON p.id = b."productId"
            WHERE b."batchId" = ${batchId} AND b."profileId" = ${profileId}
            ORDER BY b."createdAt" ASC
        `
        : await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT b.*, p.title
            FROM "ArBuild" b
            JOIN "DigitalProduct" p ON p.id = b."productId"
            WHERE b."batchId" = ${batchId}
            ORDER BY b."createdAt" ASC
        `
    return rows.map(mapRow)
}

export async function tickBatch(batchId: string, profileId: string) {
    const rows = await listBatch(batchId, profileId)
    for (const row of rows) {
        if (row.status === "PAID") await startJob(row)
        else if (row.status === "RUNNING") await pollJob(row)
    }
    return (await listBatch(batchId, profileId)).map(publicBuild)
}

async function startJob(row: ArBuildRow) {
    try {
        await prisma.$executeRaw`
            UPDATE "ArBuild" SET status = 'RUNNING', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id} AND status = 'PAID'
        `
        const dataUri = await imageToDataUri(row.imageUrl)
        const taskId = await createImageTo3dTask(dataUri)
        await prisma.$executeRaw`
            UPDATE "ArBuild" SET "providerTaskId" = ${taskId}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}
        `
    } catch (err) {
        const code = err instanceof Error ? err.message : "studio_failed"
        await prisma.$executeRaw`
            UPDATE "ArBuild" SET status = 'FAILED', error = ${code.slice(0, 80)}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}
        `
    }
}

async function pollJob(row: ArBuildRow) {
    if (!row.providerTaskId) return
    try {
        const task = await getImageTo3dTask(row.providerTaskId)
        if (task.status === "PENDING" || task.status === "IN_PROGRESS") return
        if (task.status !== "SUCCEEDED") {
            await prisma.$executeRaw`
                UPDATE "ArBuild" SET status = 'FAILED', error = 'studio_failed', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}
            `
            return
        }
        const glbSrc = task.model_urls?.glb
        if (!glbSrc) throw new Error("studio_failed")
        const glbBytes = await downloadAsset(glbSrc)
        const { glbUrl, usdzUrl } = await persistOptimizedModels(row.profileId, glbBytes, row.title)
        await prisma.$executeRaw`
            UPDATE "ArBuild"
            SET status = 'READY', "glbUrl" = ${glbUrl}, "usdzUrl" = ${usdzUrl}, error = NULL, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
        `
        await prisma.digitalProduct.updateMany({
            where: { id: row.productId, profileId: row.profileId },
            data: { arModelUrl: glbUrl, arUsdzUrl: usdzUrl },
        })
    } catch (err) {
        const code = err instanceof Error ? err.message : "studio_failed"
        await prisma.$executeRaw`
            UPDATE "ArBuild" SET status = 'FAILED', error = ${code.slice(0, 80)}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}
        `
    }
}
