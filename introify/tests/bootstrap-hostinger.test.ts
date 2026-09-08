import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { bootstrapDatabase } from "../scripts/bootstrap-hostinger.mjs"

type Row = Record<string, unknown>
type State = { presets: Row[]; users: Row[]; profiles: Row[]; workspaces: Row[] }

// A transaction-local store: writes commit together, exceptions discard them,
// and the advisory lock is shared between concurrent bootstrap invocations.
// Deliberately exposes no update, upsert or delete operations.
function memoryDatabase(initial: Partial<State> = {}, profileErrors: Error[] = []) {
    let state: State = structuredClone({ presets: [], users: [], profiles: [], workspaces: [], ...initial })
    let lockTail = Promise.resolve()
    let nextId = 0
    const transaction = vi.fn(async (run: (tx: object) => Promise<unknown>) => {
        let staged: State | undefined
        let release: (() => void) | undefined
        function table(key: keyof State) {
            const rows = () => {
                if (!staged) throw new Error("Must acquire the transaction lock before reading or writing")
                return staged[key]
            }
            return {
                findMany: async () => structuredClone(rows()),
                findUnique: async ({ where }: { where: Row }) =>
                    structuredClone(rows().find((row) => Object.entries(where).every(([field, value]) => row[field] === value)) || null),
                create: async ({ data }: { data: Row }) => {
                    if (key === "profiles" && profileErrors.length) throw profileErrors.shift()
                    const created = structuredClone({ id: `created-${++nextId}`, ...data })
                    const uniqueKeys = key === "users" ? ["id", "email", "clerkId"] : key === "presets" ? ["id"] : ["id", "slug"]
                    if (rows().some((row) => uniqueKeys.some((field) => created[field] !== undefined && row[field] === created[field]))) {
                        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
                    }
                    rows().push(created)
                    return structuredClone(created)
                },
            }
        }
        const tx = {
            $executeRaw: async (sql: TemplateStringsArray) => {
                expect(sql.join("")).toContain("pg_advisory_xact_lock")
                const previous = lockTail
                lockTail = new Promise<void>((resolve) => { release = resolve })
                await previous
                staged = structuredClone(state)
                return 1
            },
            welcomeAnimationPreset: table("presets"),
            user: table("users"),
            profile: table("profiles"),
            workspace: table("workspaces"),
        }
        try {
            const result = await run(tx)
            if (!staged) throw new Error("Missing transaction state")
            state = staged
            return result
        } finally {
            release?.()
        }
    })
    return {
        client: { $transaction: transaction } as unknown as PrismaClient,
        transaction,
        snapshot: () => structuredClone(state),
    }
}

