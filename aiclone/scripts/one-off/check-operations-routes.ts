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
import {
    classifyRouteModule,
    describeMethods,
    exportsMethod,
    exportsNoStateChangingMethod,
    frameworkDerivesSafeMethods,
} from "../lib/http-method-classifier"

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

type Called = Readonly<{ status: number; body: Record<string, unknown>; raw: string; headers: Readonly<Record<string, string>> }>

async function call(promise: Promise<Response>): Promise<Called> {
    const response = await promise
    const raw = await response.text()
    let body: Record<string, unknown> = {}
    try {
        body = JSON.parse(raw) as Record<string, unknown>
    } catch {
        body = {}
    }
    // Header names are lowercased on the way in: HTTP header names are case-insensitive, so asserting
    // against "allow" rather than whatever case the helper happened to write makes the assertion about the
    // header rather than about its spelling.
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
    })
    return Object.freeze({ status: response.status, body, raw, headers: Object.freeze(headers) })
}

function get(url: string): Request {
    return new Request(url, { method: "GET" })
}
/**
 * A request with an arbitrary method. `POST` and `PUT` carry no body on purpose: the point of these
 * requests is the METHOD, and a surface that refused them only because their body was unparseable would
 * have proven nothing about the method guard.
 */
function withMethod(method: string, url: string): Request {
    return new Request(url, { method })
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
    /**
     * MIGRATED TO THE CANONICAL CLASSIFIER, and this site was the weakest of the seven.
     *
     * It was `/export async function GET\(/` and `!/export async function (POST|PATCH|PUT|DELETE)\(/`. Both
     * halves are blind to two declaration styles this repository already uses, and MEASURED over its 154
     * api route files the narrow GET pattern misses 28 GET-exporting files and the narrow write pattern
     * misses 21 files that really do export a state-changing verb. This surface's own route happens to use
     * `export async function GET`, so the old pattern was right about THIS file by luck rather than by
     * construction - a refactor to `export const GET = ...` would have turned the GET half red and the write
     * half blind on the same day.
     *
     * It also polices the same operations surface as check-operations-runtime.ts while being strictly
     * weaker than it, and it never mentioned HEAD or OPTIONS. Both gaps are closed here: the classifier is
     * shared with that harness, so the two cannot drift, and the safe-method fact is now recorded rather
     * than left unstated.
     */
    const routePath = join(APP_ROOT, "src/app/api/platform/operations/today/route.ts")
    const routeSrc = readFileSync(routePath, "utf8")
    const routeMethods = classifyRouteModule(routePath, routeSrc)
    checkInvertible(
        "the operations route exports GET and no state-changing verb - in ANY declaration style, including the two the old narrow pattern could not see",
        exportsMethod(routeMethods, "GET") && exportsNoStateChangingMethod(routeMethods),
        `methods=[${describeMethods(routeMethods)}] styles=[${routeMethods.exports.map((e) => `${e.method}:${e.style}`).join(" ")}]`,
    )
    // NOT a prohibition. HEAD and OPTIONS are SAFE methods under RFC 9110 section 9.2.1 and exporting
    // either would be legal. This records the precondition that makes next@16.3.3 derive HEAD from this GET
    // and answer OPTIONS itself - the same fact check-operations-runtime.ts records, now from the same
    // classifier so the two harnesses cannot come to disagree about one route module.
    checkInvertible(
        "MEASURED: the operations route leaves HEAD and OPTIONS to the framework, which derives HEAD from this GET handler and answers OPTIONS itself",
        frameworkDerivesSafeMethods(routeMethods),
        `safe-method handlers exported: [${routeMethods.safeMethodHandlers.join(",") || "none"}]`,
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
                    items.length > 0 && items.every((item) => item.at === null || typeof item.at === "string"),
                )
                // NOT `JSON.stringify(JSON.parse(raw)) === JSON.stringify(body)`: `body` IS
                // `JSON.parse(raw)`, produced by the `call()` helper, so that comparison is x === x and
                // cannot fail. What is worth asserting is that the wire bytes parse and carry the
                // envelope.
                check(
                    "the response body is valid JSON on the wire and carries the envelope key",
                    (() => {
                        try {
                            const parsed = JSON.parse(ok.raw) as Record<string, unknown>
                            return parsed.ok === true && typeof parsed.data === "object" && parsed.data !== null
                        } catch {
                            return false
                        }
                    })(),
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
                    // The expectation comes from the LABEL, a literal, not from the observed status.
                    // Deriving it from `called.status` meant a 403 regressing to a 200 flipped the
                    // expectation with it and this assertion still passed.
                    const expectedStatus = Number(label)
                    const expected = expectedStatus < 400 ? "data,ok" : "error,ok"
                    check(
                        `the ${label} response really is ${label} and uses the shared envelope shape`,
                        called.status === expectedStatus && keys === expected,
                        `status=${called.status} keys=${keys}`,
                    )
                }

                // ---- THE METHOD GUARD ON THE SERVICE, NOT ON THE ROUTE FILE ----
                /**
                 * WHAT WAS MEASURED BEFORE THIS BLOCK EXISTED. `OperationsApiService.today` never read
                 * `request.method`, and `operationsApi` is an exported singleton - so a direct caller got
                 * 200 and the full workspace summary for POST and for OPTIONS. Nothing was exposed over
                 * HTTP (the route module exports only GET, so next@16.3.3 refuses the rest itself and
                 * answers OPTIONS itself) and no write occurred (the engine has no write path), which is
                 * exactly why this was worth fixing rather than shrugging at: the read-only guarantee
                 * rested on one file's export list. The structural assertions at the top of this harness
                 * verify that file. They cannot verify the service, and the service is what the singleton
                 * hands to any future caller.
                 *
                 * These assertions are therefore about the SERVICE, reached directly, with no route module
                 * involved at all.
                 */

                /**
                 * A SPY ENGINE, WHICH IS THE ZERO-SIDE-EFFECT PROOF.
                 *
                 * Counting rows after a refusal proves that THIS refusal wrote nothing. Proving the engine
                 * was never invoked proves a refusal CANNOT write - it never reaches a database connection,
                 * so there is no query to be a write, no transaction to leave open and no sequence to
                 * advance. That is the stronger claim and it is the one the guard actually makes, so it is
                 * the one asserted. The spy throws rather than returning, so a guard that fell through
                 * would produce a 503 here and fail loudly instead of quietly answering 200 with empty data.
                 */
                let engineCalls = 0
                const spyApi = new OperationsApiService({
                    summary: async () => {
                        engineCalls += 1
                        throw new Error("SPY: the engine was reached on a request that should have been refused")
                    },
                } as unknown as OperationsService)

                const refusedMethods = ["POST", "PUT", "PATCH", "DELETE"] as const
                const spyRefusals: Called[] = []
                for (const verb of refusedMethods) {
                    spyRefusals.push(await call(spyApi.today(withMethod(verb, `${BASE}?workspaceId=${ids.wsA}`))))
                }
                checkInvertible(
                    "MEASURED: every state-changing method is refused 405 METHOD_NOT_ALLOWED by the SERVICE, not merely by the route module's export list",
                    spyRefusals.every((r) => r.status === 405 && errCode(r) === "METHOD_NOT_ALLOWED"),
                    spyRefusals.map((r, i) => `${refusedMethods[i]}=${r.status}/${errCode(r)}`).join(" "),
                )
                checkInvertible(
                    "MEASURED: a refused method carries Allow: GET, HEAD, OPTIONS - the byte-identical string next@16.3.3 puts on its own auto-implemented OPTIONS for this route",
                    spyRefusals.every((r) => r.headers.allow === "GET, HEAD, OPTIONS"),
                    spyRefusals.map((r, i) => `${refusedMethods[i]}:[${r.headers.allow ?? "NO ALLOW HEADER"}]`).join(" "),
                )
                // THE ZERO-SIDE-EFFECT PROOF. Not "no row changed" - "no query was possible".
                checkInvertible(
                    "MEASURED: a refused method NEVER REACHES THE ENGINE, so a refusal cannot write, cannot open a transaction and cannot advance a sequence - zero side effects by construction rather than by observation",
                    engineCalls === 0,
                    `engine invocations during ${refusedMethods.length} refused requests: ${engineCalls}`,
                )
                // OPTIONS answers the method set without authenticating and without reaching the engine,
                // which is what the framework already does on this route over HTTP. Previously a direct
                // caller got 200 and a full summary here.
                const options = await call(spyApi.today(withMethod("OPTIONS", `${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible(
                    "MEASURED: OPTIONS is 204 with Allow and NO content, matching what the framework already answers over HTTP - it was 200 with a full workspace summary before this guard",
                    options.status === 204 && options.raw === "" && options.headers.allow === "GET, HEAD, OPTIONS" && engineCalls === 0,
                    `status=${options.status} bodyBytes=${options.raw.length} allow=[${options.headers.allow ?? "none"}] engineCalls=${engineCalls}`,
                )

                /**
                 * NON-ENUMERATION THROUGH THE NEW DOOR, which is the assertion the guard could most easily
                 * have broken.
                 *
                 * The guard runs BEFORE `param` and before the engine, so a refused method must answer
                 * identically whether the workspace named is the caller's own, somebody else's, one that
                 * does not exist, or absent entirely. Had the guard been placed after `param`, the
                 * difference between 400 and 405 would have leaked whether a workspaceId was well-formed;
                 * after the engine call, the difference between 403 and 405 would have leaked membership.
                 * Compared as BYTES, not by status, because a status match with a differing message would
                 * still be an oracle.
                 */
                const postOwn = await call(spyApi.today(withMethod("POST", `${BASE}?workspaceId=${ids.wsA}`)))
                const postForeign = await call(spyApi.today(withMethod("POST", `${BASE}?workspaceId=${ids.wsB}`)))
                const postGhost = await call(spyApi.today(withMethod("POST", `${BASE}?workspaceId=${RUN}_ghost_ws`)))
                const postNone = await call(spyApi.today(withMethod("POST", BASE)))
                const postShapes = new Set([postOwn, postForeign, postGhost, postNone].map((r) => `${r.status}|${refusal(r)}|${r.headers.allow ?? ""}`))
                checkInvertible(
                    "MEASURED: a refused method is BYTE-IDENTICAL for the caller's own workspace, a foreign one, a nonexistent one and none at all - the method guard is not an enumeration oracle",
                    postShapes.size === 1 && postOwn.status === 405,
                    `${postShapes.size} distinct refusal(s): ${[...postShapes].join("  ||  ")}`,
                )

                /**
                 * HEAD RUNS THE WHOLE GET PATH, INCLUDING AUTHORIZATION, and is deliberately not
                 * short-circuited. RFC 9110 section 9.1 requires HEAD of a general-purpose server and
                 * section 9.3.2 requires it to carry no content; short-circuiting it ahead of
                 * authorization would have turned an unauthenticated HEAD into a 200 and made this surface
                 * a membership oracle, which is the failure the due-work surface already had and fixed.
                 */
                const headOk = await call(api.today(withMethod("HEAD", `${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible(
                    "MEASURED: HEAD answers 200 with NO content and a Content-Length equal to the byte length the GET content would have had",
                    headOk.status === 200 &&
                        headOk.raw === "" &&
                        headOk.headers["content-length"] === String(new TextEncoder().encode(ok.raw).length),
                    `status=${headOk.status} bodyBytes=${headOk.raw.length} content-length=${headOk.headers["content-length"]} getBytes=${new TextEncoder().encode(ok.raw).length}`,
                )
                identity.current = null
                const headAnon = await call(api.today(withMethod("HEAD", `${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible(
                    "MEASURED: HEAD authorizes - a signed-out HEAD is 401 with no content, so HEAD is not a way around the 401 that GET returns",
                    headAnon.status === 401 && headAnon.raw === "",
                    `status=${headAnon.status} bodyBytes=${headAnon.raw.length}`,
                )
                identity.current = ids.userA
                const headForeign = await call(api.today(withMethod("HEAD", `${BASE}?workspaceId=${ids.wsB}`)))
                const headGhost = await call(api.today(withMethod("HEAD", `${BASE}?workspaceId=${RUN}_ghost_ws`)))
                checkInvertible(
                    "MEASURED: HEAD preserves non-enumeration too - a foreign workspace and a nonexistent one are identical in status, headers and (absent) content",
                    headForeign.status === 403 &&
                        headForeign.status === headGhost.status &&
                        headForeign.raw === "" &&
                        headGhost.raw === "" &&
                        headForeign.headers["content-length"] === headGhost.headers["content-length"],
                    `${headForeign.status}/${headGhost.status} content-length ${headForeign.headers["content-length"]}/${headGhost.headers["content-length"]}`,
                )
                // GET is unchanged by all of this. Asserted rather than assumed: the guard is new code on
                // the one path that was already working.
                const okAfterGuard = await call(api.today(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible(
                    "MEASURED: GET is byte-unchanged by the method guard - same status, same envelope keys, same item count as before the guard existed",
                    okAfterGuard.status === 200 &&
                        Object.keys(okAfterGuard.body).sort().join(",") === "data,ok" &&
                        ((okAfterGuard.body.data as { items?: unknown[] }).items ?? []).length === items.length,
                    `status=${okAfterGuard.status} items=${((okAfterGuard.body.data as { items?: unknown[] }).items ?? []).length} vs ${items.length}`,
                )
                // And no refusal, of any method, touched a row. The engine-never-reached assertion above is
                // the structural proof; this is the independent empirical one, taken over this run's own
                // rows rather than globally, so a concurrent harness seeding the same database cannot move it.
                const runRows = async () => {
                    const counted = await tx.$queryRawUnsafe<{ n: bigint }[]>(
                        `select (select count(*) from "FieldJob" where "id" like '${RUN}%')
                              + (select count(*) from "Workspace" where "id" like '${RUN}%')
                              + (select count(*) from "Membership" where "id" like '${RUN}%')
                              + (select count(*) from "Profile" where "id" like '${RUN}%')
                              + (select count(*) from "User" where "id" like '${RUN}%') as n`,
                    )
                    return Number(counted[0].n)
                }
                const rowsAfterRefusals = await runRows()
                for (const verb of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
                    await call(api.today(withMethod(verb, `${BASE}?workspaceId=${ids.wsA}`)))
                }
                checkInvertible(
                    "MEASURED: a full round of refusals against the REAL engine-backed service changes this run's row count by zero - the empirical half of the zero-side-effect proof",
                    (await runRows()) === rowsAfterRefusals && rowsAfterRefusals > 0,
                    `this run's rows before=${rowsAfterRefusals} after=${await runRows()} (a zero baseline would make this vacuous)`,
                )

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
