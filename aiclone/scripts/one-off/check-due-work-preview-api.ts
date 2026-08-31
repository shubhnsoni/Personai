/**
 * The explicitly invoked DUE-WORK PREVIEW boundary.
 *
 * `planDueWork` was pure, proven and invoked by nobody. This harness covers the surface that now
 * invokes it, and the promises that surface makes are unusually strong, so most of the assertions here
 * are about what must NOT happen:
 *
 *   nothing is written - not a row, not a status, and not a record that a preview was requested, which
 *   is asserted by TWO INDEPENDENT MECHANISMS over a committed request: a client extension that
 *   observes every model action and raw call the client issues, and content digests taken on a
 *   separate connection over this run's own rows. Row counting was retired here - it could not see an
 *   UPDATE, an insert-then-delete, a sequence advance, or any of the 97 base tables its list omitted,
 *   and being global it went red when a concurrent harness seeded the same database;
 *   nothing runs on its own - no timer, interval, cron, queue or background execution exists in the
 *   three source files, asserted over EXECUTABLE LINES ONLY;
 *   nothing is handed to a provider - no mailer, payment client, carrier or transport, and the
 *   composition root injects no adapter of any kind;
 *   the wording is honest - the SERIALISED BODY may not contain "scheduled", "sent", "executed" and the
 *   rest of FORBIDDEN_PREVIEW_WORDS, and must contain the required ones;
 *   `executed` is the literal false and `sideEffects` is empty in the emitted JSON, not merely in the type;
 *   401 / 400 / 403 / 405 / 503 all use the shared envelope, a foreign workspace and a nonexistent one
 *   refuse BYTE-IDENTICALLY, and the 503 leaks no DSN and names THIS surface rather than the one whose
 *   envelope helper it reuses;
 *   NEITHER THE CLIENT NOR THE SERVER LOG leaks the injected secret - the log assertions are new, and they
 *   are the ones that were failing: the body was always clean while the log printed the whole DSN. A
 *   SECOND log probe covers the two defects the first one structurally cannot reach: a wrapped error whose
 *   real failure is in `cause` (logged as kind and code only, never a message, at any depth), and a frame
 *   redactor that used to destroy the file, line and column it exists to preserve.
 *
 * THE DETECTOR'S BOUNDARY IS MEASURED HERE TOO, not assumed. All fourteen original injection classes were
 * shapes the detector already recognises, so catching all fourteen was evidence about its positives only.
 * Two classes are now declared KNOWN GAPS and asserted as MISSES - each proving the mutation really
 * happened before accepting "not caught", and each failing the day the gap closes.
 *
 * TWO SHARED FILES ARE NOW EXERCISED FROM HERE ON PURPOSE. Reaching a correct 405 required widening
 * `PersistenceErrorCode` in src/lib/persistence/errors.ts and giving `json`/`failure` in
 * src/lib/fieldjobs/http.ts an optional headers parameter. Both are used by every surface on this platform,
 * so this harness pins the PRE-EXISTING behaviour of those helpers - every old code's status against a
 * literal, every old refusal body as a string, and every old response's header set against the platform
 * primitive - because a tsc pass cannot tell anyone that a status or a byte stayed the same.
 *
 * THE COMMENT-SCANNING TRAP, which this repository has now walked into five times: the contract file and
 * both source files NAME every forbidden word and every forbidden dependency, in prose, precisely in
 * order to forbid them. A whole-file regex would therefore flag the prohibition as the violation. So the
 * source scans below run over `executableLines()`, which strips block and line comments first, and the
 * wording scan runs over the RESPONSE BODY rather than over any source file at all.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 * Set WRITE_DETECTOR_INJECT=<class> to inject one write class into the measured no-write window and
 * watch the detector name it. See INJECTABLE in the no-write block for the recognised classes.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-due-work-preview-api.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { inspect } from "node:util"

import { PrismaClient } from "@prisma/client"
/**
 * THE FRAMEWORK'S OWN METHOD DERIVATION, IMPORTED RATHER THAN REPLICATED.
 *
 * This is a deep import into next@16.3.3's internals and that is deliberate. The question this harness
 * has to answer is "what does the framework ACTUALLY do with a HEAD or an OPTIONS request to a route that
 * exports only GET", and there are three ways to answer it: assume, replicate the algorithm here, or run
 * the framework's own code. The first is how the defect this round fixes got in - the service refused HEAD
 * on the stated grounds that "the route module exports no HEAD handler", which is true and does not imply
 * what it was taken to imply. The second is a copy that can drift from the thing it models, which is the
 * failure mode this whole repository is built to avoid.
 *
 * So the real function is called with a handler map shaped like the real route module's exports, and the
 * HEAD and OPTIONS behaviour asserted below is produced by next's code and not by this file's opinion of
 * it. The cost is that a future next upgrade which moves or renames this module breaks the IMPORT. That
 * is the correct failure: it goes red at the one place that says "re-measure HEAD and OPTIONS", rather
 * than staying green while describing a framework that no longer behaves that way.
 */
import { autoImplementMethods } from "next/dist/server/route-modules/app-route/helpers/auto-implement-methods"