describe("create-only deployment bootstrap", () => {
    it("creates welcome presets and a branded demo atomically, then changes nothing on rerun", async () => {
        const db = memoryDatabase()
        expect(await bootstrapDatabase(db.client)).toEqual({ presetsCreated: 10, demo: "created" })
        const first = db.snapshot()
        expect(first.presets.filter((row) => row.isDefault).map((row) => row.name)).toEqual(["Blob"])
        expect(first.users).toHaveLength(1)
        expect(first.profiles).toHaveLength(1)
        expect(first.profiles[0]).toMatchObject({
            slug: "demo", displayName: "Riley Vale", isPublic: true,
            serviceOfferings: { create: [expect.objectContaining({ name: "Strategy session" }), expect.any(Object)] },
            digitalProducts: { create: [expect.objectContaining({ title: "Offer stack workbook" }), expect.any(Object)] },
        })

        expect(await bootstrapDatabase(db.client)).toEqual({ presetsCreated: 0, demo: "existing" })
        expect(db.snapshot()).toEqual(first)
    })

    it("preserves existing preset aliases, custom defaults and all existing demo content", async () => {
        const presets = [
            { id: "legacy-aqua", name: "GlowOrb", config: "custom-aqua", isDefault: false },
            { id: "custom-default", name: "My animation", config: "custom-default", isDefault: true },
        ]
        const profile = { id: "custom-demo", slug: "demo", displayName: "Existing owner", isPublic: false, serviceOfferings: ["Customer edits"] }
        const db = memoryDatabase({ presets, profiles: [profile] })

        expect(await bootstrapDatabase(db.client)).toEqual({ presetsCreated: 9, demo: "existing" })
        const after = db.snapshot()
        expect(after.presets.slice(0, 2)).toEqual(presets)
        expect(after.presets.filter((row) => row.isDefault)).toEqual([presets[1]])
        expect(after.profiles).toEqual([profile])
        expect(after.users).toEqual([])
    })

    it("does not recreate a previously bootstrapped preset that was renamed", async () => {
        const renamed = { id: "introify-preset-aqua-v1", name: "Renamed by admin", config: "customized", isDefault: false }
        const db = memoryDatabase({ presets: [renamed], profiles: [{ id: "demo", slug: "demo" }] })
        expect(await bootstrapDatabase(db.client)).toEqual({ presetsCreated: 9, demo: "existing" })
        expect(db.snapshot().presets[0]).toEqual(renamed)
        expect(db.snapshot().presets.some((row) => row.name === "Aqua")).toBe(false)
    })

    it.each([
        { id: "existing-user", clerkId: "some-real-clerk-id", email: "demo@introify.com" },
        { id: "existing-user", clerkId: "mock-clerk-id-new", email: "another@example.com" },
    ])("does not adopt a conflicting demo identity: $clerkId", async (user) => {
        const db = memoryDatabase({ users: [user] })
        expect((await bootstrapDatabase(db.client)).demo).toBe("skipped-identity-conflict")
        expect(db.snapshot().users).toEqual([user])
        expect(db.snapshot().profiles).toEqual([])
    })

    it("preserves a workspace that already owns the demo slug", async () => {
        const workspace = { id: "existing-workspace", slug: "demo" }
        const db = memoryDatabase({ workspaces: [workspace] })
        expect((await bootstrapDatabase(db.client)).demo).toBe("skipped-workspace-conflict")
        expect(db.snapshot().workspaces).toEqual([workspace])
        expect(db.snapshot().users).toEqual([])
        expect(db.snapshot().profiles).toEqual([])
    })

    it("serializes simultaneous deployments without duplicate presets or demo records", async () => {
        const db = memoryDatabase()
        const results = await Promise.all(Array.from({ length: 3 }, () => bootstrapDatabase(db.client)))
        expect(results.filter((result) => result.demo === "created")).toHaveLength(1)
        expect(results.reduce((total, result) => total + result.presetsCreated, 0)).toBe(10)
        expect(db.snapshot().presets).toHaveLength(10)
        expect(db.snapshot().users).toHaveLength(1)
        expect(db.snapshot().profiles).toHaveLength(1)
    })

    it.each(["P2002", "P2034"])("retries a rolled-back %s conflict without partial or duplicate records", async (code) => {
        const db = memoryDatabase({}, [Object.assign(new Error("Concurrent write"), { code })])
        expect(await bootstrapDatabase(db.client)).toEqual({ presetsCreated: 10, demo: "created" })
        expect(db.transaction).toHaveBeenCalledTimes(2)
        expect(db.snapshot().presets).toHaveLength(10)
        expect(db.snapshot().users).toHaveLength(1)
        expect(db.snapshot().profiles).toHaveLength(1)
    })

    it("rolls back every new record when demo creation fails", async () => {
        const failure = new Error("Create failed")
        const db = memoryDatabase({}, [failure])
        const before = db.snapshot()
        await expect(bootstrapDatabase(db.client)).rejects.toBe(failure)
        expect(db.transaction).toHaveBeenCalledTimes(1)
        expect(db.snapshot()).toEqual(before)
    })
})
