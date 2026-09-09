// @vitest-environment node
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    client: vi.fn(), transaction: vi.fn(), query: vi.fn(), disconnect: vi.fn(), foundationMissing: false,
}))
vi.mock("node:module", async original => {
    const actual = await original<typeof import("node:module")>()
    return { ...actual, createRequire: (filename: string | URL) => {
        const real = actual.createRequire(filename)
        return Object.assign((id: string) => id === "@prisma/client" ? { PrismaClient: mocks.client } : real(id), { resolve: real.resolve, cache: real.cache, extensions: real.extensions, main: real.main })
    } }
})
vi.mock("node:fs", async original => {
    const actual = await original<typeof import("node:fs")>()
    return { ...actual, readFileSync: (...args: Parameters<typeof readFileSync>) => {
        if (mocks.foundationMissing && String(args[0]).includes("20260909110000_ar_build_foundation")) throw new Error("fixture: missing foundation")
        return actual.readFileSync(...args)
    } }
})

import { BILLING_MIGRATION, recoverBillingBaseline, recoveryDecision } from "../scripts/recover-billing-baseline.mjs"

const billingSql = readFileSync(new URL("../prisma/migrations/20260909120000_platform_billing/migration.sql", import.meta.url), "utf8")
const legacyNames = ["User", "Profile", "DigitalProduct", "Workspace", "Membership"]
const sha = (sql: string) => createHash("sha256").update(sql).digest("hex")
const failure = () => ({ migration_name: BILLING_MIGRATION, checksum: sha(billingSql), applied_steps_count: 0, logs: 'Database error code: 42P01\nDatabase error: ERROR: relation "ArBuild" does not exist' })
const clean = () => ({ failures: [failure()], relations: legacyNames.map(name => ({ name })), columns: [] as { table_name: string; column_name: string }[], schema: "public", billingSql })
const createdRelations = [
    ...[...billingSql.matchAll(/CREATE (?:TABLE|SEQUENCE|(?:UNIQUE )?INDEX) "([^"]+)"/g)].map(match => match[1]),
    ...[...billingSql.matchAll(/CONSTRAINT "([^"]+)" PRIMARY KEY/g)].map(match => match[1]),
]
// Deliberately include every added column, not only the legacy-table subset.
const addedColumns = [
    ["User", "emailVerifiedAt"], ["Profile", "billingAccountId"], ["Workspace", "billingAccountId"],
    ...["attempts", "leaseUntil", "nextAttemptAt", "recipe", "requestKey", "reservationId"].map(name => ["ArBuild", name]),
    ["PlatformSubscription", "lastObservationId"],
]

beforeEach(() => { vi.clearAllMocks(); mocks.foundationMissing = false })
afterEach(() => { vi.restoreAllMocks() })

