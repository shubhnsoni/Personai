import { createHash } from "node:crypto"
import { lstat, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { prisma } from "@/lib/prisma"
import { uploadReadDirectories } from "@/lib/uploads-storage"

/** Inventory legacy files once. Shared bundled site assets are not customer storage. */
export async function backfillAccountStorage(accountId: string) {
    const markerId = `storage-inventory-v1:${accountId}`
    if (await prisma.billingAuditEvent.findUnique({ where: { id: markerId }, select: { id: true } })) return
    const profiles = await prisma.profile.findMany({ where: { billingAccountId: accountId }, select: { id: true } })
    const files = new Map<string, { profileId: string; path: string; bytes: bigint }>()
    for (const profile of profiles) {
        const owner = createHash("sha256").update(profile.id).digest("hex").slice(0, 32)
        for (const root of uploadReadDirectories()) {
            const directory = resolve(root, owner)
            try {
                const folder = await lstat(directory)
                if (!folder.isDirectory() || folder.isSymbolicLink()) continue
                for (const name of await readdir(directory)) {
                    if (!/^[a-z0-9_-][a-z0-9._-]*$/i.test(name)) continue
                    const path = `/uploads/${owner}/${name}`
                    if (files.has(path)) continue
                    const stat = await lstat(resolve(directory, name))
                    if (stat.isFile() && !stat.isSymbolicLink()) files.set(path, { profileId: profile.id, path, bytes: BigInt(stat.size) })
                }
            } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
        }
    }
    await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "BillingAccount" WHERE id = ${accountId} FOR UPDATE`
        if (await tx.billingAuditEvent.findUnique({ where: { id: markerId } })) return
        await tx.billingStorageObject.createMany({ data: [...files.values()].map(file => ({ accountId, ...file })), skipDuplicates: true })
        await tx.billingAuditEvent.create({ data: { id: markerId, accountId, kind: "LEGACY_STORAGE_INVENTORIED", metadata: { files: files.size } } })
    }, { timeout: 20_000 })
}