import { failure, success } from "../../src/lib/fieldjobs/http"
import { DueWorkApiService } from "../../src/lib/operations/due-work-http"
import { planDueWork } from "../../src/lib/operations/due-work-plan"
import {
    DUE_WORK_PREVIEW_LIMITATIONS,
    FORBIDDEN_PREVIEW_WORDS,
    REQUIRED_PREVIEW_WORDS,
    toDueWorkPreview,
} from "../../src/lib/operations/due-work-preview-types"
import { deriveMixedScope, OPERATIONS_DOMAIN_SCOPE, OperationsService } from "../../src/lib/operations/engine"
import type { OperationsDomain } from "../../src/lib/operations/engine"
import { OperationsContext } from "../../src/lib/operations/shared"
import { PersistenceError, type PersistenceErrorCode } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"
import {
    createWriteDetector,
    classifyModelCall,
    classifyRawCall,
    isWriteSql,
    type TableFingerprintSpec,
    type WriteDetectorVerdict,
} from "../lib/write-detector"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `dwp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "../..")
const BASE = "http://duework.test/api/platform/operations/due-work"

/**
 * THE METHOD SET THIS SURFACE HONOURS, PINNED AS A LITERAL, ON PURPOSE.
 *
 * Reading it out of the service's own constant would make the header assertions self-agreeing: the
 * surface would be asserted to advertise whatever it advertises. So the expected value is written here as
 * a string, and it is separately asserted to be BYTE-IDENTICAL to the value next@16.3.3's own
 * auto-implementation generates for this route. Three independent statements have to agree - this
 * literal, the service, and the framework - and any one of them moving alone goes red.
 *
 * The order is the framework's: it builds its own list with `.sort()`, so "GET, HEAD, OPTIONS" is not a
 * house style choice here but the thing the framework will actually send.
 */
const EXPECTED_ALLOW = "GET, HEAD, OPTIONS"

/** Only the part of the framework's derived handler table this harness calls. */
type DerivedMethods = Readonly<Record<string, (request: Request) => Promise<Response> | Response>>

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

type Called = Readonly<{
    status: number
    body: Record<string, unknown>
    raw: string
    headers: Readonly<Record<string, string>>
}>

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
    // against "allow" rather than whatever case the helper happened to write makes the assertion about
    // the header rather than about its spelling.
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
    })
    return Object.freeze({ status: response.status, body, raw, headers: Object.freeze(headers) })
}

function get(url: string): Request {
    return new Request(url, { method: "GET" })
}
function errCode(called: Called): string {
    const error = called.body.error as { code?: string } | undefined
    return error?.code ?? ""
}
function refusal(called: Called): string {
    return JSON.stringify(called.body)
}

/**
 * THE HANDLER-EXPORT GATE, widened after audit and then SPLIT after a second one.
 *
 * The first version of this gate asserted `!/export async function (POST|PATCH|PUT|DELETE)\(/`, which is
 * evadable without any cleverness at all: this repository's own src/app/api already declares handler
 * exports three different ways. Measured over its 156 route.ts files: `export async function VERB` 95
 * times, `export function VERB` 17 times and `export const VERB` 4 times, for POST/PUT/PATCH/DELETE. A
 * write verb added to the due-work route in either of the two latter styles - both of them already house
 * style here - would have passed the old gate untouched.
 *
 * So the ban matches all three declaration styles. The GET side accepts the non-async form too, and that
 * is not hypothetical either: 26 route files in this repo write `export function GET`, so the old
 * `export async function GET\(` pattern would have gone red on a legal refactor of this one - and a gate
 * that fails spuriously gets deleted by the next person rather than fixed.
 *
 * THE SPLIT, WHICH IS THE POINT OF THIS ROUND. The widened form put HEAD and OPTIONS in with the four
 * write verbs and called the whole set `WRITE_VERB_EXPORT`. Under RFC 9110 HEAD and OPTIONS are SAFE
 * methods - neither is a request to change anything - so a constant named for write verbs that contained
 * two safe methods was a lie in the code, and the assertion built on it would have rejected a perfectly
 * legal RFC-compliant HEAD export. Nothing in src/ exports HEAD or OPTIONS today, so it was never
 * FAILING; it was wrong and latent, and it was propping up a real behavioural defect in the service (see
 * the HEAD block in the runtime section).
 *
 * The two concepts now have two names and two different meanings:
 *
 *   STATE_CHANGING_VERB_EXPORT  the four unsafe verbs. Their ABSENCE is the no-write guarantee, and that
 *                               is the only claim this file may draw from an export scan.
 *   SAFE_METHOD_HANDLER_EXPORT  HEAD and OPTIONS. Their absence is NOT a guarantee about writes. It is
 *                               the PRECONDITION for the framework's auto-implementation: exporting GET
 *                               and not HEAD is exactly what makes next@16.3.3 serve HEAD by invoking
 *                               GET, and exporting no OPTIONS is what makes it answer OPTIONS itself.
 *                               So this pattern is read to establish a derivation, not to forbid a verb.
 *
 * Neither pattern carries the `g` flag - a shared /g/ regex keeps `lastIndex` between `.test` calls and
 * would start answering false on alternate uses.
 */
const STATE_CHANGING_VERB_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/
const SAFE_METHOD_HANDLER_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(?:HEAD|OPTIONS)\b/
const GET_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+GET\b/

/**
 * Source with comments removed, so a prohibition written in prose is not mistaken for the thing it
 * prohibits. Strings are deliberately left intact: a real `setInterval("...")` would be executable.
 */
function executableLines(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .split("\n")
        .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
        .join("\n")
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
        // One overdue job and one inside the horizon, so the plan has at least two bands to order and
        // an empty plan cannot pass the ordering assertions by vacuity. A CHECK constraint refuses a
        // start without an end, so both are set.
        await mk(
            `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","scheduledStartAt","scheduledEndAt","updatedAt")
             values ('${q(`late${side}`)}','${q(`pr${side}`)}','${q(`late${side}`)}','Overdue callout','SCHEDULED','NORMAL','1 Example Street',CURRENT_TIMESTAMP - interval '3 days',CURRENT_TIMESTAMP - interval '3 days' + interval '1 hour',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","scheduledStartAt","scheduledEndAt","updatedAt")
             values ('${q(`soon${side}`)}','${q(`pr${side}`)}','${q(`soon${side}`)}','Upcoming callout','SCHEDULED','NORMAL','2 Example Street',CURRENT_TIMESTAMP + interval '6 hours',CURRENT_TIMESTAMP + interval '7 hours',CURRENT_TIMESTAMP)`,
        )
    }
    return {
        wsA: q("wsa"),
        wsB: q("wsb"),
        userA: `clerk_${q("ua")}`,
        userB: `clerk_${q("ub")}`,
        lateA: q("latea"),
        soonA: q("soona"),
    }
}

/**
 * A COMMITTED fixture, deliberately not inside the rollback transaction.
 *
 * The no-write proof cannot live inside a rolled-back transaction: the rollback would erase any write
 * it was looking for. So this seeds real rows, commits them, and is torn down explicitly afterwards.
 * Ids are prefixed with the run id so a crash leaves identifiable rows rather than anonymous residue.
 */
const COMMITTED = {
    user: `${RUN}_cu`,
    profile: `${RUN}_cp`,
    workspace: `${RUN}_cw`,
    membership: `${RUN}_cm`,
    job: `${RUN}_cj`,
}

async function seedCommitted(prisma: PrismaClient) {
    const mk = (sql: string) => prisma.$executeRawUnsafe(sql)
    await mk(
        `insert into "User" ("id","clerkId","email","updatedAt") values ('${COMMITTED.user}','clerk_${COMMITTED.user}','${COMMITTED.user}@example.test',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${COMMITTED.profile}','${COMMITTED.user}','${COMMITTED.profile}','P',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${COMMITTED.workspace}','${COMMITTED.profile}','WS','${COMMITTED.workspace}',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Membership" ("id","workspaceId","userId","role","updatedAt") values ('${COMMITTED.membership}','${COMMITTED.workspace}','${COMMITTED.user}','OWNER',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","scheduledStartAt","scheduledEndAt","updatedAt")
         values ('${COMMITTED.job}','${COMMITTED.profile}','${COMMITTED.job}','Committed callout','SCHEDULED','NORMAL','3 Example Street',CURRENT_TIMESTAMP - interval '2 days',CURRENT_TIMESTAMP - interval '2 days' + interval '1 hour',CURRENT_TIMESTAMP)`,
    )
    return { user: `clerk_${COMMITTED.user}`, workspace: COMMITTED.workspace }
}

async function cleanupCommitted(prisma: PrismaClient) {
    const mk = (sql: string) => prisma.$executeRawUnsafe(sql)
    await mk(`delete from "FieldJob" where "id" = '${COMMITTED.job}'`)
    await mk(`delete from "Membership" where "id" = '${COMMITTED.membership}'`)
    await mk(`delete from "Workspace" where "id" = '${COMMITTED.workspace}'`)
    await mk(`delete from "Profile" where "id" = '${COMMITTED.profile}'`)
    await mk(`delete from "User" where "id" = '${COMMITTED.user}'`)
}

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    // ---- structural: the surface cannot act, by construction -------------------
    const routeSrc = readFileSync(join(APP_ROOT, "src/app/api/platform/operations/due-work/route.ts"), "utf8")
    const httpSrc = readFileSync(join(APP_ROOT, "src/lib/operations/due-work-http.ts"), "utf8")
    const runtimeSrc = readFileSync(join(APP_ROOT, "src/lib/operations/due-work-runtime.ts"), "utf8")
    const httpExec = executableLines(httpSrc)
    const runtimeExec = executableLines(runtimeSrc)
    const routeExec = executableLines(routeSrc)
    const allExec = `${httpExec}\n${runtimeExec}\n${routeExec}`

    checkInvertible(
        "the due-work route exports GET and no POST, PUT, PATCH or DELETE - in ANY of the three export styles this repo uses",
        GET_EXPORT.test(routeExec) && !STATE_CHANGING_VERB_EXPORT.test(routeExec),
        "no state-changing verb, checked against `export [async] function|const VERB`",
    )
    // NOT a prohibition, and it must not be read as one: HEAD and OPTIONS are safe methods and exporting
    // either would be legal. This records the PRECONDITION that makes the framework derivation below
    // apply - GET exported, HEAD and OPTIONS not - so that if someone does export one, the derivation
    // assertions stop describing this route and go red instead of quietly describing a route that no
    // longer exists.
    checkInvertible(
        "MEASURED: the route exports GET and neither HEAD nor OPTIONS, which is the precondition for next@16.3.3 deriving both of them itself",
        GET_EXPORT.test(routeExec) && !SAFE_METHOD_HANDLER_EXPORT.test(routeExec),
        "GET exported; HEAD/OPTIONS left to the framework",
    )
    check("the due-work route is dynamic and runs on node", /force-dynamic/.test(routeExec) && /runtime = "nodejs"/.test(routeExec))

    // The prohibition is written in prose in all three files, so this MUST be executable-lines-only.
    checkInvertible(
        "MEASURED: no timer, interval, cron or background execution in any executable line",
        !/\bsetTimeout\b|\bsetInterval\b|\bsetImmediate\b|\bcron\b|\bschedule\b|\bqueue\b|\benqueue\b|\bworker\b|\bnextTick\b/i.test(allExec),
        "executable lines only",
    )
    checkInvertible(
        "MEASURED: no database mutation verb in any executable line",
        !/\.create\(|\.createMany\(|\.update\(|\.updateMany\(|\.delete\(|\.deleteMany\(|\.upsert\(|\$executeRaw|\$transaction/.test(allExec),
        "no write verb",
    )
    checkInvertible(
        "MEASURED: no provider, transport or outbound call in any executable line",
        !/\bfetch\(|\bmailer\b|\bsendMail\b|\bstripe\b|\bcarrier\b|\bpublish\(|\bnotify\(|\bdispatch\(/i.test(allExec),
        "no provider",
    )
    // The composition root is the one place a provider would appear first, so it is asserted by name.
    checkInvertible(
        "MEASURED: the composition root injects no adapter - it wires only prisma, tenancy and the engine",
        /new DueWorkApiService\(new OperationsService\(ctx\)\)/.test(runtimeExec) &&
            !/Adapter|Mailer|Queue|Scheduler|Payment|Provider|Transport/.test(runtimeExec),
        "no adapter injected",
    )
    check(
        "the boundary adds no judgement of its own - it composes summary, planDueWork and toDueWorkPreview",
        /planDueWork\(summary\)/.test(httpExec) && /toDueWorkPreview\(/.test(httpExec),
    )
    // Widening the scope would be invisible at runtime for an owner, who has every scope.
    checkInvertible(
        "the surface asks for no scope of its own, inheriting profile.read from the summary call",
        !/requireScope/.test(httpExec),
        "no requireScope in the boundary",
    )

    // ---- THE SHARED FILES: what the 405 required, and what it must NOT have cost ----------
    //
    // Closing the 405 compromise needed changes to two files that are not this surface's. METHOD_NOT_ALLOWED
    // was added to `PersistenceErrorCode` and its status map in src/lib/persistence/errors.ts, and `json`
    // and `failure` in src/lib/fieldjobs/http.ts grew an optional trailing `headers` parameter. Both files
    // are shared platform-wide: five modules import `failure` (business-os install, business-os preview,
    // business-os workspace-surface, operations view, this surface) and FieldJobApiService.run adds a sixth
    // call site with its own `.catch(failure)`. So the load-bearing question is not whether 405 works. It is
    // whether every OTHER refusal on this platform still answers exactly as it did.
    //
    // A TSC PASS IS NOT EVIDENCE OF THAT, and this block exists because it is not. `Readonly<Record<
    // PersistenceErrorCode, number>>` forces the new member to be given SOME status - which is why widening
    // the union is safe to attempt - but it says nothing about whether an existing member's status changed,
    // and an optional parameter type-checks identically whether or not the unchanged branch is the one
    // taken. Both of those are runtime facts, so they are measured as runtime facts: statuses against
    // LITERALS rather than read back out of the map that would have to be wrong for this to matter, and
    // refusal bodies compared as STRINGS.
    const PRE_EXISTING_CODES: ReadonlyArray<readonly [PersistenceErrorCode, number]> = Object.freeze([
        Object.freeze(["BAD_REQUEST", 400] as const),
        Object.freeze(["UNAUTHORIZED", 401] as const),
        Object.freeze(["FORBIDDEN", 403] as const),
        Object.freeze(["NOT_FOUND", 404] as const),
        Object.freeze(["CONFLICT", 409] as const),
        Object.freeze(["DEPENDENCY_UNAVAILABLE", 503] as const),
    ])

    function headerNames(response: Response): string {
        const names: string[] = []
        response.headers.forEach((_value, key) => names.push(key.toLowerCase()))
        return names.sort().join(",")
    }

    // The baseline is the PLATFORM PRIMITIVE, not another one of these helpers. `Response.json(data,
    // { status })` is the exact expression the old no-header `json` was, so comparing against it directly
    // answers "did wrapping it in an optional-headers branch add anything?" without trusting either helper.
    const PLATFORM_HEADERS = headerNames(Response.json({ probe: true }, { status: 400 }))
    checkInvertible(
        "MEASURED: the platform's own Response.json sets exactly one header, so the comparisons below have something to compare against",
        PLATFORM_HEADERS === "content-type",
        `Response.json headers=[${PLATFORM_HEADERS}]`,
    )

    for (const [code, status] of PRE_EXISTING_CODES) {
        checkInvertible(
            `MEASURED: pre-existing code ${code} still maps to ${status}, unchanged by widening the shared union`,
            new PersistenceError(code, "m").status === status,
            `${code} -> ${new PersistenceError(code, "m").status}`,
        )
        const plain = failure(new PersistenceError(code, "m"))
        const detailed = failure(new PersistenceError(code, "m", { field: "f" }))
        const plainRaw = await plain.text()
        const detailedRaw = await detailed.text()
        checkInvertible(
            `MEASURED: the shared refusal body for ${code} is byte-identical to its pre-change form, with and without details`,
            plainRaw === `{"ok":false,"error":{"code":"${code}","message":"m"}}` &&
                detailedRaw === `{"ok":false,"error":{"code":"${code}","message":"m","details":{"field":"f"}}}` &&
                plain.status === status &&
                detailed.status === status,
            `${plainRaw} | ${detailedRaw} | ${plain.status}/${detailed.status}`,
        )
        checkInvertible(
            `MEASURED: a ${code} refusal from an existing call site gained NO header - its header set still equals the platform default`,
            headerNames(plain) === PLATFORM_HEADERS && headerNames(detailed) === PLATFORM_HEADERS,
            `[${headerNames(plain)}] [${headerNames(detailed)}] vs platform [${PLATFORM_HEADERS}]`,
        )
    }

    // The non-PersistenceError branch, and its DEFAULT message - which is the fieldJobs surface's actual
    // output, because FieldJobApiService.run passes `failure` straight to `.catch` with no second argument.
    // Written out in full rather than interpolated: this string is what five other surfaces' 503 bodies are
    // pinned against, and an expectation assembled from the same pieces as the code cannot hold it still.
    const fallback = failure(new Error("boom"))
    const fallbackRaw = await fallback.text()
    checkInvertible(
        "MEASURED: the shared 503 fallback body and its default fieldJobs message are byte-identical to their pre-change form",
        fallbackRaw ===
            '{"ok":false,"error":{"code":"DEPENDENCY_UNAVAILABLE","message":"Field jobs are temporarily unavailable"}}' &&
            fallback.status === 503 &&
            headerNames(fallback) === PLATFORM_HEADERS,
        `${fallbackRaw} status=${fallback.status} headers=[${headerNames(fallback)}]`,
    )
    // The named-surface overload, which the operations view and this surface both rely on.
    const named = failure(new Error("boom"), "The due-work plan is temporarily unavailable")
    const namedRaw = await named.text()
    checkInvertible(
        "MEASURED: the surface-named 503 overload is byte-identical too, and still takes the no-header path",
        namedRaw ===
            '{"ok":false,"error":{"code":"DEPENDENCY_UNAVAILABLE","message":"The due-work plan is temporarily unavailable"}}' &&
            named.status === 503 &&
            headerNames(named) === PLATFORM_HEADERS,
        `${namedRaw} headers=[${headerNames(named)}]`,
    )
    // `success` shares the same `json` and is used by every surface on every 200, so it is pinned too.
    const okShape = success({ probe: 1 })
    const okShapeRaw = await okShape.text()
    checkInvertible(
        "MEASURED: the shared success envelope is byte-identical and header-identical after the json change",
        okShapeRaw === '{"ok":true,"data":{"probe":1}}' &&
            okShape.status === 200 &&
            headerNames(okShape) === PLATFORM_HEADERS,
        `${okShapeRaw} status=${okShape.status} headers=[${headerNames(okShape)}]`,
    )
    // And the new capability, proven to actually work through the SHARED helper rather than around it.
    const withHeader = failure(new PersistenceError("METHOD_NOT_ALLOWED", "m", { allow: "GET" }), undefined, {
        Allow: "GET",
    })
    const withHeaderRaw = await withHeader.text()
    checkInvertible(
        "MEASURED: the shared helper can now carry a header WITHOUT changing the body shape - same envelope, plus one header",
        withHeaderRaw === '{"ok":false,"error":{"code":"METHOD_NOT_ALLOWED","message":"m","details":{"allow":"GET"}}}' &&
            withHeader.status === 405 &&
            headerNames(withHeader) === [PLATFORM_HEADERS, "allow"].sort().join(","),
        `${withHeaderRaw} status=${withHeader.status} headers=[${headerNames(withHeader)}]`,
    )

    const prisma = new PrismaClient()
    try {
        const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
        if (live[0].db !== AUTHORIZED_TARGET) {
            console.error(`ABORT: connected to ${live[0].db}`)
            process.exit(1)
        }

        /**
         * THE TABLES THIS DOMAIN CAN REACH, and what they are now used for.
         *
         * This list used to BE the no-write proof: `count()` on each of these before and after a
         * request, compared as a total. It was widened twice - five tables, then thirteen append-only
         * logs added after a review counted the schema's own `<Table>_append_only` triggers - and it
         * was still unable to see five whole classes of write. Its own comment admitted two of them.
         *
         *   an UPDATE to an existing row            the count does not move
         *   an insert followed by a delete          the count returns to where it started
         *   a sequence / identity advance           no row is left to count
         *   a write to a table not on this list     this schema has 115 base tables; this list has 18
         *   a write that is later rolled back       erased before the comparison is taken
         *
         * And it was not concurrency-safe. `count()` with no predicate is a GLOBAL count, so another
         * harness seeding this same database inside the window moved it, and the assertion went red
         * for a reason that had nothing to do with the code under test. Two other stages are on this
         * database right now.
         *
         * So the list is no longer the proof. It is now (a) the fingerprint scope, taken with a
         * content digest rather than a count and scoped to THIS RUN's rows, and (b) a REPORTED global
         * count, printed and never asserted, whose only job is to make the concurrent traffic visible
         * so that a reader can see why the assertions below are not built on it.
         */
        const DOMAIN_TABLES = Object.freeze([
            "FieldJob",
            "Workspace",
            "Profile",
            "Membership",
            "User",
            "ActivityEvent",
            "CopilotAuditEvent",
            "FieldJobEvent",
            "ReservationEvent",
            "AppointmentEvent",
            "CaseEvent",
            "CohortEvent",
            "InventoryMovement",
            "BlueprintInstallationEvent",
            "CaseRetainerDraw",
            "CaseRetainerEvent",
            "CommerceEvent",
            "CourseAccessEvent",
        ])

        /** The old mechanism, kept only as a printed observation. Never asserted on. */
        const globalCounts = async (): Promise<Record<string, number>> => {
            const out: Record<string, number> = {}
            for (const table of DOMAIN_TABLES) {
                const rows = (await prisma.$queryRawUnsafe(
                    `select count(*)::text as n from "${table}"`,
                )) as Array<{ n: string }>
                out[table] = Number(rows[0].n)
            }
            return out
        }

        try {
            await prisma.$transaction(async (tx) => {
                const ids = await seed(tx)
                const identity = new ControlledIdentity()
                const client = tx as unknown as PrismaClient
                const tenancy = new PersistedTenancy(client, identity)
                const engine = new OperationsService(new OperationsContext(client, tenancy))
                const api = new DueWorkApiService(engine)

                // ---- 401 -------------------------------------------------------
                identity.current = null
                const anon = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible("a signed-out preview request is 401", anon.status === 401, `status=${anon.status}`)

                // ---- 200 -------------------------------------------------------
                identity.current = ids.userA
                const ok = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible("a member's preview request is 200", ok.status === 200, `status=${ok.status}`)

                // ---- the GET guarantee, asserted against the SERVICE ------------
                // The route module exporting no write verb is asserted structurally above, and that
                // assertion is about ONE file. `dueWorkApi` is an exported singleton, so a future module
                // importing it and calling .preview from a POST handler would have had a working write-verb
                // endpoint while the structural assertion above still passed. So the refusal is asserted
                // where the work happens. Same URL and same authorized member as the 200 immediately
                // above, so the only difference is the verb.
                const posted = await call(
                    api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: "POST" })),
                )
                checkInvertible(
                    "MEASURED: the SERVICE itself refuses a POST Request, so the no-write guarantee does not depend on the route module's exports",
                    posted.status !== 200 && posted.status === 405 && errCode(posted) === "METHOD_NOT_ALLOWED",
                    `GET on this URL=${ok.status}, POST=${posted.status} code=${errCode(posted)}`,
                )
                checkInvertible(
                    "the method refusal uses the shared envelope rather than a bespoke Response",
                    Object.keys(posted.body).sort().join(",") === "error,ok" &&
                        /GET/.test(String((posted.body.error as { message?: string } | undefined)?.message ?? "")),
                    `keys=${Object.keys(posted.body).sort().join(",")} message=${String((posted.body.error as { message?: string } | undefined)?.message ?? "").slice(0, 70)}`,
                )
                // THE 405 IS ONLY HALF AN ANSWER WITHOUT `Allow`. A caller told "not that method" and not
                // told which method has to guess. This is the header that closes the documented compromise:
                // it could not be sent before, because `failure` built its response through a `json` helper
                // that accepted no headers, and the alternative was hand-building a Response that bypassed
                // the shared envelope. So the header and the envelope are asserted TOGETHER - either one
                // alone was already achievable, and neither alone was the fix.
                checkInvertible(
                    "MEASURED: the 405 carries an Allow header, so the refusal tells the caller what to use instead",
                    posted.headers.allow === EXPECTED_ALLOW,
                    `allow=${JSON.stringify(posted.headers.allow ?? null)} headers=[${Object.keys(posted.headers).sort().join(",")}]`,
                )
                // The header must not be able to disagree with the check that produced the refusal. Both
                // are derived from one frozen list in the source, and the body echoes it, so this pins
                // header and body to each other rather than pinning each to a literal separately.
                checkInvertible(
                    "MEASURED: the Allow header and the refusal body name the SAME permitted method set, so the header cannot drift from the check",
                    posted.headers.allow ===
                        String(
                            (posted.body.error as { details?: { allow?: unknown } } | undefined)?.details?.allow ?? "",
                        ),
                    `header=${JSON.stringify(posted.headers.allow ?? null)} body=${JSON.stringify((posted.body.error as { details?: { allow?: unknown } } | undefined)?.details?.allow ?? null)}`,
                )
                // =============================================================================
                // THE FOUR METHOD CLASSES, EACH MEASURED THROUGH THE FRAMEWORK AND THE SERVICE.
                //
                // WHAT WAS HERE BEFORE, AND WHY IT WAS WRONG. One assertion, reading:
                //   "every method named in Allow is actually accepted, and HEAD - which is refused - is
                //    NOT named", headed.status === 405 && !/HEAD/i.test(allow) && ok.status === 200
                // It passed. It was also asserting an RFC violation into place. RFC 9110 section 9.1:
                // "all general-purpose servers MUST support the methods GET and HEAD", and section 9.3.2
                // makes HEAD "identical to GET except that the server MUST NOT send content". This surface
                // answered 200 to GET and 405 to HEAD on the same URL, and the harness held that steady.
                //
                // It was also in direct contradiction with the framework, which is the part that made it a
                // defect rather than a preference. Measured from next@16.3.3's own
                // auto-implement-methods.js, for a route exporting GET and neither HEAD nor OPTIONS:
                //   * `methods.HEAD = handlers.GET` - HEAD is served BY THIS SERVICE, with method "HEAD".
                //     The framework never refused it; the service did, so a caller was told "405, use GET"
                //     about a method the framework had already routed to a working handler.
                //   * OPTIONS is answered 204 with `Allow: GET, HEAD, OPTIONS` WITHOUT reaching a handler.
                //     So the resource advertised three methods over HTTP while this service advertised one
                //     and refused two of them. Two live, contradictory answers to "what may I send?".
                // The departure was not documented as a departure either - the service's comment argued
                // HEAD was absent BECAUSE the guard refused it, which is circular.
                //
                // So: HEAD and OPTIONS are honoured, POST/PUT/PATCH/DELETE are refused, and each class is
                // measured on BOTH paths - through the framework's real derivation and against the service
                // directly - because the whole reason this file exists is that the two can disagree.
                // =============================================================================
                const routeExports = { GET: (req: Request) => api.preview(req) }
                const derived = autoImplementMethods(
                    routeExports as unknown as Parameters<typeof autoImplementMethods>[0],
                ) as unknown as DerivedMethods

                // ---- GET -----------------------------------------------------------------
                // Through the framework as well as directly, so "the framework routes GET to this service"
                // is measured rather than assumed - it is the premise every HEAD assertion below rests on.
                const frameworkGet = await call(Promise.resolve(derived.GET(get(`${BASE}?workspaceId=${ids.wsA}`))))
                // Identical APART FROM THE CLOCK, which is the strongest true statement available: `asOf`
                // is a fresh reading per request, so two responses minutes or milliseconds apart must
                // differ there and comparing raw bytes would assert a falsehood. Everything else - the
                // envelope, the items, their order, the coverage, the limitations - is compared byte for
                // byte with the clock reading masked, and the mask is anchored to the field name so it
                // cannot quietly swallow anything else.
                const withoutClock = (raw: string) => raw.replace(/"asOf":"[^"]*"/g, '"asOf":"<clock>"')
                checkInvertible(
                    "MEASURED: GET is 200 through the framework's derived handler table and through the service directly, and the two bodies agree byte for byte once the per-request clock reading is masked",
                    frameworkGet.status === 200 &&
                        ok.status === 200 &&
                        withoutClock(frameworkGet.raw) === withoutClock(ok.raw) &&
                        withoutClock(ok.raw) !== ok.raw,
                    `framework=${frameworkGet.status} direct=${ok.status} identical-modulo-clock=${String(withoutClock(frameworkGet.raw) === withoutClock(ok.raw))}`,
                )
                checkInvertible(
                    "MEASURED: no Allow header leaks onto a 200 - Allow belongs to a method refusal and to OPTIONS, and nowhere else",
                    ok.headers.allow === undefined && frameworkGet.headers.allow === undefined,
                    `200 headers=[${Object.keys(ok.headers).sort().join(",")}]`,
                )
                const noWorkspaceGet = await call(api.preview(get(BASE)))
                checkInvertible(
                    "MEASURED: no Allow header leaks onto a 400 either, so `failure` did not start attaching it generally",
                    noWorkspaceGet.status === 400 && noWorkspaceGet.headers.allow === undefined,
                    `400 status=${noWorkspaceGet.status} headers=[${Object.keys(noWorkspaceGet.headers).sort().join(",")}]`,
                )

                // ---- HEAD ----------------------------------------------------------------
                // The framework's HEAD is not a handler of its own: it IS the GET entry, by assignment.
                // Asserted by reference identity, because that is the fact that makes the service - not the
                // framework - responsible for what a HEAD request gets back.
                checkInvertible(
                    "MEASURED: next@16.3.3 serves HEAD by invoking the GET handler itself - the derived HEAD entry is the SAME function object as GET, so a HEAD request reaches this service with method HEAD",
                    derived.HEAD === derived.GET && derived.GET === routeExports.GET,
                    `HEAD===GET: ${String(derived.HEAD === derived.GET)}; GET is the exported handler: ${String(derived.GET === routeExports.GET)}`,
                )
                const headed = await call(api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: "HEAD" })))
                const frameworkHead = await call(
                    Promise.resolve(derived.HEAD(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: "HEAD" }))),
                )
                checkInvertible(
                    "MEASURED: HEAD is 200 with NO CONTENT - RFC 9110 9.3.2 - and it is 200 on both paths, so the framework and the service no longer disagree about whether this resource has a HEAD",
                    headed.status === 200 && frameworkHead.status === 200 && headed.raw === "" && frameworkHead.raw === "",
                    `direct=${headed.status} raw=${JSON.stringify(headed.raw)}; framework=${frameworkHead.status} raw=${JSON.stringify(frameworkHead.raw)}`,
                )
                checkInvertible(
                    "MEASURED: HEAD sends the same headers GET would have sent, and a Content-Length equal to the BYTE length of the content GET returned - so a HEAD caller learns the size without fetching it",
                    headed.headers["content-type"] === ok.headers["content-type"] &&
                        headed.headers["content-length"] === String(new TextEncoder().encode(ok.raw).length) &&
                        new TextEncoder().encode(ok.raw).length > 0,
                    `HEAD content-length=${JSON.stringify(headed.headers["content-length"] ?? null)} GET bytes=${new TextEncoder().encode(ok.raw).length} content-type match=${String(headed.headers["content-type"] === ok.headers["content-type"])}`,
                )
                // HEAD RUNS THE WHOLE GET PATH INCLUDING AUTHORIZATION, which is the half of RFC 9110
                // 9.3.2 that a "HEAD is cheap, skip the work" shortcut would break. A HEAD that
                // short-circuited before `operations.summary` would answer 200 to an unauthenticated
                // caller and turn this surface into a membership oracle, so the refusal statuses are
                // asserted, not just the success one. No authorization POLICY is changed here - these are
                // the same 401 and 403 GET has always produced, now proven to apply to HEAD as well.
                identity.current = null
                const anonHead = await call(
                    api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: "HEAD" })),
                )
                identity.current = ids.userB
                const foreignHead = await call(
                    api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: "HEAD" })),
                )
                identity.current = ids.userA
                checkInvertible(
                    "MEASURED: HEAD is authorized exactly as GET is - signed out is 401 and a non-member is 403, both with no content - so supporting HEAD did not open an unauthenticated read",
                    anonHead.status === 401 &&
                        anonHead.status === anon.status &&
                        foreignHead.status === 403 &&
                        anonHead.raw === "" &&
                        foreignHead.raw === "",
                    `anon HEAD=${anonHead.status} (anon GET=${anon.status}), foreign HEAD=${foreignHead.status}, bodies empty=${String(anonHead.raw === "" && foreignHead.raw === "")}`,
                )

                // ---- OPTIONS -------------------------------------------------------------
                // The framework answers this one without reaching a handler, so the service's answer only
                // matters to a direct caller of the singleton - and it is exactly the framework's answer,
                // which is what makes the two paths agree instead of merely coexisting.
                const frameworkOptions = await call(
                    Promise.resolve(derived.OPTIONS(new Request(BASE, { method: "OPTIONS" }))),
                )
                const optioned = await call(api.preview(new Request(BASE, { method: "OPTIONS" })))
                checkInvertible(
                    "MEASURED: OPTIONS is 204 with Allow and no content, and the SERVICE's answer is byte-identical to the one next@16.3.3 generates for this route - status and header both",
                    frameworkOptions.status === 204 &&
                        optioned.status === frameworkOptions.status &&
                        optioned.headers.allow === frameworkOptions.headers.allow &&
                        optioned.raw === "" &&
                        frameworkOptions.raw === "",
                    `framework=${frameworkOptions.status} allow=${JSON.stringify(frameworkOptions.headers.allow ?? null)}; service=${optioned.status} allow=${JSON.stringify(optioned.headers.allow ?? null)}`,
                )
                checkInvertible(
                    "MEASURED: that agreed Allow value is the pinned literal, so all three statements - this harness, the service and the framework - name the same method set rather than agreeing with each other about an arbitrary one",
                    frameworkOptions.headers.allow === EXPECTED_ALLOW &&
                        optioned.headers.allow === EXPECTED_ALLOW &&
                        posted.headers.allow === EXPECTED_ALLOW,
                    `expected=${EXPECTED_ALLOW}; framework OPTIONS=${JSON.stringify(frameworkOptions.headers.allow ?? null)}; service OPTIONS=${JSON.stringify(optioned.headers.allow ?? null)}; 405=${JSON.stringify(posted.headers.allow ?? null)}`,
                )
                // EVERY METHOD NAMED IN Allow IS ACTUALLY ACCEPTED. This is the assertion the old HEAD
                // check was trying to be, and it now has three methods to check instead of one - which is
                // the only reason the old version could pass while advertising a set of size one.
                const advertised = EXPECTED_ALLOW.split(", ")
                const advertisedStatuses: Array<{ method: string; status: number }> = []
                for (const method of advertised) {
                    const answered = await call(api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method })))
                    advertisedStatuses.push({ method, status: answered.status })
                }
                checkInvertible(
                    "MEASURED: every one of the three methods Allow names is actually honoured - none of them answers 405 - so the header is not advertising something this surface refuses",
                    advertisedStatuses.length === 3 &&
                        advertisedStatuses.every((entry) => entry.status !== 405 && entry.status < 300),
                    advertisedStatuses.map((entry) => `${entry.method}=${entry.status}`).join(" "),
                )

                // ---- a real write verb ---------------------------------------------------
                // A state-changing verb must be refused before any parameter is read, or a POST with no
                // workspaceId is reported as a missing parameter and the method problem is never named.
                const postedBare = await call(api.preview(new Request(BASE, { method: "POST" })))
                checkInvertible(
                    "the method is checked BEFORE the parameters, so a POST is refused as a method and not reported as a missing workspaceId",
                    postedBare.status === 405 &&
                        !/workspaceId/.test(String((postedBare.body.error as { message?: string } | undefined)?.message ?? "")),
                    String((postedBare.body.error as { message?: string } | undefined)?.message ?? "").slice(0, 70),
                )
                for (const verb of ["PUT", "PATCH", "DELETE"] as const) {
                    const other = await call(api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: verb })))
                    checkInvertible(
                        `MEASURED: the service refuses ${verb} too, so the guarantee is about the UNSAFE methods rather than about POST alone`,
                        other.status === 405 &&
                            errCode(other) === "METHOD_NOT_ALLOWED" &&
                            other.headers.allow === EXPECTED_ALLOW,
                        `status=${other.status} code=${errCode(other)} allow=${JSON.stringify(other.headers.allow ?? null)}`,
                    )
                }
                // THE FRAMEWORK'S REFUSAL IS WEAKER THAN THE SERVICE'S, and that asymmetry is measured
                // rather than glossed. next's own 405 for an unimplemented method is `new Response(null,
                // { status: 405 })` with NO Allow header at all, so a POST that never reaches a handler is
                // told less than one that does. It is the framework's behaviour and not this route's
                // policy - there is nothing to fix here - but it IS the reason the service-level guard
                // earns its place: it is the only path on which a refused caller is told what to send.
                const frameworkPost = await call(
                    Promise.resolve(derived.POST(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: "POST" }))),
                )
                checkInvertible(
                    "MEASURED: the framework refuses POST itself with a bare 405 carrying no Allow, while the service's own 405 carries the full set - so the service-level guard is what makes a refusal actionable",
                    frameworkPost.status === 405 &&
                        frameworkPost.headers.allow === undefined &&
                        posted.status === 405 &&
                        posted.headers.allow === EXPECTED_ALLOW,
                    `framework POST=${frameworkPost.status} allow=${JSON.stringify(frameworkPost.headers.allow ?? null)}; service POST=${posted.status} allow=${JSON.stringify(posted.headers.allow ?? null)}`,
                )
                const data = (ok.body.data ?? {}) as Record<string, unknown>
                const items = (data.items ?? []) as Array<Record<string, unknown>>

                checkInvertible(
                    "the preview body carries the plan, its coverage and its stated absences",
                    Array.isArray(data.items) &&
                        Array.isArray(data.covers) &&
                        typeof data.doesNotCover === "object" &&
                        typeof data.explanation === "string" &&
                        typeof data.asOf === "string",
                    `keys=${Object.keys(data).sort().join(",")}`,
                )
                checkInvertible(
                    "MEASURED: executed is the literal false in the EMITTED JSON, not merely in the type",
                    data.executed === false && /"executed":\s*false/.test(ok.raw),
                    `executed=${JSON.stringify(data.executed)}`,
                )
                checkInvertible(
                    "MEASURED: sideEffects is an empty array in the EMITTED JSON",
                    Array.isArray(data.sideEffects) && (data.sideEffects as unknown[]).length === 0,
                    `sideEffects=${JSON.stringify(data.sideEffects)}`,
                )
                checkInvertible(
                    "the response ships its own limitations, so a caller reading the body reads them",
                    Array.isArray(data.limitations) &&
                        (data.limitations as string[]).length === DUE_WORK_PREVIEW_LIMITATIONS.length,
                    `${(data.limitations as string[] | undefined)?.length ?? 0} limitations`,
                )

                // ---- the wording rule, over AFFIRMATIVE owner-facing prose -----
                // Scanning the whole serialised body would be wrong in two ways, and one run found both.
                // `executed` is a FIELD NAME the contract requires. And `limitations` are DENIALS: the
                // sentence "nothing has been sent or dispatched" is the promise itself, so a word ban
                // reports the rule as a breach of the rule. So the ban applies to prose that AFFIRMS
                // something, and `limitations` is pinned by exact equality below instead - stronger,
                // because it fixes every sentence rather than the absence of seven words.
                const affirmative: Array<{ where: string; text: string }> = [
                    { where: "explanation", text: String(data.explanation ?? "") },
                    { where: "scopeNotice", text: String(data.scopeNotice ?? "") },
                    ...Object.entries((data.doesNotCover ?? {}) as Record<string, string>).map(([k, v]) => ({
                        where: `doesNotCover.${k}`,
                        text: String(v),
                    })),
                ]
                // PRECONDITION FOR THE WORD SCAN BELOW, and it is not decoration.
                //
                // Every entry above reads `String(data.<field> ?? "")`. On any response that lacks `data`
                // at all - an empty plan shape, a refusal, a renamed field, a 503 - those become empty
                // strings, `doesNotCover` contributes nothing, and every one of the nine forbidden-word
                // assertions then passes by scanning nothing. That is the exact vacuity this repository
                // audits for, sitting inside the assertion rather than the code. So the scanned prose is
                // pinned as non-empty first, field by field rather than in total, because one populated
                // field would otherwise cover for an empty one.
                const scannedChars = affirmative.reduce((n, p) => n + p.text.trim().length, 0)
                checkInvertible(
                    "MEASURED: the prose the forbidden-word loop scans is actually non-empty, so the word assertions cannot pass by scanning nothing",
                    affirmative.length >= 2 &&
                        affirmative.every((p) => p.text.trim().length > 0) &&
                        scannedChars > 0,
                    `${affirmative.length} fields, ${scannedChars} chars, empty=[${affirmative.filter((p) => p.text.trim().length === 0).map((p) => p.where).join(",") || "none"}]`,
                )
                for (const word of FORBIDDEN_PREVIEW_WORDS) {
                    const hits = affirmative.filter((p) => new RegExp(`\\b${word}\\b`, "i").test(p.text))
                    checkInvertible(
                        `MEASURED: this surface's affirmative prose never says "${word}"`,
                        hits.length === 0,
                        hits.length === 0 ? word : hits.map((h) => `${h.where}: ${h.text.slice(0, 90)}`).join(" | "),
                    )
                }
                checkInvertible(
                    "MEASURED: limitations are the contract's exact sentences, not merely free of banned words",
                    JSON.stringify(data.limitations) === JSON.stringify([...DUE_WORK_PREVIEW_LIMITATIONS]),
                    `${((data.limitations ?? []) as string[]).length} shipped`,
                )
                const allProse = [...affirmative.map((p) => p.text), ...((data.limitations ?? []) as string[])]
                    .join(" ")
                    .toLowerCase()
                for (const word of REQUIRED_PREVIEW_WORDS) {
                    checkInvertible(
                        `this surface's own prose does say "${word}", so honest wording is a positive requirement`,
                        new RegExp(`\\b${word}`, "i").test(allProse),
                        word,
                    )
                }
                // The engine's inherited text is NOT this surface's claim, but a reader cannot tell the
                // difference, so it is measured and reported. Deliberately NOT an assertion: its
                // condition would have to be the literal `true`, which is the vacuity this repository
                // audits for. A report belongs on stdout, not in the assertion count.
                const inherited = items
                    .map((i) => `${String(i.label)} ${String(i.attentionReason)}`)
                    .join(" ")
                const inheritedHits =
                    FORBIDDEN_PREVIEW_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(inherited)).join(",") || "none"
                console.log(
                    `REPORT  forbidden words present in engine-owned item text, copied verbatim by this surface: ${inheritedHits}`,
                )

                // ---- ordering is explained, and non-vacuous --------------------
                checkInvertible(
                    "the seeded overdue and upcoming work both appear, so ordering is not asserted on an empty plan",
                    items.some((i) => i.id === ids.lateA) && items.some((i) => i.id === ids.soonA),
                    `${items.length} items`,
                )
                checkInvertible(
                    "overdue work precedes dated work in the proposed order",
                    (() => {
                        const late = items.findIndex((i) => i.id === ids.lateA)
                        const soon = items.findIndex((i) => i.id === ids.soonA)
                        return late >= 0 && soon >= 0 && late < soon
                    })(),
                    `late@${items.findIndex((i) => i.id === ids.lateA)} soon@${items.findIndex((i) => i.id === ids.soonA)}`,
                )
                check(
                    "every item explains its position rather than asserting it",
                    items.length > 0 && items.every((i) => typeof i.orderingReason === "string" && String(i.orderingReason).length > 0),
                )
                check(
                    "every item carries the OWNING engine's attention reason",
                    items.length > 0 && items.every((i) => typeof i.attentionReason === "string" && String(i.attentionReason).length > 0),
                )
                check(
                    "every item's date is an ISO string or null, never a Date object",
                    items.length > 0 && items.every((i) => i.at === null || typeof i.at === "string"),
                )
                // Deliberately NOT `JSON.stringify(JSON.parse(ok.raw)) === JSON.stringify(ok.body)`:
                // `ok.body` IS `JSON.parse(ok.raw)`, so that comparison is `x === x` and cannot fail.
                // What is worth asserting is that the wire bytes are valid JSON carrying the envelope.
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

                // ---- determinism ----------------------------------------------
                // The contract's claim is about ONE summary: the same summary and the same asOf give a
                // byte-identical body. Two HTTP calls read the clock twice, so asOf legitimately differs;
                // asserting raw equality there would be asserting something the contract never promised.
                const summaryOnce = await engine.summary(ids.wsA, { horizonHours: null })
                const a = JSON.stringify(toDueWorkPreview(planDueWork(summaryOnce)))
                const b = JSON.stringify(toDueWorkPreview(planDueWork(summaryOnce)))
                checkInvertible("MEASURED: one summary serialises byte-identically twice", a === b, `${a.length} vs ${b.length} bytes`)

                const second = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}`)))
                const strip = (raw: string) => raw.replace(/"asOf":"[^"]+"/g, '"asOf":"<clock>"')
                checkInvertible(
                    "MEASURED: two successive requests differ only in the clock reading",
                    strip(ok.raw) === strip(second.raw),
                    "asOf normalised",
                )

                // ---- isolation and non-enumeration ----------------------------
                const foreign = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsB}`)))
                checkInvertible(
                    "previewing a workspace the caller is not a member of is 403",
                    foreign.status === 403,
                    `status=${foreign.status} code=${errCode(foreign)}`,
                )
                const ghost = await call(api.preview(get(`${BASE}?workspaceId=${RUN}_ghost_ws`)))
                checkInvertible(
                    "MEASURED: a foreign workspace and a nonexistent one are BYTE-IDENTICAL refusals",
                    refusal(foreign) === refusal(ghost) && foreign.status === ghost.status,
                    `${foreign.status}/${ghost.status}`,
                )
                // Switching identity BEFORE comparing, or the refusal happens at workspace authorization
                // and never reaches the code being tested - a mistake made twice in this repository.
                identity.current = ids.userB
                const asB = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsB}`)))
                checkInvertible(
                    "the other tenant CAN read its own workspace, so the 403 above was about membership",
                    asB.status === 200,
                    `status=${asB.status}`,
                )
                const bItems = ((asB.body.data as Record<string, unknown>)?.items ?? []) as Array<Record<string, unknown>>
                checkInvertible(
                    "MEASURED: tenant B's plan contains none of tenant A's work",
                    !bItems.some((i) => String(i.id).includes("_latea") || String(i.id).includes("_soona")),
                    `${bItems.length} items`,
                )
                identity.current = ids.userA

                // ---- coverage is named ----------------------------------------
                checkInvertible(
                    "coverage is declared and non-trivial, so the total cannot be read as a total of everything",
                    Array.isArray(data.covers) &&
                        (data.covers as string[]).length > 0 &&
                        Object.keys((data.doesNotCover ?? {}) as Record<string, string>).length > 0,
                    `covers=${(data.covers as string[] | undefined)?.length ?? 0} doesNotCover=${Object.keys((data.doesNotCover ?? {}) as Record<string, string>).length}`,
                )
                // mixedScope is a MEASUREMENT, and this fixture is the single-boundary half of it.
                //
                // It used to be constant-true: engine.ts computed it over the frozen OPERATIONS_DOMAIN_SCOPE
                // map, which always holds both "profile" and "workspace", so `scopes.size > 1` was true for
                // every workspace and every dataset including an empty one. The assertion here said exactly
                // that and no more, on purpose, and its comment recorded that a data claim could not be made.
                //
                // `deriveMixedScope` now reads the domains that actually returned rows, so the claim CAN be
                // made and is made below. This seed gives tenant A field jobs and nothing workspace-scoped -
                // there is no CaseProject and no CaseMilestone in it - so every item in this plan was read on
                // the profile boundary and the honest answer is FALSE. Under the old derivation this arm was
                // unreachable; asserting it is what stops the constant coming back.
                //
                // The false is then shown to be a measurement rather than a new constant: the same derivation,
                // handed the same domain list with the workspace-scoped domain credited a row, answers true.
                // That is a counterfactual INPUT to a pure function, not a change to the engine, and it is
                // what makes the false above discriminating. The real mixed dataset is proven elsewhere -
                // check-operations-runtime.ts over real rows and check-due-work-panel.ts over a seeded engine.
                const previewItems = (data.items ?? []) as Array<Record<string, unknown>>
                const previewBoundaries = [
                    ...new Set(previewItems.map((entry) => OPERATIONS_DOMAIN_SCOPE[String(entry.domain) as OperationsDomain])),
                ]
                    .sort()
                    .join(",")
                const creditedWorkspaceRow = summaryOnce.domains.map((entry) =>
                    entry.scope === "workspace" ? { ...entry, count: entry.count + 1 } : entry,
                )
                checkInvertible(
                    "SINGLE BOUNDARY YIELDS FALSE: every item in this plan was read on the profile boundary - recomputed from the emitted items and the frozen scope map - and mixedScope reports false, the arm the old constant-true derivation could not reach",
                    previewItems.length > 0 && previewBoundaries === "profile" && data.mixedScope === false,
                    `${previewItems.length} emitted items span [${previewBoundaries}] and mixedScope=${String(data.mixedScope)}`,
                )
                checkInvertible(
                    "MEASURED: the emitted mixedScope is what the producer's own derivation says about this summary, and that derivation answers TRUE when a workspace-scoped domain is credited a row - so the false above discriminates instead of being a new constant",
                    data.mixedScope === deriveMixedScope(summaryOnce.domains) &&
                        deriveMixedScope(summaryOnce.domains) === false &&
                        deriveMixedScope(creditedWorkspaceRow) === true,
                    `emitted=${String(data.mixedScope)} derived=${String(deriveMixedScope(summaryOnce.domains))} counterfactual-with-workspace-row=${String(deriveMixedScope(creditedWorkspaceRow))}`,
                )

                // ---- 400 -------------------------------------------------------
                const noWorkspace = await call(api.preview(get(BASE)))
                checkInvertible(
                    "a missing workspaceId is 400 rather than a silent empty plan",
                    noWorkspace.status === 400 && errCode(noWorkspace) === "BAD_REQUEST",
                    `status=${noWorkspace.status} code=${errCode(noWorkspace)}`,
                )
                const blank = await call(api.preview(get(`${BASE}?workspaceId=%20`)))
                check("a whitespace-only workspaceId is 400, not treated as present", blank.status === 400)
                const badHorizon = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=abc`)))
                checkInvertible(
                    "a non-numeric horizon is 400 rather than silently defaulted",
                    badHorizon.status === 400,
                    `status=${badHorizon.status}`,
                )
                const zero = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=0`)))
                check("a zero horizon is 400", zero.status === 400, `status=${zero.status}`)
                const huge = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=100000`)))
                check("an out-of-range horizon is 400 rather than an unbounded scan", huge.status === 400)
                const good = await call(api.preview(get(`${BASE}?workspaceId=${ids.wsA}&horizonHours=72`)))
                check(
                    "an in-range horizon is accepted and echoed back",
                    good.status === 200 && (good.body.data as { horizonHours?: number }).horizonHours === 72,
                )

                // ---- envelope, one per status ----------------------------------
                // The expected status is FIXED per case, not derived from the observed one. Deriving it
                // (`called.status < 400 ? … : …`) meant a 403 regressing to a 200 flipped the
                // expectation with it and the loop still passed.
                for (const [label, called, expectedStatus] of [
                    ["200", ok, 200],
                    ["400", noWorkspace, 400],
                    ["401", anon, 401],
                    ["403", foreign, 403],
                    ["405", posted, 405],
                ] as Array<[string, Called, number]>) {
                    const keys = Object.keys(called.body).sort().join(",")
                    const expected = expectedStatus < 400 ? "data,ok" : "error,ok"
                    checkInvertible(
                        `the ${label} response really is ${label} and uses the shared envelope shape`,
                        called.status === expectedStatus && keys === expected,
                        `status=${called.status} keys=${keys}`,
                    )
                }

                throw new Rollback()
            })
        } catch (e) {
            if (!(e instanceof Rollback)) throw e
        }

        // ---- 503, and the leak assertion that is its point ---------------------
        // THE MOCK MUST REACH THE THROW. The first version defined only `workspace.findUnique`, but
        // requireScope goes through PersistedTenancy first: `user.findUnique` (tenancy.ts:75) then
        // `membership.findUnique` (tenancy.ts:78), and only then `workspace.findUnique`
        // (shared.ts:45). With those undefined the call died as a TypeError before the DSN-bearing
        // error was ever thrown, so all seven fragment assertions below were passing against an error
        // that contained no secret. They asserted nothing. The chain is now satisfied so the injected
        // secret is genuinely produced and genuinely has to be suppressed.
        const leakProbe = { workspaceLookups: 0 }
        const brokenPrisma = {
            user: {
                findUnique: async () => ({ id: `${RUN}_leak_user` }),
            },
            membership: {
                findUnique: async () => ({
                    id: `${RUN}_leak_member`,
                    role: "OWNER",
                    membershipLocations: [] as Array<{ locationId: string }>,
                }),
            },
            workspace: {
                findUnique: async () => {
                    leakProbe.workspaceLookups += 1
                    throw new Error("SECRET_DETAIL postgres://user:pw@dbhost:5432/personalink?sslmode=require")
                },
            },
        } as unknown as PrismaClient
        const brokenIdentity = new ControlledIdentity()
        brokenIdentity.current = "clerk_whoever"
        const brokenApi = new DueWorkApiService(
            new OperationsService(new OperationsContext(brokenPrisma, new PersistedTenancy(brokenPrisma, brokenIdentity))),
        )
        // ---- THE SERVER LOG, which is where the secret actually went -----------
        //
        // The fragment assertions here used to cover the RESPONSE only, and the response was clean. The LOG
        // was not: `logUnexpectedFailure` passed the whole error object to console.error, so this injected
        // DSN - credentials, host, port, database and query string - was printed in full to stderr on every
        // unexpected failure. A harness that proves the client is safe and never looks at the server side
        // proves half of the thing it is named after, and the half it skipped was the one that leaked.
        //
        // console.error is captured rather than the process's stderr, because that is the exact call the
        // code under test makes. Non-string arguments go through util.inspect, which is what console.error
        // does with them anyway - so if this code went back to passing an Error object, the capture sees its
        // message and stack exactly as an operator would and the fragment assertions go red. A capture that
        // only concatenated string arguments would miss precisely the defect being fixed.
        const loggedLines: string[] = []
        const realConsoleError = console.error
        console.error = (...args: unknown[]): void => {
            loggedLines.push(args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 6 }))).join(" "))
        }
        let captured: Called | null = null
        try {
            captured = await call(brokenApi.preview(get(`${BASE}?workspaceId=whatever`)))
        } finally {
            console.error = realConsoleError
        }
        if (captured === null) {
            // THROW rather than `process.exit(1)`. Behaviour is identical - main().catch exits 1 - but a
            // mid-file exit decision with 14 assertions after it is indistinguishable, to any static
            // reader and to check-harness-exit-integrity.ts, from the frozen-verdict defect that scanner
            // exists to catch. It flagged this line as a REAL_DEFECT and it was right to: the shape is the
            // defect even when the intent is a precondition abort. An abort belongs in the exception path.
            throw new Error("ABORT: the 503 probe produced no response at all")
        }
        const broken: Called = captured
        const loggedAll = loggedLines.join("\n")
        const surfaceLogs = loggedLines.filter((line) => line.includes("[operations/due-work]"))
        // The precondition for every leak assertion below, now covering BOTH paths. Without the first half
        // the mock can silently stop reaching the throw - a refactor of the tenancy chain would do it - and
        // the response assertions go back to passing against an error containing no secret. Without the
        // second half the LOG assertions pass because nothing was logged at all, which is the same vacuity
        // one layer down: deleting the log call would satisfy every "leaks no X" assertion perfectly.
        checkInvertible(
            "MEASURED: the injected secret was produced AND the log path ran - the failure path reached the throw and logged exactly once",
            leakProbe.workspaceLookups === 1 && surfaceLogs.length === 1,
            `workspace lookups=${leakProbe.workspaceLookups} surface log lines=${surfaceLogs.length} total captured=${loggedLines.length}`,
        )
        checkInvertible(
            "a dependency failure is 503 rather than a 500 or a stack trace",
            broken.status === 503 && errCode(broken) === "DEPENDENCY_UNAVAILABLE",
            `status=${broken.status} code=${errCode(broken)}`,
        )
        for (const fragment of ["SECRET_DETAIL", "postgres://", "user:pw", "dbhost", "5432", "sslmode", "personalink"]) {
            checkInvertible(
                `MEASURED: the 503 body leaks no "${fragment}"`,
                !broken.raw.toLowerCase().includes(fragment.toLowerCase()),
                fragment,
            )
        }
        // THE SAME SEVEN FRAGMENTS, AGAINST THE SERVER LOG. This is the set that was missing, and the one
        // that was failing in reality: every assertion above already passed while the line below it printed
        // the whole DSN to stderr.
        for (const fragment of ["SECRET_DETAIL", "postgres://", "user:pw", "dbhost", "5432", "sslmode", "personalink"]) {
            checkInvertible(
                `MEASURED: the SERVER LOG leaks no "${fragment}"`,
                !loggedAll.toLowerCase().includes(fragment.toLowerCase()),
                fragment,
            )
        }
        // Credential-shaped text in general, not only this fixture's fragments. The injected secret is one
        // sample; a scan for the SHAPE catches a driver that formats its DSN some other way.
        checkInvertible(
            "MEASURED: the server log contains no URI with a scheme at all, so no connection string of any shape survives",
            !/[a-z][a-z0-9+.-]*:\/\//i.test(loggedAll),
            loggedAll.slice(0, 120),
        )
        checkInvertible(
            "MEASURED: the server log contains no query string and no key=value pair, so no credential can ride in as a parameter",
            !/\?[^\s]*=/.test(loggedAll) && !/(password|passwd|secret|token|apikey|api_key)\s*[:=]/i.test(loggedAll),
            "no query string, no credential-shaped assignment",
        )

        // ---- AND THE LOG MUST STILL BE WORTH READING ---------------------------
        //
        // A sanitizer that logs nothing satisfies every "leaks no X" assertion above perfectly, and it is
        // not a fix - it is the ORIGINAL defect, the one where a dependency outage left no trace on the
        // server and a TypeError in the plan composition was indistinguishable from it. So usefulness is
        // asserted rather than assumed. Deleting the console.error call would turn all nine assertions above
        // green and these four red, which is the correct verdict on that change.
        checkInvertible(
            "MEASURED: the sanitized log still names WHAT failed - the error's kind reaches the operator",
            /"kind":"Error"/.test(loggedAll),
            surfaceLogs.join(" ").slice(-200),
        )
        checkInvertible(
            "MEASURED: the sanitized log still says roughly WHERE it failed - real source locations survive",
            /"frames":\[[^\]]/.test(loggedAll) && /\.ts:\d+:\d+/.test(loggedAll),
            `${(loggedAll.match(/"framesKept":\d+/) ?? ["framesKept:?"])[0]}`,
        )
        checkInvertible(
            "MEASURED: the log names the failing boundary and the status it answered, so an operator can find it by grep",
            /\[operations\/due-work\]/.test(loggedAll) && /DEPENDENCY_UNAVAILABLE/.test(loggedAll),
            "tagged with the surface and the status",
        )
        // The mechanism, asserted directly rather than inferred from the two facts above. V8 puts
        // "Name: message" on the stack's FIRST line, which is exactly where the DSN was, so keeping frames
        // while dropping that line is the whole technique - and both halves have to be true at once.
        checkInvertible(
            "MEASURED: the log keeps stack FRAMES while dropping the message line they were attached to",
            /"framesKept":[1-9]/.test(loggedAll) && !/"message":/.test(loggedAll),
            `${(loggedAll.match(/"framesKept":\d+/) ?? ["none"])[0]}, no message field emitted`,
        )
        checkInvertible(
            "the 503 message names THIS surface rather than the one whose envelope helper it reuses",
            /due-work plan is temporarily unavailable/i.test(broken.raw) &&
                !/Field jobs/i.test(broken.raw) &&
                !/Operations are temporarily unavailable/i.test(broken.raw),
            String((broken.body.error as { message?: string } | undefined)?.message ?? ""),
        )
        check(
            "the 503 uses the shared envelope shape too",
            Object.keys(broken.body).sort().join(",") === "error,ok",
            `keys=${Object.keys(broken.body).sort().join(",")}`,
        )

        // ---- THE SECOND LOG PROBE: THE CAUSE CHAIN, AND THE FRAME REDACTOR ------
        //
        // The probe above throws a plain Error whose own message carries the secret, which is the shape
        // the log was originally fixed for. It cannot exercise either of the two defects an adversarial
        // review then found, so this second probe exists for exactly those, and it is a separate capture so
        // that nothing here can move an assertion above.
        //
        // DEFECT ONE: THE LOG READ ONLY THE TOP-LEVEL ERROR. `undici` - the fetch implementation Node
        // ships - raises `TypeError: fetch failed` and puts the real failure in `cause`. So a refused
        // connection was logged as `kind: "TypeError", code: null`, next to prose telling the reader that a
        // TypeError is a defect and that retrying cannot help. The log inverted its own purpose: it
        // presented an outage as a bug, and it did so confidently. `AggregateError` failed the same way by
        // a different route - its `code` is unset and every real error sits in `.errors`, which nothing
        // read. The chain is now walked, and each link contributes KIND AND CODE ONLY, through the same two
        // allowlist functions as the top-level error.
        //
        // DEFECT TWO: THE REDACTOR DESTROYED THE EVIDENCE. It replaced any `scheme://` span up to the next
        // whitespace with one marker, and an ESM frame IS such a span - `at f (file:///C:/app/x.js:10:5)` -
        // so file, line and column, the three things a stack frame is logged for, went together. A `?`
        // anywhere on the line cost the position too. It is now narrowed to the AUTHORITY.
        //
        // The error below is built to be hostile on every axis at once: a wrapped cause carrying a real
        // driver code, an AggregateError branch, a BARE STRING cause holding a whole DSN, a cause whose
        // `code` is itself a DSN, a cycle back to the root, a MULTI-LINE message whose continuation line
        // begins with "at " so it would be mistaken for a frame, and a stack whose frames are the four
        // shapes the redactor has to tell apart. Each marker is unique, so any leak is attributable.
        const probeAuthority = `${["svcuser", "hunter2"].join(":")}@${["dbhost.internal", "5432"].join(":")}`
        // Assembled from parts on purpose: no line of this file is itself a complete connection string,
        // and the run's own logs therefore cannot be made to contain one by quoting this source.
        const probeDsn = `postgres://${probeAuthority}/appdb?sslmode=require`
        const CAUSE_MESSAGE_MARKER = "CAUSEMESSAGE_MUST_NOT_APPEAR"
        const STRING_CAUSE_MARKER = "STRINGCAUSE_MUST_NOT_APPEAR"
        const CONTINUATION_MARKER = "MESSAGECONTINUATION_MUST_NOT_APPEAR"
        const HOSTILE_CODE = `postgres://${probeAuthority}/appdb`

        const deepest = Object.assign(new Error(`${CAUSE_MESSAGE_MARKER} inner ${probeDsn}`), { code: "ENOTFOUND" })
        const hostileCoded = Object.assign(new Error("nothing useful here"), { code: HOSTILE_CODE })
        const aggregate = new AggregateError(
            [deepest, hostileCoded, `${STRING_CAUSE_MARKER} ${probeDsn}`],
            "every attempt failed",
        )
        const driverCause = Object.assign(new Error(`${CAUSE_MESSAGE_MARKER} outer ${probeDsn}`), {
            code: "ECONNREFUSED",
            cause: aggregate,
        })
        // A multi-line message with an "at "-prefixed continuation. V8's stack header is `Name: message`,
        // so lines 2..k of this message sit in `error.stack` and face the same frame test as a real frame.
        const wrappedMessage = `fetch failed\n    at ${CONTINUATION_MARKER} (/tmp/pretend.js:1:1)`
        const wrapped = Object.assign(new TypeError(wrappedMessage), { cause: driverCause })
        // The cycle: the deepest link points back at the root. Legal, and it makes an unguarded walk
        // recurse until the stack dies while answering a 503.
        Object.assign(deepest, { cause: wrapped })
        // The stack is set explicitly because a real ts-node stack contains no URI at all, and the
        // redactor's whole job is what it does to one. Four frames, four different answers required:
        // an ESM file URI, a bundler query string, a DSN, and a plain Windows path.
        wrapped.stack =
            `TypeError: ${wrappedMessage}\n` +
            `    at composePreview (file:///C:/probe/app/src/lib/x.js:10:5)\n` +
            `    at bundled (file:///C:/probe/app/y.js?v=abc123:20:7)\n` +
            `    at driverConnect (${probeDsn})\n` +
            `    at last (C:\\probe\\app\\z.ts:33:11)`

        const causeProbe = { workspaceLookups: 0 }
        const causePrisma = {
            user: { findUnique: async () => ({ id: `${RUN}_cause_user` }) },
            membership: {
                findUnique: async () => ({
                    id: `${RUN}_cause_member`,
                    role: "OWNER",
                    membershipLocations: [] as Array<{ locationId: string }>,
                }),
            },
            workspace: {
                findUnique: async () => {
                    causeProbe.workspaceLookups += 1
                    throw wrapped
                },
            },
        } as unknown as PrismaClient
        const causeIdentity = new ControlledIdentity()
        causeIdentity.current = "clerk_whoever"
        const causeApi = new DueWorkApiService(
            new OperationsService(new OperationsContext(causePrisma, new PersistedTenancy(causePrisma, causeIdentity))),
        )
        const causeLines: string[] = []
        const realErrorForCauseProbe = console.error
        console.error = (...args: unknown[]): void => {
            causeLines.push(args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 8 }))).join(" "))
        }
        let causeCaptured: Called | null = null
        try {
            causeCaptured = await call(causeApi.preview(get(`${BASE}?workspaceId=whatever`)))
        } finally {
            console.error = realErrorForCauseProbe
        }
        if (causeCaptured === null) {
            throw new Error("ABORT: the cause-chain probe produced no response at all")
        }
        const causeLog = causeLines.join("\n")
        const causeSurfaceLogs = causeLines.filter((line) => line.includes("[operations/due-work]"))

        /** The JSON half of the log line, parsed so the assertions are about FIELDS rather than substrings. */
        type LoggedCauseLine = Readonly<{ via?: unknown; kind?: unknown; code?: unknown }>
        const loggedPayload = (): Record<string, unknown> | null => {
            const line = causeSurfaceLogs[0] ?? ""
            const at = line.indexOf('{"kind"')
            if (at < 0) return null
            try {
                const parsed: unknown = JSON.parse(line.slice(at))
                return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
            } catch {
                return null
            }
        }
        const payload = loggedPayload()
        const loggedCauses: readonly LoggedCauseLine[] = Array.isArray(payload?.causes)
            ? (payload?.causes as LoggedCauseLine[])
            : []
        const causeAt = (via: string): LoggedCauseLine | undefined => loggedCauses.find((c) => c.via === via)
        const loggedFrames: readonly string[] = Array.isArray(payload?.frames)
            ? (payload?.frames as unknown[]).map((f) => String(f))
            : []
        const framesText = loggedFrames.join(" | ")

        // The precondition, in the same shape as the first probe's: the throw has to have been reached and
        // the log has to have run, or every "leaks no X" assertion below is satisfied by an empty string.
        checkInvertible(
            "MEASURED: the cause-chain probe reached the throw, logged exactly once, and the log line parsed - so the field assertions below are reading a real payload rather than nothing",
            causeProbe.workspaceLookups === 1 &&
                causeSurfaceLogs.length === 1 &&
                payload !== null &&
                loggedFrames.length === 4,
            `lookups=${causeProbe.workspaceLookups} surface lines=${causeSurfaceLogs.length} payload=${payload === null ? "unparsed" : "parsed"} frames=${loggedFrames.length}`,
        )
        // ---- TASK: the cause's KIND and CODE reach the log ---------------------
        checkInvertible(
            "MEASURED: the log reads through `cause`, so a wrapped driver failure is no longer reported as a bare TypeError - the top level is TypeError with no code, and the cause carries the real ECONNREFUSED",
            payload?.kind === "TypeError" &&
                payload?.code === null &&
                causeAt("cause")?.kind === "Error" &&
                causeAt("cause")?.code === "ECONNREFUSED",
            `top kind=${String(payload?.kind)} code=${JSON.stringify(payload?.code)}; cause kind=${String(causeAt("cause")?.kind)} code=${JSON.stringify(causeAt("cause")?.code)}`,
        )
        checkInvertible(
            "MEASURED: an AggregateError's `.errors` are read too - its own code is unset, so its branches ARE the diagnosis, and the ENOTFOUND inside one of them reaches the operator",
            causeAt("cause.cause")?.kind === "AggregateError" &&
                causeAt("cause.cause.errors[0]")?.code === "ENOTFOUND",
            `aggregate kind=${String(causeAt("cause.cause")?.kind)}; branch codes=[${loggedCauses.map((c) => JSON.stringify(c.code)).join(",")}]`,
        )
        checkInvertible(
            "MEASURED: the walk is BOUNDED and survives a cycle - the deepest link points back at the root error and the chain still terminates, at exactly the five links this error has and no sixth",
            loggedCauses.length === 5 &&
                loggedCauses.map((c) => String(c.via)).join(",") ===
                    "cause,cause.cause,cause.cause.errors[0],cause.cause.errors[1],cause.cause.errors[2]",
            `${loggedCauses.length} links: [${loggedCauses.map((c) => String(c.via)).join(",")}]`,
        )
        // ---- and the allowlist is NOT weakened to get them ---------------------
        checkInvertible(
            "MEASURED: a cause's MESSAGE cannot reach the log at any depth - neither the wrapped cause's, nor the one inside the AggregateError, nor the DSN either of them carries",
            !causeLog.includes(CAUSE_MESSAGE_MARKER) && !causeLog.includes(STRING_CAUSE_MARKER),
            `outer cause marker present=${causeLog.includes(CAUSE_MESSAGE_MARKER)}, string-cause marker present=${causeLog.includes(STRING_CAUSE_MARKER)}`,
        )
        checkInvertible(
            "MEASURED: a cause that IS a bare string - what `new Error(m, { cause: connectionString })` produces - is logged as its TYPE and nothing else, so its content has no path into the log",
            causeAt("cause.cause.errors[2]")?.kind === "string" && causeAt("cause.cause.errors[2]")?.code === null,
            `string cause logged as kind=${String(causeAt("cause.cause.errors[2]")?.kind)} code=${JSON.stringify(causeAt("cause.cause.errors[2]")?.code)}`,
        )
        checkInvertible(
            "MEASURED: a cause whose `code` is itself a connection string is REFUSED by the same allowlist as the top-level code - reading the chain did not buy the chain an exemption, over all five logged links",
            causeAt("cause.cause.errors[1]")?.code === null &&
                !causeLog.includes("dbhost.internal") &&
                // The length pin belongs INSIDE this condition and not three assertions above it. It is
                // pinned there too, which means the SUITE would notice an empty chain - but THIS assertion
                // would not, and "every logged code passes the allowlist" over zero logged codes is exactly
                // the shape that lets an allowlist regression read as a success. Five is the number of links
                // this probe's error actually has.
                loggedCauses.length === 5 &&
                loggedCauses.every(
                    (c) => c.code === null || /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(String(c.code)),
                ),
            `hostile code logged as ${JSON.stringify(causeAt("cause.cause.errors[1]")?.code)}; every logged code matches the bare-token pattern`,
        )
        checkInvertible(
            "MEASURED: the multi-line message's `at `-prefixed continuation line does NOT become a frame - the stack header is cut by the message's own extent, not by dropping line one",
            !causeLog.includes(CONTINUATION_MARKER) && payload?.messageHeaderCut === true,
            `continuation marker present=${causeLog.includes(CONTINUATION_MARKER)} headerCut=${String(payload?.messageHeaderCut)}`,
        )
        // ---- TASK: the redactor keeps the evidence and drops the authority -----
        checkInvertible(
            "MEASURED: an ESM `file://` frame keeps its PATH, LINE and COLUMN - the three things this log exists to carry, and the three the old blunt rule replaced with a single marker",
            framesText.includes("/C:/probe/app/src/lib/x.js:10:5"),
            framesText.slice(0, 150),
        )
        checkInvertible(
            "MEASURED: a bundler query string is dropped WITHOUT taking the line and column with it - the old rule ate to the next whitespace, so a cache-buster cost the position",
            framesText.includes("y.js<redacted-query>:20:7"),
            framesText.slice(0, 200),
        )
        checkInvertible(
            "MEASURED: a DSN in a frame loses its whole AUTHORITY - userinfo, host and port - while the path tail survives, which is the narrowing: credentials live in the authority, evidence lives in the path",
            framesText.includes("<redacted-authority>") &&
                framesText.includes("/appdb") &&
                !causeLog.includes("svcuser") &&
                !causeLog.includes("hunter2") &&
                !causeLog.includes("dbhost.internal") &&
                !causeLog.includes("5432") &&
                !causeLog.includes("sslmode"),
            `authority marker present=${framesText.includes("<redacted-authority>")}, path tail kept=${framesText.includes("/appdb")}`,
        )
        checkInvertible(
            "MEASURED: a plain filesystem frame with no URI in it is passed through untouched, so the redactor costs nothing on the frames that make up a real stack",
            framesText.includes("z.ts:33:11"),
            framesText.slice(-90),
        )
        checkInvertible(
            "MEASURED: no complete URI survives in the log even in redacted form - the authority marker replaces the `//` as well, so this log cannot carry a connection string of any shape",
            !/[a-z][a-z0-9+.-]*:\/\//i.test(causeLog) && !/(password|passwd|secret|token|apikey|api_key)\s*[:=]/i.test(causeLog),
            "no scheme:// and no credential-shaped assignment in the cause-probe log",
        )
        checkInvertible(
            "MEASURED: the cause-chain probe still answered a leak-free 503 to the client, so none of the above was bought at the boundary's expense",
            causeCaptured.status === 503 &&
                errCode(causeCaptured) === "DEPENDENCY_UNAVAILABLE" &&
                !causeCaptured.raw.includes(CAUSE_MESSAGE_MARKER) &&
                !causeCaptured.raw.includes("dbhost.internal"),
            `status=${causeCaptured.status} code=${errCode(causeCaptured)}`,
        )

        // ---- THE NO-WRITE CLAIM, PROVEN BY TWO INDEPENDENT MECHANISMS ----------
        //
        // THE COUNT VERSION OF THIS PROVED LESS THAN ITS NAME. Two defects, one fixed before and one
        // fixed here.
        //
        // The first was that the measurement happened inside a transaction that ended in
        // `throw new Rollback()`, so a write would have been erased before the comparison was taken.
        // That is why this block has its own COMMITTED fixture and its own explicit teardown, and why
        // it must never be moved back inside the rollback.
        //
        // The second is that comparing GLOBAL ROW COUNTS across a hand-written list of 18 tables cannot
        // see an UPDATE (the count does not move), an insert-then-delete (the count returns), a
        // sequence advance (no row is left), or a write to any of the other 97 base tables in this
        // schema. Its own comment admitted the first two and asserted the rest by reading the code.
        //
        // So the claim is now carried by two mechanisms with complementary blind spots, and the
        // assertions below say which one is speaking. See scripts/lib/write-detector.ts.
        //
        //   1. CALL INTERCEPTION observes every model action and raw call the client under test
        //      issues, at the moment it is issued. Table-agnostic, so a write to an unlisted table is
        //      caught like any other; indifferent to the write's later fate, so insert-then-delete and
        //      transaction-contained writes are caught; and blind to anything that does not go through
        //      this client.
        //   2. CONTENT FINGERPRINTS on a SEPARATE CONNECTION digest the rows themselves
        //      (`md5(string_agg((row)::text))`), plus `max(updatedAt)` and every sequence's
        //      `last_value`. Catches an UPDATE that leaves the count identical, and catches a write
        //      that bypassed the observed client entirely; blind to a write that is perfectly undone
        //      inside the window.
        //
        // CONCURRENCY. Two other stages are on this database now, so every asserted signal here is
        // scoped to something only THIS run can produce: the interceptor watches only our own client,
        // the fingerprints are scoped by this run's unique token, and the global question ("did a row
        // anywhere appear?") is asked as "does any row in any of the 115 tables mention THIS RUN's
        // token?" - which no concurrent harness can answer yes to. The one genuinely shared signal is
        // the sequence list; it is reported raw and asserted only where an advance is ATTRIBUTABLE to
        // this run. That reasoning is written out at the assertion.
        //
        // Set WRITE_DETECTOR_INJECT=<class> to inject one mutation class into the measured window and
        // observe the detector go red naming it. Recognised classes are listed in INJECTABLE below.
        //
        // "14 OF 14 CAUGHT" WAS EVIDENCE ABOUT THE POSITIVES AND NOTHING ELSE, which is the finding that
        // changed this block. Every one of the original fourteen was drawn from a shape the detector
        // already recognises, so a green sweep of all fourteen measured how well it does the thing it was
        // built to do and said nothing about WHERE IT STOPS. A detector's boundary is a property of the
        // detector, and an unmeasured boundary gets quoted as if it were zero.
        //
        // So two of the classes below are declared KNOWN GAPS: shapes this detector is expected to MISS,
        // asserted as misses. Each one is asserted twice over - that the mutation genuinely happened, and
        // that no mechanism reported it - so it cannot pass by failing to inject. And each is written to
        // FAIL THE DAY THE GAP CLOSES: if a future widening catches one, the assertion goes red and the
        // harness says the detector got better, instead of carrying a stale claim about its limits.
        const INJECT = process.env.WRITE_DETECTOR_INJECT ?? ""
        const INJECTABLE = Object.freeze([
            "create",
            "createMany",
            "createManyAndReturn",
            "update",
            "updateMany",
            "delete",
            "deleteMany",
            "upsert",
            "executeRaw",
            "executeRawUnsafe",
            "queryRawWrite",
            "txWrite",
            "insertThenDelete",
            "bypassUpdate",
            "sequenceAdvance",
            "gapBypassUnlistedTable",
            "gapBypassSessionState",
        ])
        /** The two classes above that are asserted as MISSES rather than as catches. */
        const KNOWN_GAP_CLASSES: readonly string[] = Object.freeze(["gapBypassUnlistedTable", "gapBypassSessionState"])
        /**
         * The unlisted table for the first known gap: absent from every fingerprint spec, and chosen by
         * measurement rather than by guess - `AdminSettings` is `id`/`key`/`value`, carries no foreign key
         * and no trigger of any kind, so a probe row goes in and comes out cleanly. Its id deliberately
         * does NOT contain the run token, because a row the token sweep could find would not be the shape
         * under test.
         */
        const GAP_TABLE = "AdminSettings"
        const GAP_ROW_ID = "wd-gap-probe-unlisted-row"
        /** Two-int advisory lock key for the second known gap, so `pg_locks` can be queried unambiguously. */
        const GAP_LOCK_CLASS = 4820
        const GAP_LOCK_OBJECT = 26831
        if (INJECT !== "" && !INJECTABLE.includes(INJECT)) {
            throw new Error(`WRITE_DETECTOR_INJECT=${INJECT} is not a recognised class: ${INJECTABLE.join(", ")}`)
        }

        // ---- the classifier, asserted directly ---------------------------------
        //
        // The injections below prove the detector end to end, but they are driven by an environment
        // variable, so on a normal run nothing would exercise the classification table at all. These
        // assertions run every time and are the reason a normal green run is evidence that the
        // detector can still tell a write from a read.
        for (const verb of [
            "create",
            "createMany",
            "createManyAndReturn",
            "update",
            "updateMany",
            "updateManyAndReturn",
            "delete",
            "deleteMany",
            "upsert",
        ] as const) {
            checkInvertible(
                `MEASURED: the write detector classifies the model action "${verb}" as a write`,
                classifyModelCall(verb) === verb,
                `${verb} -> ${String(classifyModelCall(verb))}`,
            )
        }
        // THE TWO `AndReturn` VERBS WERE IN THE CLASSIFICATION TABLE AND IN NOTHING ELSE, and that is the
        // gap this probe closes. `MODEL_WRITE_OPERATIONS` has held both since it was written, but neither
        // appeared in INJECTABLE, so "14 of 14 injection classes caught" said nothing about them: two
        // recognised write classes had never been driven through the interceptor at all.
        //
        // Only ONE of them can be. `createManyAndReturn` exists on this client and now has a real
        // injection. `updateManyAndReturn` arrived in Prisma 6.2 and this project is on 5.22, so no call
        // through the client can produce that operation name and an injection for it would be a TypeError
        // rather than evidence. That is a measured fact rather than an assumption, so it is measured here
        // - and phrased so it goes RED on the Prisma upgrade that makes the injection possible, which is
        // the moment someone needs to be told to add it.
        const userDelegate = prisma.user as unknown as Record<string, unknown>
        const hasCreateManyAndReturn = typeof userDelegate.createManyAndReturn === "function"
        const hasUpdateManyAndReturn = typeof userDelegate.updateManyAndReturn === "function"
        checkInvertible(
            "MEASURED: this client exposes createManyAndReturn - so that class is injected for real below - and exposes NO updateManyAndReturn, which is the only reason that class is proven by classification alone. FAILS on the Prisma upgrade that adds it, and the injection must be written then",
            hasCreateManyAndReturn && !hasUpdateManyAndReturn,
            `createManyAndReturn on the client=${hasCreateManyAndReturn}, updateManyAndReturn on the client=${hasUpdateManyAndReturn} (@prisma/client 5.x; updateManyAndReturn is 6.2+)`,
        )
        for (const verb of ["findMany", "findUnique", "findFirst", "count", "aggregate", "groupBy"] as const) {
            checkInvertible(
                `MEASURED: the write detector classifies the read action "${verb}" as a read, so it is not simply calling everything a write`,
                classifyModelCall(verb) === null,
                `${verb} -> ${String(classifyModelCall(verb))}`,
            )
        }
        // A verb-anchored regex would miss a CTE-led write, and this repository writes CTEs.
        checkInvertible(
            "MEASURED: raw write detection sees through a leading CTE and a leading comment, and still calls a bare select a read",
            isWriteSql(`with recent as (select 1) insert into "User" ("id") values ('x')`) &&
                isWriteSql(`-- harmless looking\n update "FieldJob" set "title" = 'x'`) &&
                isWriteSql(`/* block */ delete from "User" where "id" = 'x'`) &&
                !isWriteSql(`select "id" from "FieldJob" where "status" = 'SCHEDULED'`) &&
                !isWriteSql(`  select count(*) from "User"`),
            "CTE, line comment and block comment all classified as writes; selects as reads",
        )
        // A sequence advance writes no row, which is exactly why the count version could not see it.
        checkInvertible(
            "MEASURED: raw write detection treats a sequence advance and a row lock as writes, though neither changes a row's content",
            isWriteSql(`select nextval('"FieldJobEvent_seq_seq"')`) &&
                isWriteSql(`select setval('s', 1)`) &&
                isWriteSql(`select "id" from "FieldJob" for update`),
            "nextval, setval and FOR UPDATE all classified as writes",
        )
        // The args shapes are Prisma's, not ours, so they are asserted against the real ones.
        checkInvertible(
            "MEASURED: the raw classifier reads BOTH args shapes Prisma uses - the array form of the Unsafe calls and the Sql object form of the tagged calls",
            classifyRawCall("$queryRawUnsafe", [`insert into "User" ("id") values ('x')`]) === "raw-write" &&
                classifyRawCall("$queryRaw", { strings: [`update "User" set "name" = `, ``], values: ["x"] }) ===
                    "raw-write" &&
                classifyRawCall("$queryRawUnsafe", [`select 1`]) === null,
            "array form and Sql form both classified; a raw select stays a read",
        )
        // FAIL-SAFE DIRECTION. If a future Prisma changes the args shape, the detector must go loud
        // rather than quietly stop seeing raw writes - a silent blind spot is the defect being fixed.
        checkInvertible(
            "MEASURED: an args shape the classifier cannot read is treated as a WRITE, so a future Prisma change fails loud instead of going blind",
            classifyRawCall("$queryRaw", { somethingNew: true }) === "raw-write" &&
                classifyRawCall("$queryRaw", null) === "raw-write",
            "unreadable args -> raw-write",
        )

        const committed = await seedCommitted(prisma)
        const detector = await createWriteDetector({ client: prisma, runToken: RUN })
        // A THIRD connection, used only by the bypassUpdate and sequenceAdvance injections. It exists
        // to write BEHIND the instrumented client's back, which is how the fingerprint mechanism is
        // shown to catch something call interception structurally cannot.
        const bypass = new PrismaClient()
        const injectedSequence = INJECT === "sequenceAdvance" ? `wd_${RUN}_seq` : null
        // Created BEFORE the window opens, so what the window observes is a pure ADVANCE of an
        // existing sequence rather than the appearance of a new one.
        if (injectedSequence !== null) {
            await prisma.$executeRawUnsafe(`create sequence "${injectedSequence}" start 1`)
        }

        let verdict: WriteDetectorVerdict | null = null
        let residueHits: readonly { table: string; rows: number }[] = []
        let sweptTableCount = 0
        try {
            // SCOPE. Every spec is scoped to this run, so a concurrent harness's rows are not in any
            // digest. The 18 domain tables are scoped by whole-row text match on the run token, which
            // needs no per-table column knowledge and covers append-only logs the same way as any
            // other table. The five tenancy tables get a second, id-anchored digest as well, so an
            // UPDATE that removed the token would show up as a content change rather than as a row
            // leaving the scope.
            const specs: TableFingerprintSpec[] = [
                ...DOMAIN_TABLES.map((table) => ({ table, where: `(q.*)::text like '%${RUN}%'` })),
                ...["User", "Profile", "Workspace", "Membership", "FieldJob"].map((table) => ({
                    table,
                    where: `"id" like '${RUN}%'`,
                })),
            ]

            const countsBefore = await globalCounts()
            await detector.begin(specs)

            const identity = new ControlledIdentity()
            identity.current = committed.user
            // The service is given the INSTRUMENTED client, so every call it makes is observed.
            const detectedApi = new DueWorkApiService(
                new OperationsService(
                    new OperationsContext(detector.client, new PersistedTenancy(detector.client, identity)),
                ),
            )
            const persisted = await call(detectedApi.preview(get(`${BASE}?workspaceId=${committed.workspace}`)))
            checkInvertible(
                "the committed-fixture request really succeeded, so the no-write claim is measured on a 200",
                persisted.status === 200,
                `status=${persisted.status} ${String((persisted.body.error as { message?: string } | undefined)?.message ?? "")}`,
            )

            // ---- the injection, inside the measured window ---------------------
            const w = detector.client
            const injUser = `${RUN}_inj`
            const injUser2 = `${RUN}_inj2`
            const newUser = (id: string) => ({
                id,
                clerkId: `clerk_${id}`,
                email: `${id}@example.test`,
            })
            const insertUserSql = (id: string) =>
                `insert into "User" ("id","clerkId","email","updatedAt") values ('${id}','clerk_${id}','${id}@example.test',CURRENT_TIMESTAMP)`
            switch (INJECT) {
                case "create":
                    await w.user.create({ data: newUser(injUser) })
                    break
                case "createMany":
                    await w.user.createMany({ data: [newUser(injUser), newUser(injUser2)] })
                    break
                case "createManyAndReturn":
                    // In MODEL_WRITE_OPERATIONS since that map was written and never once driven through
                    // the interceptor until now. Same table and same rows as `createMany`; the only thing
                    // under test is whether the operation NAME is classified.
                    await w.user.createManyAndReturn({ data: [newUser(injUser), newUser(injUser2)] })
                    break
                case "update":
                    await w.fieldJob.update({ where: { id: COMMITTED.job }, data: { title: "INJECTED UPDATE" } })
                    break
                case "updateMany":
                    await w.fieldJob.updateMany({ where: { id: COMMITTED.job }, data: { title: "INJECTED UPDATEMANY" } })
                    break
                case "delete":
                    await w.fieldJob.delete({ where: { id: COMMITTED.job } })
                    break
                case "deleteMany":
                    await w.fieldJob.deleteMany({ where: { id: COMMITTED.job } })
                    break
                case "upsert":
                    await w.user.upsert({
                        where: { id: injUser },
                        create: newUser(injUser),
                        update: { name: "INJECTED UPSERT" },
                    })
                    break
                case "executeRawUnsafe":
                    await w.$executeRawUnsafe(insertUserSql(injUser))
                    break
                case "executeRaw":
                    // Tagged-template form, so the Sql-object args shape is exercised too.
                    await w.$executeRaw`update "FieldJob" set "title" = ${"INJECTED EXECUTERAW"} where "id" = ${COMMITTED.job}`
                    break
                case "queryRawWrite":
                    // $queryRaw is a READ entry point carrying a WRITE. Nothing about the method name
                    // says "write", which is why classification is done on the statement.
                    await w.$queryRaw`insert into "User" ("id","clerkId","email","updatedAt") values (${injUser}, ${`clerk_${injUser}`}, ${`${injUser}@example.test`}, CURRENT_TIMESTAMP) returning "id"`
                    break
                case "txWrite":
                    // Contained in an interactive transaction that COMMITS. The interceptor records it
                    // as it is issued, so the containment buys nothing.
                    await w.$transaction(async (tx) => {
                        await tx.user.create({ data: newUser(injUser) })
                    })
                    break
                case "insertThenDelete":
                    // Net zero by the time the window closes: the fingerprint is identical afterwards,
                    // and ONLY call interception can see this.
                    await w.$executeRawUnsafe(insertUserSql(injUser))
                    await w.$executeRawUnsafe(`delete from "User" where "id" = '${injUser}'`)
                    break
                case "bypassUpdate":
                    // Behind the instrumented client's back, and row-count-neutral: ONLY the
                    // fingerprint can see this.
                    await bypass.$executeRawUnsafe(
                        `update "FieldJob" set "title" = 'INJECTED BYPASS' where "id" = '${COMMITTED.job}'`,
                    )
                    break
                case "sequenceAdvance":
                    // No row anywhere changes. A row count cannot see this by construction.
                    await bypass.$queryRawUnsafe(`select nextval('"${injectedSequence ?? ""}"') as v`)
                    break
                // ---- the two KNOWN GAPS, injected so the boundary is measured -----
                case "gapBypassUnlistedTable":
                    // EXPECTED TO BE MISSED, and the three reasons are independent. It is issued on a
                    // third connection, so call interception cannot see it. Its table is in none of the
                    // fingerprint specs, so no digest covers it. And its row contains no run token, so the
                    // sweep that asks the global question cannot match it. `bypassUpdate` above is caught
                    // because it lands in a FINGERPRINTED table; the only thing changed here is the table,
                    // which is precisely the axis nobody had measured.
                    await bypass.$executeRawUnsafe(
                        `insert into "${GAP_TABLE}" ("id","key","value") values ('${GAP_ROW_ID}','${GAP_ROW_ID}','{}')`,
                    )
                    break
                case "gapBypassSessionState":
                    // ALSO EXPECTED TO BE MISSED, and deliberately NOT the shape that HEAD's widening of
                    // RAW_WRITE_PATTERN now catches. That widening made `set role`, `set session`,
                    // `pg_advisory_lock` and `lock table` classify as writes - but classification only runs
                    // on statements issued THROUGH the instrumented client. Issued on a third connection
                    // the same statements are seen by nothing, and neither a content digest nor a sequence
                    // read can see a lock or a session GUC, because neither is row state. So the widening
                    // closed the classification half and left this half open, and this is the half.
                    // `pg_try_advisory_lock` rather than `pg_advisory_lock`, and the reason is mechanical:
                    // the blocking form returns `void`, which this Prisma refuses to deserialize (P2010),
                    // so the probe died before it proved anything. The try form returns a boolean, which
                    // makes the acquisition itself observable - and it is matched by the same
                    // RAW_WRITE_PATTERN alternative, so nothing about the classification claim changes.
                    await bypass.$queryRawUnsafe(
                        `select pg_try_advisory_lock(${GAP_LOCK_CLASS}, ${GAP_LOCK_OBJECT}) as locked`,
                    )
                    await bypass.$executeRawUnsafe(`set statement_timeout = '9s'`)
                    break
                default:
                    break
            }

            verdict = await detector.end()
            const countsAfter = await globalCounts()

            // ---- ANTI-VACUITY: the detector must have been in the path ---------
            //
            // Every assertion below is of the form "nothing was seen". All of them pass perfectly if
            // the instrumented client was never actually used - a refactor that handed the service the
            // raw client would do it silently. So the FIRST thing asserted is that the interceptor
            // observed the request's own reads.
            const reads = verdict.observedCalls.filter((c) => c.mutationClass === null)
            const readModels = [...new Set(reads.map((c) => c.model ?? "<raw>"))].sort()
            checkInvertible(
                "MEASURED: the interceptor was genuinely in the request's path - it observed the preview's own reads, so the no-write assertions below cannot pass by observing nothing",
                verdict.observedCalls.length > 0 && reads.length > 0,
                `${verdict.observedCalls.length} calls observed, ${reads.length} reads, models=[${readModels.join(",")}]`,
            )

            // ---- MECHANISM 1: call interception -------------------------------
            checkInvertible(
                "MEASURED: mechanism 1 (call interception) saw the request issue NO create, createMany, update, updateMany, delete, deleteMany, upsert or raw write - on ANY table, listed or not",
                verdict.writes.length === 0,
                verdict.writes.length === 0
                    ? `${verdict.observedCalls.length} calls, all reads`
                    : `classes=[${verdict.classes.join(",")}] :: ${verdict.summary}`,
            )
            checkInvertible(
                "MEASURED: no write was hidden inside an interactive $transaction either - the interceptor records a call when it is issued, so containment and rollback do not conceal it",
                verdict.writes.filter((c) => c.insideTransaction).length === 0,
                `${verdict.observedCalls.filter((c) => c.insideTransaction).length} in-transaction calls observed, ${verdict.writes.filter((c) => c.insideTransaction).length} of them writes`,
            )

            // ---- MECHANISM 2: independent content fingerprints ----------------
            const tableDiffs = verdict.fingerprintDiffs.filter((d) => d.kind === "table")
            checkInvertible(
                "MEASURED: mechanism 2 (content digest on a separate connection) saw no row's CONTENT change - this is what a row count cannot see, and it is scoped to this run so a concurrent harness cannot move it",
                tableDiffs.length === 0,
                tableDiffs.length === 0
                    ? `${specs.length} scoped digests identical (md5 over whole-row text, plus max(updatedAt))`
                    : tableDiffs.map((d) => `${d.name}.${d.component} ${d.before}->${d.after}`).join(" ; "),
            )

            // ---- the global question, asked where it is actually true ---------
            //
            // THIS ASSERTION USED TO REQUIRE ZERO HITS HERE AND THAT WAS WRONG, not subtly: the
            // committed fixture is DELIBERATELY still alive at this point - there is no rollback to
            // lean on, which is the whole design - so this run's own seeded rows legitimately carry
            // this run's token. Requiring zero made the harness red against its own fixture, and the
            // gate driver caught it on its first sweep.
            //
            // The zero-residue claim is real and is asserted AFTER teardown, on `residueHits` below.
            // What is worth asserting HERE is different and was not being asserted at all: that the
            // preview did not spread the token ANYWHERE NEW. The fixture seeded five tables; if the
            // token turns up in a sixth, something wrote on a read path.
            const fixtureTables = new Set(["FieldJob", "Membership", "Workspace", "Profile", "User"])
            const unexpectedTokenTables = verdict.runTokenHits.filter((h) => !fixtureTables.has(h.table))
            checkInvertible(
                "MEASURED: during the window this run's token appears ONLY in the five tables its own fixture seeded - the preview spread it to no other table",
                unexpectedTokenTables.length === 0,
                unexpectedTokenTables.length === 0
                    ? `${detector.sweptTables.length} tables swept; hits confined to the fixture's own ${verdict.runTokenHits.length} table(s)`
                    : unexpectedTokenTables.map((h) => `${h.table}=${h.rows}`).join(","),
            )
            // Not passing by finding nothing: the fixture must actually be present and carrying the
            // token, or the assertion above would be satisfied by an empty database.
            checkInvertible(
                "the in-window sweep really did find this run's fixture, so the confinement check is not passing over an empty result",
                verdict.runTokenHits.length > 0,
                `${verdict.runTokenHits.length} fixture table(s) carried the token in-window`,
            )

            // ---- sequences: shared state, so attribution is explicit ----------
            //
            // `pg_sequences.last_value` is the one signal here that is genuinely global and cannot be
            // scoped to this run: a concurrent harness inserting an event row advances the same
            // counter. Asserting raw equality would therefore be asserting that no other stage is
            // working, which is not a property of the code under test. So the raw movement is REPORTED
            // and the assertion is on the movement ATTRIBUTABLE to this run: a sequence this run
            // created, or one belonging to a table where this run's token or a write of ours appeared.
            const sequenceDiffs = verdict.fingerprintDiffs.filter((d) => d.kind === "sequence")
            const tokenTables = new Set(verdict.runTokenHits.map((h) => h.table))
            const writtenModels = new Set(verdict.writes.map((c) => (c.model ?? "").toLowerCase()))
            const attributable = sequenceDiffs.filter((d) => {
                if (d.name.includes(RUN)) return true
                const table = d.name.replace(/_seq_seq$/, "")
                return tokenTables.has(table) || writtenModels.has(table.toLowerCase())
            })
            checkInvertible(
                "MEASURED: no sequence or identity advance is attributable to this run - a write that leaves no row behind, which a row count cannot see at all",
                attributable.length === 0,
                attributable.length === 0
                    ? `${Object.keys(verdict.before?.sequences ?? {}).length} sequences read; ${sequenceDiffs.length} moved, none attributable to this run`
                    : attributable.map((d) => `${d.name} ${d.before}->${d.after}`).join(" ; "),
            )

            // ---- WHERE THE DETECTOR STOPS, asserted as gaps -------------------
            //
            // Everything above says what the detector CAUGHT. These say what it does not, and they are
            // written as assertions rather than as prose for one reason: prose about a limitation rots
            // silently, and an assertion about a limitation goes RED when the limitation is fixed.
            //
            // `caughtSignals` is the union of every signal this harness actually asserts on, so a gap
            // claim is made against the whole detector rather than against one mechanism. A gap assertion
            // needs BOTH halves to be true: nothing was caught, AND the mutation demonstrably happened. The
            // second half is not a formality - without it, an injection that silently failed to run would
            // satisfy "nothing was caught" perfectly, which is the same vacuity this repository audits for
            // wearing the opposite sign.
            const caughtSignals: string[] = []
            if (verdict.writes.length > 0) caughtSignals.push(`interception[${verdict.classes.join(",")}]`)
            if (tableDiffs.length > 0) caughtSignals.push(`fingerprint[${tableDiffs.map((d) => `${d.name}.${d.component}`).join(",")}]`)
            if (unexpectedTokenTables.length > 0) caughtSignals.push(`token[${unexpectedTokenTables.map((h) => h.table).join(",")}]`)
            if (attributable.length > 0) caughtSignals.push(`sequence[${attributable.map((d) => d.name).join(",")}]`)

            if (INJECT === "gapBypassUnlistedTable") {
                const landed = (await bypass.$queryRawUnsafe(
                    `select count(*)::text as n from "${GAP_TABLE}" where "id" = '${GAP_ROW_ID}'`,
                )) as Array<{ n: string }>
                const rowsWritten = Number(landed[0].n)
                checkInvertible(
                    "KNOWN GAP, ASSERTED AS A GAP: a row inserted on a THIRD connection into a table absent from the fingerprint spec, carrying no run token, is caught by NEITHER mechanism - interception sees only our client, no digest covers that table, and the token sweep has nothing to match. This assertion FAILS the day the detector catches it, which is the only way this harness can tell anyone the boundary moved",
                    rowsWritten === 1 && caughtSignals.length === 0,
                    `probe rows written to ${GAP_TABLE} outside the spec=${rowsWritten} (1 expected, and the write must be real or "not caught" would be vacuous); detector signals raised=[${caughtSignals.join(" ; ") || "none"}]`,
                )
            }
            if (INJECT === "gapBypassSessionState") {
                // Read from `prisma`, a DIFFERENT session, because a session can always see its own lock;
                // observing it from elsewhere is what proves the lock is really held on the cluster.
                const held = (await prisma.$queryRawUnsafe(
                    `select count(*)::text as n from pg_locks
                     where locktype = 'advisory' and classid = ${GAP_LOCK_CLASS} and objid = ${GAP_LOCK_OBJECT} and granted`,
                )) as Array<{ n: string }>
                const locksHeld = Number(held[0].n)
                checkInvertible(
                    "KNOWN GAP, ASSERTED AS A GAP: an advisory lock and a session GUC issued on a THIRD connection are caught by NEITHER mechanism. HEAD's widening of RAW_WRITE_PATTERN classifies both as writes, but classification only ever runs on statements issued through the INSTRUMENTED client; a lock and a session setting are not row state, so no digest and no sequence read can see them either. This assertion FAILS the day that changes",
                    locksHeld === 1 && caughtSignals.length === 0,
                    `advisory locks held on (${GAP_LOCK_CLASS},${GAP_LOCK_OBJECT}), observed from a different session=${locksHeld} (1 expected, or the "not caught" claim would be vacuous); detector signals raised=[${caughtSignals.join(" ; ") || "none"}]`,
                )
            }
            // The gap classes are not exercised on a normal run, so the fact that they EXIST and are
            // reachable is asserted every run - a boundary measurement that can be deleted by accident is
            // not a boundary measurement.
            checkInvertible(
                "MEASURED: the injection table still declares both KNOWN-GAP classes, so the detector's boundary remains measurable rather than becoming a claim in a comment",
                KNOWN_GAP_CLASSES.every((gap) => INJECTABLE.includes(gap)) && KNOWN_GAP_CLASSES.length === 2,
                `known-gap classes declared=[${KNOWN_GAP_CLASSES.join(",")}] of ${INJECTABLE.length} injectable`,
            )

            // ---- REPORTS: the concurrent traffic, made visible ---------------
            //
            // Printed rather than asserted, on purpose. This is the old mechanism's signal, and the
            // point of showing it is that it moves for reasons that have nothing to do with this
            // surface - which is precisely why the assertions above are not built on it.
            const movedCounts = DOMAIN_TABLES.filter((t) => countsBefore[t] !== countsAfter[t]).map(
                (t) => `${t} ${countsBefore[t]}->${countsAfter[t]}`,
            )
            console.log(
                `REPORT  GLOBAL row counts across the 18 domain tables, the old mechanism's signal, NOT asserted on: ${
                    movedCounts.length === 0 ? "unchanged during this window" : `MOVED (concurrent traffic): ${movedCounts.join(", ")}`
                }`,
            )
            console.log(
                `REPORT  GLOBAL sequence movement during the window, shared with every other harness, asserted only where attributable: ${
                    sequenceDiffs.length === 0
                        ? "none"
                        : sequenceDiffs.map((d) => `${d.name} ${d.before}->${d.after}`).join(", ")
                }`,
            )
            console.log(
                `REPORT  detector coverage: ${verdict.observedCalls.length} intercepted calls, ${specs.length} run-scoped content digests, ${detector.sweptTables.length} tables token-swept, ${Object.keys(verdict.before?.sequences ?? {}).length} sequences read on a separate connection`,
            )
            if (INJECT !== "") {
                console.log(`REPORT  WRITE_DETECTOR_INJECT=${INJECT} was active. Detector verdict: ${verdict.summary}`)
            }
        } finally {
            // TEARDOWN, then the residue proof. Explicit and ordered by foreign key, because the
            // fixture is COMMITTED - there is no rollback to lean on, which is the whole point.
            await cleanupCommitted(prisma)
            for (const table of ["FieldJob", "Membership", "Workspace", "Profile", "User"]) {
                await prisma.$executeRawUnsafe(`delete from "${table}" where "id" like '${RUN}%'`)
            }
            if (injectedSequence !== null) {
                await prisma.$executeRawUnsafe(`drop sequence if exists "${injectedSequence}"`)
            }
            // THE KNOWN-GAP PROBES ARE THE ONE THING THE TOKEN SWEEP CANNOT CLEAN UP AFTER, because the
            // whole point of them is that they carry no run token. So they are removed by exact id and by
            // exact lock key - unconditionally, so a crashed earlier run's probe is cleared too - and both
            // are then proven gone by query below rather than assumed gone here.
            //
            // `=` and not `like`: a LIKE pattern would need `_` escaped, and the residue proof this
            // repository already got wrong once was exactly that. An equality test cannot have the bug.
            await prisma.$executeRawUnsafe(`delete from "${GAP_TABLE}" where "id" = '${GAP_ROW_ID}'`)
            if (INJECT === "gapBypassSessionState") {
                await bypass.$queryRawUnsafe(`select pg_advisory_unlock(${GAP_LOCK_CLASS}, ${GAP_LOCK_OBJECT}) as released`)
            }
            residueHits = await detector.sweep()
            sweptTableCount = detector.sweptTables.length
            await detector.close()
            await bypass.$disconnect()
        }

        // ---- ZERO RESIDUE, proven by query rather than by assuming a cascade ----
        //
        // Thirteen of this schema's tables carry an `<Table>_append_only` trigger that REFUSES delete,
        // so if a fixture - or an injected proof - ever put a row in one, no teardown could remove it.
        // The only honest way to claim none is there is to ask, which is what this does, across every
        // base table in the schema rather than a list of the ones that seemed likely.
        checkInvertible(
            "MEASURED: this run left ZERO residue - no row in any base table in the schema mentions its token, including the 13 append-only tables whose rows no teardown could have removed",
            residueHits.length === 0,
            residueHits.length === 0
                ? `${sweptTableCount} tables swept after teardown, 0 rows mention this run`
                : residueHits.map((h) => `${h.table}=${h.rows}`).join(","),
        )
        if (injectedSequence !== null) {
            const left = (await prisma.$queryRawUnsafe(
                `select count(*)::text as n from pg_sequences where schemaname = 'public' and sequencename = '${injectedSequence}'`,
            )) as Array<{ n: string }>
            checkInvertible(
                "MEASURED: the sequence created for the sequence-advance injection was dropped, so that proof left no schema residue either",
                Number(left[0].n) === 0,
                `pg_sequences rows for the injected sequence: ${left[0].n}`,
            )
        }
        // THE KNOWN-GAP PROBES, PROVEN GONE BY QUERY. These two are the only fixtures in this harness the
        // run-token sweep is structurally unable to see - carrying no token is what makes them the shape
        // under test - so "the sweep found nothing" is not evidence about either of them and they are asked
        // about directly. Asked on EVERY run, not only the injecting one: an orphan left by a crashed run
        // would otherwise sit in this database indefinitely with nothing looking for it.
        const gapRowLeft = (await prisma.$queryRawUnsafe(
            `select count(*)::text as n from "${GAP_TABLE}" where "id" = '${GAP_ROW_ID}'`,
        )) as Array<{ n: string }>
        checkInvertible(
            `MEASURED: the known-gap probe row is gone from ${GAP_TABLE} - the one fixture whose absence the token sweep CANNOT prove, since carrying no token is exactly what made it the shape under test`,
            Number(gapRowLeft[0].n) === 0,
            `rows in ${GAP_TABLE} with the probe id, asked by equality rather than by a LIKE pattern needing an escaped underscore: ${gapRowLeft[0].n}`,
        )
        const gapLockLeft = (await prisma.$queryRawUnsafe(
            `select count(*)::text as n from pg_locks
             where locktype = 'advisory' and classid = ${GAP_LOCK_CLASS} and objid = ${GAP_LOCK_OBJECT}`,
        )) as Array<{ n: string }>
        checkInvertible(
            "MEASURED: the known-gap advisory lock is released, so that probe left no lock on the cluster - a residue no table sweep would ever have found",
            Number(gapLockLeft[0].n) === 0,
            `pg_locks rows on (${GAP_LOCK_CLASS},${GAP_LOCK_OBJECT}): ${gapLockLeft[0].n}`,
        )
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} due-work preview assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} due-work preview assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("The due-work preview boundary holds: a plan, and nothing else.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