describe("narrow missing-ArBuild recovery decision", () => {
    it("does nothing when no unresolved migration exists", () => {
        expect(recoveryDecision({ ...clean(), failures: [] })).toBe("not-needed")
        expect(recoveryDecision({ ...clean(), failures: [], schema: "other", relations: [] })).toBe("not-needed")
    })
    it("accepts only the recorded zero-step missing-table incident against an untouched legacy schema", () => {
        expect(recoveryDecision(clean())).toBe("resolve-missing-ar-build")
    })
    it.each(["LF", "CRLF"])("accepts a checksum of the same migration with %s line endings", lineEndings => {
        const sql = billingSql.replaceAll("\r\n", "\n")
        const checksum = sha(lineEndings === "CRLF" ? sql.replaceAll("\n", "\r\n") : sql)
        expect(recoveryDecision({ ...clean(), failures: [{ ...failure(), checksum }] })).toBe("resolve-missing-ar-build")
    })
    it.each([
        { checksum: "0".repeat(64) },
        { migration_name: "20260909110000_ar_build_foundation" },
        { applied_steps_count: 1 }, { applied_steps_count: -1 }, { applied_steps_count: null }, { applied_steps_count: "0" },
        { logs: 'Database error code: 42P07; relation "ArBuild" does not exist' },
        { logs: 'Database error code: 42P01; relation "OtherTable" does not exist' },
        { logs: 'Database error code: 42P01; relation "ArBuild" already exists' },
        { logs: null },
    ])("refuses changed migration/checksum/step/error evidence %#", change => {
        expect(() => recoveryDecision({ ...clean(), failures: [{ ...failure(), ...change }] })).toThrow("Recovery refused")
    })
    it("refuses multiple unresolved migrations even when one matches", () => {
        expect(() => recoveryDecision({ ...clean(), failures: [failure(), { ...failure(), migration_name: "other" }] })).toThrow("Recovery refused")
    })
    it.each(["other", "Public", "", null])("refuses a failed migration in schema %s", schema => {
        expect(() => recoveryDecision({ ...clean(), schema })).toThrow("Recovery refused")
    })
    it("refuses a changed SQL entry point even if its supplied checksum matches", () => {
        const changedSql = billingSql.replace('ALTER TABLE "ArBuild" DROP CONSTRAINT "ArBuild_profileId_fkey";', 'ALTER TABLE "User" ADD COLUMN "unexpected" TEXT;')
        expect(() => recoveryDecision({ ...clean(), billingSql: changedSql, failures: [{ ...failure(), checksum: sha(changedSql) }] })).toThrow("entry point changed")
    })
    it("does not confuse a local SQL edit with a line-ending change", () => {
        expect(() => recoveryDecision({ ...clean(), billingSql: `${billingSql}\n-- changed migration content` })).toThrow("verified missing-table incident")
    })
    it("refuses an existing ArBuild relation regardless of row count or type", () => {
        expect(() => recoveryDecision({ ...clean(), relations: [...clean().relations, { name: "ArBuild" }] })).toThrow("structures already exist")
    })
    it.each(createdRelations)("refuses partial/colliding migration relation %s", name => {
        expect(() => recoveryDecision({ ...clean(), relations: [...clean().relations, { name }] })).toThrow("structures already exist")
    })
    it.each(addedColumns)("refuses an already-added column %s.%s", (table_name, column_name) => {
        expect(() => recoveryDecision({ ...clean(), columns: [{ table_name, column_name }] })).toThrow("partially applied")
    })
    it.each(legacyNames)("refuses missing required legacy table %s", missing => {
        expect(() => recoveryDecision({ ...clean(), relations: clean().relations.filter(row => row.name !== missing) })).toThrow("legacy structure is missing")
    })
    it("permits unrelated legacy relations and columns without touching them", () => {
        expect(recoveryDecision({ ...clean(), relations: [...clean().relations, { name: "LegacyAudit" }], columns: [{ table_name: "Profile", column_name: "displayName" }] })).toBe("resolve-missing-ar-build")
    })
})

const pooled = "postgresql://fixture:fake-only@ep-recovery-test-pooler.us-east-2.aws.neon.tech/fixture?sslmode=require&schema=public"
const direct = "postgresql://fixture:fake-only@direct.example.test/fixture?sslmode=require&schema=public"
const testEnv = Object.freeze({ DATABASE_URL: pooled, DIRECT_URL: direct, NODE_ENV: "test", FIXTURE_SETTING: "preserved" })
function database(state = clean(), options: { migrations?: string | null; remaining?: { migration_name: string }[] } = {}) {
    mocks.client.mockImplementation(function MockPrismaClient() { return { $transaction: mocks.transaction, $disconnect: mocks.disconnect } })
    mocks.transaction.mockImplementation(async callback => callback({ $queryRawUnsafe: mocks.query }))
    mocks.disconnect.mockResolvedValue(undefined)
    mocks.query.mockImplementation(async (sql: string) => {
        if (sql.includes("pg_advisory_xact_lock")) return [{ locked: "" }]
        if (sql.includes("current_schema()")) return [{ schema: state.schema, migrations: options.migrations === undefined ? "_prisma_migrations" : options.migrations }]
        if (sql.includes("SELECT migration_name, checksum")) return state.failures
        if (sql.includes("FROM pg_class")) return state.relations
        if (sql.includes("information_schema.columns")) return state.columns
        if (sql.includes("SELECT migration_name FROM")) return options.remaining || []
        throw new Error(`Unexpected fixture query: ${sql}`)
    })
    return vi.fn(() => ({ status: 0, error: undefined }))
}

