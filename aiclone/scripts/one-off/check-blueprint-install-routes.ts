/**
 * Blueprint installation: HTTP boundary harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database, inside one transaction that is
 * deliberately rolled back.
 *
 * The runtime harness proves the BEHAVIOUR. This proves the ENVELOPE: that every refusal leaves the
 * boundary as a documented status with the shared shape, that nothing leaks a connection string, and
 * that no date escapes as anything but an ISO string.
 *
 * THE 503 ASSERTION IS THE POINT OF THIS FILE. A dependency failure is the one path where a raw driver
 * error is most likely to reach a caller, and driver errors carry DSNs. So the failure injected here
 * deliberately CONTAINS a fake connection string with a password in it, and the response body is asserted
 * not to contain any part of it. Asserting "the body has a code" would pass with the DSN sitting next to
 * the code.
 *
 * NO SQL ERROR IS TRIGGERED ANYWHERE IN THIS FILE. In Postgres any SQL error aborts the enclosing
 * transaction, and these assertions share one - a single trigger refusal here would make every later
 * assertion fail with 25P02 while appearing to be about envelopes. Database-level refusals belong in
 * check-blueprint-install-schema.ts, where each gets its own transaction.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-blueprint-install-routes.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { BlueprintInstallService } from "../../src/lib/business-os/install"
import { BlueprintInstallApiService } from "../../src/lib/business-os/install-http"
import { InstallContext } from "../../src/lib/business-os/install-shared"
import { BlueprintPreviewService } from "../../src/lib/business-os/preview"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `bpiroutes_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "..", "..")

/** A DSN with a password, so "does the body leak it" is a real question and not a formality. */
const FAKE_DSN = "postgresql://install_user:sup3rs3cret@db.internal.example:5432/personalink?sslmode=require"

const OK_BLUEPRINT = "field-service-v1"

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

type Captured = { status: number; body: Record<string, unknown>; raw: string }

async function call(promise: Promise<Response>): Promise<Captured> {
    const response = await promise
    const raw = await response.text()
    let body: Record<string, unknown> = {}
    try {
        body = JSON.parse(raw) as Record<string, unknown>
    } catch {
        body = { unparseable: raw.slice(0, 200) }
    }
    return { status: response.status, body, raw }
}

function post(url: string, payload: unknown): Request {
    return new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    })
}
function del(url: string, payload: unknown): Request {
    return new Request(url, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    })
}

function errorCode(body: Record<string, unknown>): string {
    const error = body.error as { code?: string } | undefined
    return error?.code ?? ""
}

async function seed(tx: Tx) {
    const q = (s: string) => `${RUN}_${s}`
    const mk = (sql: string) => tx.$executeRawUnsafe(sql)
    for (const side of ["a", "b"] as const) {
        await mk(
            `insert into "User" ("id","clerkId","email","updatedAt") values ('${q(`u${side}`)}','clerk_${q(`u${side}`)}','${q(`u${side}`)}@example.test',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${q(`pr${side}`)}','${q(`u${side}`)}','${q(`pr${side}`)}','P',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${q(`ws${side}`)}','${q(`pr${side}`)}','WS','${q(`ws${side}`)}',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Membership" ("id","workspaceId","userId","role","updatedAt") values ('${q(`m${side}`)}','${q(`ws${side}`)}','${q(`u${side}`)}','OWNER',CURRENT_TIMESTAMP)`,
        )
    }
    return { wsA: q("wsa"), wsB: q("wsb"), userA: `clerk_${q("ua")}`, userB: `clerk_${q("ub")}` }
}

const BASE = "https://app.test/api/platform/workspaces"

