// @vitest-environment node
import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { copyFile, mkdir, mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { promisify } from "node:util"
import { PrismaClient } from "@prisma/client"
import { afterAll, describe, expect, it } from "vitest"

const target = process.env.INTROIFY_BILLING_TEST_DATABASE_URL
const isolated = target && target === process.env.DATABASE_URL && /^postgresql:\/\/introify_test@127\.0\.0\.1:\d+\/introify_billing_integration(?:_migrated)?\?schema=public$/.test(target)
const suite = isolated ? describe : describe.skip
const root = resolve(import.meta.dirname, "..")
const foundation = "20260909110000_ar_build_foundation"
const billing = "20260909120000_platform_billing"
const clients: PrismaClient[] = []
const execute = promisify(execFile)

async function rehearsal(omitFoundation = false) {
    if (!isolated) throw new Error("Only the explicitly selected disposable loopback database is allowed")
    const admin = new PrismaClient({ datasourceUrl: target })
    clients.push(admin)
    const database = `introify_migration_chain_${randomUUID().replaceAll("-", "")}`
    // The identifier contains only our fixed prefix and random hexadecimal digits.
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    const url = new URL(target!)
    url.pathname = `/${database}`
    const db = new PrismaClient({ datasourceUrl: url.href })
    clients.push(db)
    const directory = await mkdtemp(join(tmpdir(), "introify-migration-chain-"))
    const schema = join(directory, "schema.prisma")
    await copyFile(join(root, "prisma/schema.prisma"), schema)
    await mkdir(join(directory, "migrations"))
    await copyFile(join(root, "prisma/migrations/migration_lock.toml"), join(directory, "migrations/migration_lock.toml"))
    const entries = await readdir(join(root, "prisma/migrations"), { withFileTypes: true })
    const migrations = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    const addMigration = async (name: string) => {
        await mkdir(join(directory, "migrations", name), { recursive: true })
        await copyFile(join(root, "prisma/migrations", name, "migration.sql"), join(directory, "migrations", name, "migration.sql"))
    }
    for (const name of migrations) if (!omitFoundation || name !== foundation) await addMigration(name)
    // Run Prisma outside the project so it cannot load the application's .env.
    // No db push, reset or schema substitution is used: every SQL file is copied verbatim.
    const runNode = (script: string, args: string[] = []) => execute(process.execPath, [script, ...args], {
        cwd: directory,
        env: { ...process.env, DATABASE_URL: url.href, DIRECT_URL: "", PRISMA_HIDE_UPDATE_MESSAGE: "true" },
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
    })
    const cli = (...args: string[]) => runNode(join(root, "node_modules/prisma/build/index.js"), [...args, "--schema", schema])
    const recover = () => runNode(join(root, "scripts/recover-billing-baseline.mjs"))
    return { db, cli, recover, directory, migrations, addMigration }
}

async function seedExistingRecords(db: PrismaClient) {
    const unique = randomUUID().replaceAll("-", "")
    // Raw inserts work both before and after the additive billing columns exist.
    await db.$executeRaw`INSERT INTO "User" (id, "clerkId", email, "updatedAt") VALUES (${unique}, ${`fixture-${unique}`}, ${`${unique}@example.test`}, CURRENT_TIMESTAMP)`
    await db.$executeRaw`INSERT INTO "Profile" (id, "userId", slug, "displayName", "updatedAt") VALUES (${unique}, ${unique}, ${unique}, 'Preserved business', CURRENT_TIMESTAMP)`
    await db.$executeRaw`INSERT INTO "DigitalProduct" (id, "profileId", title, "updatedAt") VALUES (${unique}, ${unique}, 'Preserved product', CURRENT_TIMESTAMP)`
    return unique
}

suite("tracked migration chain on disposable PostgreSQL", () => {
    // Keep fixture databases/files for inspection; never reset or delete a database.
    afterAll(async () => { await Promise.all(clients.map(client => client.$disconnect())) })

    it("replays the complete tracked chain without relying on db-pushed schema", async () => {
        const test = await rehearsal()
        await test.cli("migrate", "deploy")
        const rows = await test.db.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`
        expect(rows.map(row => row.migration_name)).toEqual(test.migrations)
        expect(await test.db.arBuild.count()).toBe(0)
        expect(await test.db.billingAccount.count()).toBe(0)
        const [{ token }] = await test.db.$queryRaw<{ token: bigint }[]>`SELECT nextval('"BillingObservationSequence"') AS token`
        expect(token).toBeGreaterThan(BigInt(0))
    }, 120_000)

    it("preserves existing AR rows and Restrict foreign keys when the foundation SQL is repeated", async () => {
        const test = await rehearsal()
        await test.cli("migrate", "deploy")
        const unique = await seedExistingRecords(test.db)
        await test.db.arBuild.create({ data: { id: unique, profileId: unique, productId: unique, batchId: "preserved", imageUrl: "/uploads/fixture/photo.jpg", status: "READY", credits: 30, costCents: 60, chargeCents: 0, glbUrl: "/uploads/fixture/model.glb" } })
        const before = await test.db.arBuild.findUniqueOrThrow({ where: { id: unique } })
        const foreignKeys = () => test.db.$queryRaw<{ conname: string; definition: string }[]>`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = '"ArBuild"'::regclass AND contype = 'f' ORDER BY conname`
        const constraints = await foreignKeys()
        expect(constraints).toHaveLength(2)
        expect(constraints.every(item => item.definition.includes("ON DELETE RESTRICT"))).toBe(true)
        await test.cli("db", "execute", "--file", join(test.directory, "migrations", foundation, "migration.sql"))
        expect(await test.db.arBuild.findUniqueOrThrow({ where: { id: unique } })).toEqual(before)
        expect(await foreignKeys()).toEqual(constraints)
    }, 120_000)

    it("recovers the first-statement missing-table failure without replacing business data", async () => {
        const test = await rehearsal(true)
        await expect(test.cli("migrate", "deploy")).rejects.toThrow()
        const failed = await test.db.$queryRaw<{ migration_name: string; logs: string; applied_steps_count: number }[]>`SELECT migration_name, logs, applied_steps_count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`
        expect(failed).toHaveLength(1)
        expect(failed[0].migration_name).toBe(billing)
        expect(failed[0].logs).toContain('relation "ArBuild" does not exist')
        expect(failed[0].applied_steps_count).toBe(0)
        const [{ ar, account }] = await test.db.$queryRaw<{ ar: string | null; account: string | null }[]>`SELECT to_regclass('"ArBuild"')::text AS ar, to_regclass('"BillingAccount"')::text AS account`
        expect(ar).toBeNull()
        expect(account).toBeNull()
        const unique = await seedExistingRecords(test.db)
        await test.addMigration(foundation)
        expect((await test.recover()).stdout).toContain("Failed record resolved")
        expect((await test.recover()).stdout).not.toContain("Failed record resolved")
        await test.cli("migrate", "deploy")
        expect((await test.db.profile.findUniqueOrThrow({ where: { id: unique } })).displayName).toBe("Preserved business")
        expect((await test.db.digitalProduct.findUniqueOrThrow({ where: { id: unique } })).title).toBe("Preserved product")
        expect(await test.db.billingAccount.count({ where: { ownerUserId: unique } })).toBe(1)
        expect(await test.db.billingAccountMember.count({ where: { userId: unique, role: "OWNER" } })).toBe(1)
        expect(await test.db.arBuild.count()).toBe(0)
        const unresolved = await test.db.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`
        expect(unresolved[0].count).toBe(BigInt(0))
        expect((await test.recover()).stdout).not.toContain("Failed record resolved")
    }, 120_000)
})
