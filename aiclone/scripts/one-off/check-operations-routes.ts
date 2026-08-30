/**
 * The operations HTTP boundary.
 *
 * check-operations-runtime.ts exercises the ENGINE directly. That leaves a real gap, and it is the
 * gap every other domain in this repository closes with a `-routes` harness: the boundary is where
 * status codes, envelope shape and leak-avoidance live, and none of those are visible from a service
 * call. A view can be perfectly tenant-scoped and still answer 500 with a connection string in it.
 *
 * So this asserts the boundary's own contract:
 *
 *   the shared envelope, byte-compatible with the rest of the platform surface;
 *   401 signed out, 403 for a workspace the caller is not in, 400 for a missing or malformed
 *   workspaceId and for an out-of-range horizon, 200 with a summary otherwise;
 *   503 when the database is unavailable, WITH the body asserted to contain no DSN, host or driver
 *   text - the failure injected here carries a fake connection string precisely so that the assertion
 *   can be about leakage rather than about a status code;
 *   the response is JSON-serialisable and its dates are ISO strings, because a Date that survives to
 *   the client as an object is a bug the engine harness cannot see;
 *   GET only - no write verb is exported by the route module.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-operations-routes.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { OperationsService } from "../../src/lib/operations/engine"
import { OperationsApiService } from "../../src/lib/operations/http"
import { OperationsContext } from "../../src/lib/operations/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wh2r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "../..")
const BASE = "http://operations.test/api/platform/operations/today"

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

type Called = Readonly<{ status: number; body: Record<string, unknown>; raw: string }>

async function call(promise: Promise<Response>): Promise<Called> {
    const response = await promise
    const raw = await response.text()
    let body: Record<string, unknown> = {}
    try {
        body = JSON.parse(raw) as Record<string, unknown>
    } catch {
        body = {}
    }
    return Object.freeze({ status: response.status, body, raw })
}

function get(url: string): Request {
    return new Request(url, { method: "GET" })
}
function errCode(called: Called): string {
    const error = called.body.error as { code?: string } | undefined
    return error?.code ?? ""
}
/** The serialized refusal, for byte-comparison rather than eyeballing. */
function refusal(called: Called): string {
    return JSON.stringify(called.body)
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
        await mk(
            `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","updatedAt")
             values ('${q(`job${side}`)}','${q(`pr${side}`)}','${q(`job${side}`)}','Callout','SCHEDULED','NORMAL','1 Example Street',CURRENT_TIMESTAMP)`,
        )
    }
    return { wsA: q("wsa"), wsB: q("wsb"), userA: `clerk_${q("ua")}`, userB: `clerk_${q("ub")}`, jobA: q("joba") }
}

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    // ---- structural: the route module exports a read verb and nothing else -----
    const routeSrc = readFileSync(join(APP_ROOT, "src/app/api/platform/operations/today/route.ts"), "utf8")
    checkInvertible(
        "the operations route exports GET and no write verb",
        /export async function GET\(/.test(routeSrc) && !/export async function (POST|PATCH|PUT|DELETE)\(/.test(routeSrc),
        "GET only",
    )
    check("the operations route is dynamic and runs on node", /force-dynamic/.test(routeSrc) && /runtime = "nodejs"/.test(routeSrc))

    const prisma = new PrismaClient()
    try {
        const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
        if (live[0].db !== AUTHORIZED_TARGET) {
            console.error(`ABORT: connected to ${live[0].db}`)
            process.exit(1)
        }
        const before = await prisma.fieldJob.count()

        try {
            await prisma.$transaction(async (tx) => {
                const ids = await seed(tx)
                const identity = new ControlledIdentity()
                const client = tx as unknown as PrismaClient
                const tenancy = new PersistedTenancy(client, identity)
                const api = new OperationsApiService(new OperationsService(new OperationsContext(client, tenancy)))

                // ---- 401 -------------------------------------------------------
                identity.current = null
                const anon = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible("a signed-out request is 401", anon.status === 401, `status=${anon.status} code=${errCode(anon)}`)

                // ---- 200 -------------------------------------------------------
                identity.current = ids.userA
                const ok = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible("a member's request is 200", ok.status === 200, `status=${ok.status}`)
                const data = ok.body.data as Record<string, unknown> | undefined
                checkInvertible(
                    "the 200 body carries the summary, its declared coverage and its stated absences",
                    Boolean(data) &&
                        typeof data!.total === "number" &&
                        Array.isArray(data!.domains) &&
                        Array.isArray(data!.covers) &&
                        typeof data!.doesNotCover === "object",
                    `keys=${Object.keys(data ?? {}).sort().join(",")}`,
                )
                // A Date that survived serialisation as an object is a bug the engine harness cannot see.
                checkInvertible(
                    "MEASURED: asOf is serialised as an ISO string, not as a Date object",
                    typeof data?.asOf === "string" && !Number.isNaN(Date.parse(String(data?.asOf))),
                    `asOf=${typeof data?.asOf}`,
                )
                const items = (data?.items ?? []) as Array<Record<string, unknown>>
                check(
                    "the caller's own field job appears in the items",
                    items.some((item) => item.id === ids.jobA),
                    `${items.length} items`,
                )
                check(
                    "every item's due date is an ISO string or null, never a Date object",
                    items.every((item) => item.at === null || typeof item.at === "string"),
                )
                check(
                    "the response is round-trippable JSON",
                    JSON.stringify(JSON.parse(ok.raw)) === JSON.stringify(ok.body),
                )

                // ---- 403 -------------------------------------------------------
                const foreign = await call(api.today(get(`${BASE}?workspaceId=${ids.wsB}`)))
                checkInvertible(
                    "asking for a workspace the caller is not a member of is 403",
                    foreign.status === 403,
                    `status=${foreign.status} code=${errCode(foreign)}`,
                )
                // A workspace that does not exist must refuse identically to one that does but is
                // foreign, or the status alone tells a caller which ids are real.
                const ghost = await call(api.today(get(`${BASE}?workspaceId=${RUN}_ghost_ws`)))
                checkInvertible(
                    "MEASURED: a foreign workspace and a nonexistent one are BYTE-IDENTICAL refusals",
                    refusal(foreign) === refusal(ghost) && foreign.status === ghost.status,
                    `${foreign.status}/${ghost.status} ${refusal(ghost)}`,
                )

                // ---- 400 -------------------------------------------------------
                const noWorkspace = await call(api.today(get(BASE)))
                checkInvertible(
                    "a missing workspaceId is 400 rather than a silent empty summary",
                    noWorkspace.status === 400 && errCode(noWorkspace) === "BAD_REQUEST",
                    `status=${noWorkspace.status} code=${errCode(noWorkspace)}`,
                )
                const blankWorkspace = await call(api.today(get(`${BASE}?workspaceId=%20`)))
                check("a whitespace-only workspaceId is 400, not treated as present", blankWorkspace.status === 400)

                const badHorizon = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=abc`)))
                checkInvertible(
                    "a non-numeric horizon is 400 rather than silently defaulted",
                    badHorizon.status === 400,
                    `status=${badHorizon.status} ${String((badHorizon.body.error as { message?: string } | undefined)?.message ?? "")}`,
                )
                const zeroHorizon = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=0`)))
                check("a zero horizon is 400", zeroHorizon.status === 400, `status=${zeroHorizon.status}`)
                const hugeHorizon = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=100000`)))
                check("an out-of-range horizon is 400 rather than an unbounded scan", hugeHorizon.status === 400)
                const goodHorizon = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=72`)))
                check(
                    "an in-range horizon is accepted and echoed back",
                    goodHorizon.status === 200 && (goodHorizon.body.data as { horizonHours?: number }).horizonHours === 72,
                )

                // ---- envelope shape, one per status ----------------------------
                for (const [label, called] of [
                    ["200", ok],
                    ["400", noWorkspace],
                    ["401", anon],
                    ["403", foreign],
                ] as Array<[string, Called]>) {
                    const keys = Object.keys(called.body).sort().join(",")
                    const expected = called.status < 400 ? "data,ok" : "error,ok"
                    check(`the ${label} response uses the shared envelope shape`, keys === expected, `keys=${keys}`)
                }

                throw new Rollback()
            })
        } catch (e) {
            if (!(e instanceof Rollback)) throw e
        }

        // ---- 503, and the leak assertion that is the point of it ---------------
        // The injected failure carries a fake DSN so the assertion can be about LEAKAGE. A 503 that
        // merely had the right status would prove nothing about what reached the caller.
        const brokenPrisma = {
            workspace: {
                findUnique: async () => {
                    throw new Error("SECRET_DETAIL postgres://user:pw@dbhost:5432/personalink")
                },
            },
        } as unknown as PrismaClient
        const brokenIdentity = new ControlledIdentity()
        brokenIdentity.current = "clerk_whoever"
        const brokenApi = new OperationsApiService(
            new OperationsService(new OperationsContext(brokenPrisma, new PersistedTenancy(brokenPrisma, brokenIdentity))),
        )
        const broken = await call(brokenApi.today(get(`${BASE}?workspaceId=whatever`)))
        checkInvertible(
            "a dependency failure is 503 rather than a 500 or a stack trace",
            broken.status === 503 && errCode(broken) === "DEPENDENCY_UNAVAILABLE",
            `status=${broken.status} code=${errCode(broken)}`,
        )
        checkInvertible(
            "MEASURED: the 503 body leaks no DSN, host, credential or driver text",
            !/SECRET_DETAIL|postgres:\/\/|dbhost|personalink|user:pw/.test(broken.raw),
            broken.raw.slice(0, 120),
        )
        // The envelope is reused from fieldJobs, which is right; its DEFAULT 503 sentence is not. This
        // caught a real leak of the wrong domain name into this surface's copy.
        checkInvertible(
            "the 503 message names THIS surface rather than the one whose envelope helper it reuses",
            /Operations are temporarily unavailable/.test(broken.raw) && !/Field jobs/.test(broken.raw),
            String((broken.body.error as { message?: string } | undefined)?.message ?? ""),
        )
        check(
            "the 503 uses the shared envelope shape too",
            Object.keys(broken.body).sort().join(",") === "error,ok",
            `keys=${Object.keys(broken.body).sort().join(",")}`,
        )

        const after = await prisma.fieldJob.count()
        check("harness left zero residue", before === after, `FieldJob ${before} -> ${after}`)
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} operations route assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} operations route assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("Operations HTTP boundary holds.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