async function main() {
    const url = process.env.DATABASE_URL
    const dbName = parseDatabaseName(url ?? "")
    assertDisposableTarget(url ?? "")
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${String(dbName)}`)
        process.exit(1)
    }

    // ---- structural: the verbs that exist, and the ones that must not ------
    const writeRoute = readFileSync(
        join(APP_ROOT, "src/app/api/platform/workspaces/[workspaceId]/blueprint/route.ts"),
        "utf8",
    )
    const planRoute = readFileSync(
        join(APP_ROOT, "src/app/api/platform/workspaces/[workspaceId]/blueprint/plan/route.ts"),
        "utf8",
    )
    for (const verb of ["GET", "POST", "DELETE"]) {
        check(
            `the blueprint route exports ${verb}`,
            new RegExp(`export\\s+async\\s+function\\s+${verb}\\b`).test(writeRoute),
            "present",
        )
    }
    checkInvertible(
        "the blueprint route exports no PUT and no PATCH - there is no edit-the-config path, because an edit is an upgrade",
        !/export\s+async\s+function\s+(PUT|PATCH)\b/.test(writeRoute),
        "no PUT, no PATCH",
    )
    checkInvertible(
        "the plan route is GET-only, so previewing an install cannot write",
        /export\s+async\s+function\s+GET\b/.test(planRoute) &&
            !/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(planRoute),
        "GET only",
    )

    const prisma = new PrismaClient()
    try {
        const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
        if (live[0].db !== AUTHORIZED_TARGET) {
            console.error(`ABORT: connected to ${live[0].db}`)
            process.exit(1)
        }
        const beforeWorkspaces = await prisma.workspace.count()

        try {
            await prisma.$transaction(
                async (tx) => {
                    const ids = await seed(tx)
                    const identity = new ControlledIdentity()
                    const client = tx as unknown as PrismaClient
                    const ctx = new InstallContext(client, new PersistedTenancy(client, identity))
                    const svc = new BlueprintInstallService(ctx, new BlueprintPreviewService(), {
                        runInTransaction: async (fn) => fn(tx),
                    })
                    const api = new BlueprintInstallApiService(svc)

                    // ---- 401 -----------------------------------------------
                    identity.current = null
                    const anonGet = await call(api.forWorkspace(ids.wsA))
                    checkInvertible("a signed-out read is 401", anonGet.status === 401, `status=${anonGet.status}`)
                    const anonPost = await call(
                        api.install(ids.wsA, post(`${BASE}/${ids.wsA}/blueprint`, { blueprintId: OK_BLUEPRINT, idempotencyKey: "k", actor: "a" })),
                    )
                    check("a signed-out install is 401", anonPost.status === 401, `status=${anonPost.status}`)
                    const anonDelete = await call(api.remove(ids.wsA, del(`${BASE}/${ids.wsA}/blueprint`, { idempotencyKey: "k", actor: "a" })))
                    check("a signed-out remove is 401", anonDelete.status === 401, `status=${anonDelete.status}`)

                    // ---- 200 -----------------------------------------------
                    identity.current = ids.userA
                    const emptyGet = await call(api.forWorkspace(ids.wsA))
                    checkInvertible("an owner's read is 200", emptyGet.status === 200, `status=${emptyGet.status}`)
                    const workspaceBody = (emptyGet.body.data as { workspace?: Record<string, unknown> }).workspace ?? {}
                    checkInvertible(
                        "the 200 reports installed: null explicitly rather than omitting the field",
                        Object.prototype.hasOwnProperty.call(workspaceBody, "installed") && workspaceBody.installed === null,
                        `installed=${JSON.stringify(workspaceBody.installed)}`,
                    )
                    check(
                        "the 200 carries limitations in the body rather than leaving them to a document",
                        Array.isArray(workspaceBody.limitations) && (workspaceBody.limitations as unknown[]).length > 0,
                        `${(workspaceBody.limitations as unknown[] | undefined)?.length ?? 0} limitation(s)`,
                    )

                    const planned = await call(api.plan(ids.wsA, OK_BLUEPRINT))
                    checkInvertible("a plan request is 200", planned.status === 200, `status=${planned.status}`)
                    const planBody = (planned.body.data as { plan?: Record<string, unknown> }).plan ?? {}
                    checkInvertible(
                        "the plan reports permissionChanges as an explicit empty array, so a caller can see the question was answered",
                        Array.isArray(planBody.permissionChanges) && (planBody.permissionChanges as unknown[]).length === 0,
                        JSON.stringify(planBody.permissionChanges),
                    )
                    check(
                        "the plan nests the full preview, reusing it rather than restating it",
                        typeof planBody.preview === "object" && planBody.preview !== null,
                        "preview present",
                    )
                    check(
                        "the nested preview still reports installed: null, because a plan is not an install",
                        (planBody.preview as Record<string, unknown>).installed === null,
                        "installed=null",
                    )

                    // ---- POST 200, and the shape it returns -----------------
                    const installed = await call(
                        api.install(
                            ids.wsA,
                            post(`${BASE}/${ids.wsA}/blueprint`, {
                                blueprintId: OK_BLUEPRINT,
                                idempotencyKey: `${RUN}-k1`,
                                actor: "owner:a",
                            }),
                        ),
                    )
                    checkInvertible("an install is 200", installed.status === 200, `status=${installed.status}`)
                    const installBody = installed.body.data as { outcome?: string; installation?: Record<string, unknown> }
                    checkInvertible("the install reports its outcome", installBody.outcome === "installed", String(installBody.outcome))
                    const installation = installBody.installation ?? {}
                    checkInvertible(
                        "installedAt crosses the boundary as an ISO STRING, never a Date",
                        typeof installation.installedAt === "string" && !Number.isNaN(Date.parse(installation.installedAt as string)),
                        `${typeof installation.installedAt}: ${String(installation.installedAt)}`,
                    )
                    check(
                        "removedAt is null on an active installation rather than absent",
                        Object.prototype.hasOwnProperty.call(installation, "removedAt") && installation.removedAt === null,
                        `removedAt=${JSON.stringify(installation.removedAt)}`,
                    )
                    check(
                        "every history line's occurredAt is an ISO string too",
                        Array.isArray(installation.history) &&
                            (installation.history as Array<{ occurredAt: unknown }>).every(
                                (h) => typeof h.occurredAt === "string" && !Number.isNaN(Date.parse(h.occurredAt as string)),
                            ),
                        `${(installation.history as unknown[] | undefined)?.length ?? 0} line(s)`,
                    )
                    check(
                        "the response is round-trippable JSON",
                        (() => {
                            try {
                                JSON.parse(JSON.stringify(installed.body))
                                return true
                            } catch {
                                return false
                            }
                        })(),
                    )

                    // ---- 409 -----------------------------------------------
                    const conflict = await call(
                        api.install(
                            ids.wsA,
                            post(`${BASE}/${ids.wsA}/blueprint`, {
                                blueprintId: OK_BLUEPRINT,
                                idempotencyKey: `${RUN}-k2`,
                                actor: "owner:a",
                            }),
                        ),
                    )
                    checkInvertible(
                        "installing what is already active is 409, not 200 and not 500",
                        conflict.status === 409 && errorCode(conflict.body) === "CONFLICT",
                        `status=${conflict.status} code=${errorCode(conflict.body)}`,
                    )
                    // A REPLAY is a success, not a conflict, and that difference is visible at the boundary.
                    const replay = await call(
                        api.install(
                            ids.wsA,
                            post(`${BASE}/${ids.wsA}/blueprint`, {
                                blueprintId: OK_BLUEPRINT,
                                idempotencyKey: `${RUN}-k1`,
                                actor: "owner:a",
                            }),
                        ),
                    )
                    checkInvertible(
                        "MEASURED: a genuine replay is 200 with outcome replayed - it is NOT a 409",
                        replay.status === 200 && (replay.body.data as { outcome?: string }).outcome === "replayed",
                        `status=${replay.status} outcome=${String((replay.body.data as { outcome?: string }).outcome)}`,
                    )

                    // ---- 400 -----------------------------------------------
                    const blankBp = await call(
                        api.install(ids.wsA, post(`${BASE}/${ids.wsA}/blueprint`, { blueprintId: "  ", idempotencyKey: "k", actor: "a" })),
                    )
                    checkInvertible(
                        "a blank blueprintId is 400",
                        blankBp.status === 400 && errorCode(blankBp.body) === "BAD_REQUEST",
                        `status=${blankBp.status} code=${errorCode(blankBp.body)}`,
                    )
                    const missingBody = await call(
                        api.install(ids.wsA, post(`${BASE}/${ids.wsA}/blueprint`, { idempotencyKey: "k", actor: "a" })),
                    )
                    check("a missing blueprintId is 400 rather than an install of undefined", missingBody.status === 400, `status=${missingBody.status}`)
                    const blankPlan = await call(api.plan(ids.wsA, ""))
                    check("a plan with no blueprintId is 400", blankPlan.status === 400, `status=${blankPlan.status}`)

                    // ---- 404, and that it is not an oracle ------------------
                    const unknown = await call(api.plan(ids.wsA, "nonsense-v9"))
                    checkInvertible(
                        "an unknown blueprint id is 404, because a blueprint id is a public static registry key",
                        unknown.status === 404 && errorCode(unknown.body) === "NOT_FOUND",
                        `status=${unknown.status} code=${errorCode(unknown.body)}`,
                    )

                    // ---- 403, and NON-ENUMERATION --------------------------
                    identity.current = ids.userB
                    const foreign = await call(api.forWorkspace(ids.wsA))
                    const missing = await call(api.forWorkspace(`${RUN}_does_not_exist`))
                    checkInvertible(
                        "MEASURED: at the boundary, a foreign workspace and a nonexistent one are BYTE-IDENTICAL",
                        foreign.status === missing.status && foreign.raw === missing.raw && foreign.status === 403,
                        `${foreign.status}/${missing.status} ${foreign.raw}`,
                    )
                    const foreignPost = await call(
                        api.install(ids.wsA, post(`${BASE}/${ids.wsA}/blueprint`, { blueprintId: OK_BLUEPRINT, idempotencyKey: "k", actor: "b" })),
                    )
                    const missingPost = await call(
                        api.install(`${RUN}_nope`, post(`${BASE}/x/blueprint`, { blueprintId: OK_BLUEPRINT, idempotencyKey: "k", actor: "b" })),
                    )
                    checkInvertible(
                        "MEASURED: install refuses foreign and nonexistent workspaces byte-identically",
                        foreignPost.raw === missingPost.raw && foreignPost.status === 403,
                        `${foreignPost.status}/${missingPost.status} ${foreignPost.raw}`,
                    )
                    const oracle = await call(api.plan(ids.wsA, "nonsense-v9"))
                    checkInvertible(
                        "MEASURED: an unauthorised caller gets 403 even for a nonexistent blueprint, so 404 is not a registry oracle",
                        oracle.status === 403,
                        `status=${oracle.status}`,
                    )

                    // ---- the shared envelope, per status --------------------
                    identity.current = ids.userA
                    const ok = await call(api.forWorkspace(ids.wsA))
                    check("the 200 envelope is { ok, data }", Object.keys(ok.body).sort().join(",") === "data,ok", Object.keys(ok.body).sort().join(","))
                    for (const [label, captured] of [
                        ["400", blankBp],
                        ["401", anonGet],
                        ["403", foreign],
                        ["404", unknown],
                        ["409", conflict],
                    ] as const) {
                        check(
                            `the ${label} envelope is { ok, error }`,
                            Object.keys(captured.body).sort().join(",") === "error,ok",
                            Object.keys(captured.body).sort().join(","),
                        )
                        check(`the ${label} body says ok: false`, captured.body.ok === false, `ok=${String(captured.body.ok)}`)
                    }

                    throw new Rollback("done")
                },
                { timeout: 120_000 },
            )
        } catch (e) {
            if (!(e instanceof Rollback)) throw e
        }

        // ===================================================================
        // 503, with a DSN-bearing failure. Outside the transaction, because the
        // failure is injected rather than caused by SQL.
        // ===================================================================
        const identity = new ControlledIdentity()
        identity.current = "clerk_irrelevant"
        const brokenDb = {
            workspace: {
                findUnique: async () => {
                    throw new Error(`connect ECONNREFUSED - could not reach ${FAKE_DSN}`)
                },
            },
            user: {
                findUnique: async () => {
                    throw new Error(`connect ECONNREFUSED - could not reach ${FAKE_DSN}`)
                },
            },
        } as unknown as PrismaClient
        const brokenCtx = new InstallContext(brokenDb, new PersistedTenancy(brokenDb, identity))
        const brokenApi = new BlueprintInstallApiService(
            new BlueprintInstallService(brokenCtx, new BlueprintPreviewService()),
        )
        const unavailable = await call(brokenApi.forWorkspace("any-workspace"))
        checkInvertible(
            "a dependency failure is 503, not a 500 and not a stack trace",
            unavailable.status === 503 && errorCode(unavailable.body) === "DEPENDENCY_UNAVAILABLE",
            `status=${unavailable.status} code=${errorCode(unavailable.body)}`,
        )
        // THE assertion of this file. Every distinctive fragment of the DSN, checked individually.
        const leaked = [
            FAKE_DSN,
            "sup3rs3cret",
            "install_user",
            "db.internal.example",
            "postgresql://",
            "5432",
            "sslmode",
            "ECONNREFUSED",
        ].filter((fragment) => unavailable.raw.includes(fragment))
        checkInvertible(
            "MEASURED: the 503 body leaks no part of the DSN - not the password, host, user, port, scheme or driver text",
            leaked.length === 0,
            leaked.length ? `LEAKED: ${leaked.join(", ")}` : `none of 8 fragments; body=${unavailable.raw}`,
        )
        checkInvertible(
            "the 503 names THIS surface rather than the one whose envelope helper it reuses",
            /Blueprint installation is temporarily unavailable/.test(unavailable.raw),
            unavailable.raw,
        )
        check(
            "the 503 envelope is { ok, error } like every other refusal",
            Object.keys(unavailable.body).sort().join(",") === "error,ok",
            Object.keys(unavailable.body).sort().join(","),
        )

        const afterWorkspaces = await prisma.workspace.count()
        check(
            "harness left zero residue",
            afterWorkspaces === beforeWorkspaces,
            `Workspace ${beforeWorkspaces} -> ${afterWorkspaces}`,
        )
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} installation route assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} blueprint installation route assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("The installation boundary holds: documented statuses, one envelope, and no DSN.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