describe("recovery command orchestration without a real provider", () => {
    beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}) })
    it("does not connect or spawn a command on import", () => {
        expect(mocks.client).not.toHaveBeenCalled()
    })
    it("uses the direct connection only for the inspected Prisma client and one supported resolve child", async () => {
        const execute = database()
        await expect(recoverBillingBaseline(testEnv, execute as never)).resolves.toBe("resolved")
        expect(mocks.client).toHaveBeenCalledWith({ datasources: { db: { url: direct } }, log: [] })
        expect(execute).toHaveBeenCalledOnce()
        const [command, args, options] = execute.mock.calls[0] as unknown as [string, string[], { env: Record<string, string>; stdio: string; windowsHide: boolean; timeout: number }]
        expect(command).toBe(process.execPath)
        expect(args.slice(1)).toEqual(["migrate", "resolve", "--rolled-back", BILLING_MIGRATION])
        expect(args[0].replaceAll("\\", "/")).toMatch(/\/prisma\/build\/index\.js$/)
        expect(options).toMatchObject({ windowsHide: true, timeout: 60000, stdio: "pipe", maxBuffer: 65536 })
        expect(options.env).toMatchObject({ DATABASE_URL: direct, FIXTURE_SETTING: "preserved" })
        expect(options.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK).toBeUndefined()
        expect(testEnv.DATABASE_URL).toBe(pooled)
        expect(args.join(" ")).not.toContain("fake-only")
        expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 90000, maxWait: 10000 })
        expect(mocks.query.mock.calls[0][0]).toContain("pg_advisory_xact_lock")
        expect(mocks.query.mock.calls.filter(([sql]) => String(sql).includes('FROM "_prisma_migrations"'))).toHaveLength(2)
        expect(mocks.disconnect).toHaveBeenCalledOnce()
    })
    it.each(["no table", "no failures"])("does not resolve when there is %s", async situation => {
        const state = clean()
        if (situation === "no failures") state.failures = []
        const execute = database(state, { migrations: situation === "no table" ? null : undefined })
        await expect(recoverBillingBaseline(testEnv, execute as never)).resolves.toBe("not-needed")
        expect(execute).not.toHaveBeenCalled()
        expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("FROM pg_class"))).toBe(false)
        expect(mocks.disconnect).toHaveBeenCalledOnce()
    })
    it("refuses partial schema before executing any metadata change", async () => {
        const execute = database({ ...clean(), relations: [...clean().relations, { name: "BillingAccount" }] })
        await expect(recoverBillingBaseline(testEnv, execute as never)).rejects.toThrow("structures already exist")
        expect(execute).not.toHaveBeenCalled()
        expect(mocks.disconnect).toHaveBeenCalledOnce()
    })
    it("refuses a missing prerequisite file before creating any DB client", async () => {
        const execute = database()
        mocks.foundationMissing = true
        await expect(recoverBillingBaseline(testEnv, execute as never)).rejects.toThrow("missing foundation")
        expect(mocks.client).not.toHaveBeenCalled()
        expect(execute).not.toHaveBeenCalled()
    })
    it("rejects invalid connection data without exposing or contacting it", async () => {
        const execute = database()
        await expect(recoverBillingBaseline({ DATABASE_URL: "invalid-fake-credential-value", NODE_ENV: "test" }, execute as never)).rejects.toThrow("valid PostgreSQL connection URL")
        expect(mocks.client).not.toHaveBeenCalled()
        expect(execute).not.toHaveBeenCalled()
    })
    it.each([{ status: 7 }, { status: null }, { status: 0, error: new Error("fake-driver-connection-secret") }])("stops on child failure %# and never retries or deploys", async result => {
        const execute = database()
        execute.mockReturnValue(result as ReturnType<typeof execute>)
        await expect(recoverBillingBaseline(testEnv, execute as never)).rejects.toThrow("Prisma could not resolve")
        expect(execute).toHaveBeenCalledOnce()
        expect(mocks.disconnect).toHaveBeenCalledOnce()
        expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("fake-driver-connection-secret")
    })
    it("checks unresolved records again after successful resolve", async () => {
        const execute = database(clean(), { remaining: [{ migration_name: BILLING_MIGRATION }] })
        await expect(recoverBillingBaseline(testEnv, execute as never)).rejects.toThrow("unresolved migration remains")
        expect(execute).toHaveBeenCalledOnce()
        expect(mocks.disconnect).toHaveBeenCalledOnce()
    })
    it("disconnects and never runs resolve after an inspection failure", async () => {
        const execute = database()
        mocks.query.mockRejectedValue(new Error("fixture query failed"))
        await expect(recoverBillingBaseline(testEnv, execute as never)).rejects.toThrow("fixture query failed")
        expect(execute).not.toHaveBeenCalled()
        expect(mocks.disconnect).toHaveBeenCalledOnce()
    })
})
