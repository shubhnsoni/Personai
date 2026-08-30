/**
 * The explicitly invoked DUE-WORK PREVIEW boundary.
 *
 * `planDueWork` was pure, proven and invoked by nobody. This harness covers the surface that now
 * invokes it, and the promises that surface makes are unusually strong, so most of the assertions here
 * are about what must NOT happen:
 *
 *   nothing is written - not a row, not a status, and not a record that a preview was requested, which
 *   is asserted by counting every table this domain can reach before and after a real request;
 *   nothing runs on its own - no timer, interval, cron, queue or background execution exists in the
 *   three source files, asserted over EXECUTABLE LINES ONLY;
 *   nothing is handed to a provider - no mailer, payment client, carrier or transport, and the
 *   composition root injects no adapter of any kind;
 *   the wording is honest - the SERIALISED BODY may not contain "scheduled", "sent", "executed" and the
 *   rest of FORBIDDEN_PREVIEW_WORDS, and must contain the required ones;
 *   `executed` is the literal false and `sideEffects` is empty in the emitted JSON, not merely in the type;
 *   401 / 400 / 403 / 503 all use the shared envelope, a foreign workspace and a nonexistent one refuse
 *   BYTE-IDENTICALLY, and the 503 leaks no DSN and names THIS surface rather than the one whose envelope
 *   helper it reuses.
 *
 * THE COMMENT-SCANNING TRAP, which this repository has now walked into five times: the contract file and
 * both source files NAME every forbidden word and every forbidden dependency, in prose, precisely in
 * order to forbid them. A whole-file regex would therefore flag the prohibition as the violation. So the
 * source scans below run over `executableLines()`, which strips block and line comments first, and the
 * wording scan runs over the RESPONSE BODY rather than over any source file at all.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-due-work-preview-api.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { DueWorkApiService } from "../../src/lib/operations/due-work-http"
import { planDueWork } from "../../src/lib/operations/due-work-plan"
import {
    DUE_WORK_PREVIEW_LIMITATIONS,
    FORBIDDEN_PREVIEW_WORDS,
    REQUIRED_PREVIEW_WORDS,
    toDueWorkPreview,
} from "../../src/lib/operations/due-work-preview-types"
import { OPERATIONS_DOMAIN_SCOPE, OperationsService } from "../../src/lib/operations/engine"
import { OperationsContext } from "../../src/lib/operations/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `dwp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "../..")
const BASE = "http://duework.test/api/platform/operations/due-work"

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
function refusal(called: Called): string {
    return JSON.stringify(called.body)
}

/**
 * THE GET-ONLY GATE, widened after audit.
 *
 * The first version of this gate asserted `!/export async function (POST|PATCH|PUT|DELETE)\(/`, which is
 * evadable without any cleverness at all: this repository's own src/app/api already declares handler
 * exports three different ways. Measured over its 156 route.ts files: `export async function VERB` 95
 * times, `export function VERB` 17 times and `export const VERB` 4 times, for POST/PUT/PATCH/DELETE. A
 * write verb added to the due-work route in either of the two latter styles - both of them already house
 * style here - would have passed the old gate untouched. HEAD and OPTIONS were not covered at all.
 *
 * So the ban matches all three declaration styles across six verbs. The GET side accepts the non-async
 * form too, and that is not hypothetical either: 26 route files in this repo write `export function GET`,
 * so the old `export async function GET\(` pattern would have gone red on a legal refactor of this one -
 * and a gate that fails spuriously gets deleted by the next person rather than fixed.
 *
 * Neither pattern carries the `g` flag - a shared /g/ regex keeps `lastIndex` between `.test` calls and
 * would start answering false on alternate uses.
 */
const WRITE_VERB_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/
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
        "the due-work route exports GET and no POST, PUT, PATCH, DELETE, HEAD or OPTIONS - in ANY of the three export styles this repo uses",
        GET_EXPORT.test(routeExec) && !WRITE_VERB_EXPORT.test(routeExec),
        "GET only, checked against `export [async] function|const VERB`",
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

    const prisma = new PrismaClient()
    try {
        const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
        if (live[0].db !== AUTHORIZED_TARGET) {
            console.error(`ABORT: connected to ${live[0].db}`)
            process.exit(1)
        }

        /**
         * Counts for the no-write proof.
         *
         * Widened twice. The first version counted five tables, four of which were TENANCY tables and
         * none an append-only log - so the write the contract most specifically forbids, a surface
         * logging its own invocation, would have been invisible. The second version added eight event
         * logs and the commit claimed that was "every append-only log this schema has". A review counted
         * the repository's own `<Table>_append_only` triggers and found THIRTEEN. The five that were
         * missing are added here: BlueprintInstallationEvent, CaseRetainerDraw, CaseRetainerEvent,
         * CommerceEvent, CourseAccessEvent.
         *
         * KNOWN LIMIT, stated because the assertion name should not be read as more than it is: this
         * compares row COUNTS. An UPDATE to an existing counted row, or an insert-then-delete inside the
         * window, would not change a count and would pass. Nothing on this read path performs either -
         * every database call in it is a findMany or findUnique - but that is established by reading the
         * code, not by this assertion.
         */
        const countAll = async () => ({
            fieldJob: await prisma.fieldJob.count(),
            workspace: await prisma.workspace.count(),
            profile: await prisma.profile.count(),
            membership: await prisma.membership.count(),
            user: await prisma.user.count(),
            activityEvent: await prisma.activityEvent.count(),
            copilotAuditEvent: await prisma.copilotAuditEvent.count(),
            fieldJobEvent: await prisma.fieldJobEvent.count(),
            reservationEvent: await prisma.reservationEvent.count(),
            appointmentEvent: await prisma.appointmentEvent.count(),
            caseEvent: await prisma.caseEvent.count(),
            cohortEvent: await prisma.cohortEvent.count(),
            inventoryMovement: await prisma.inventoryMovement.count(),
            blueprintInstallationEvent: await prisma.blueprintInstallationEvent.count(),
            caseRetainerDraw: await prisma.caseRetainerDraw.count(),
            caseRetainerEvent: await prisma.caseRetainerEvent.count(),
            commerceEvent: await prisma.commerceEvent.count(),
            courseAccessEvent: await prisma.courseAccessEvent.count(),
        })

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
                    "MEASURED: the SERVICE itself refuses a POST Request, so the GET guarantee does not depend on the route module's exports",
                    posted.status !== 200 && posted.status === 400 && errCode(posted) === "BAD_REQUEST",
                    `GET on this URL=${ok.status}, POST=${posted.status} code=${errCode(posted)}`,
                )
                checkInvertible(
                    "the method refusal uses the shared envelope rather than a bespoke Response",
                    Object.keys(posted.body).sort().join(",") === "error,ok" &&
                        /GET/.test(String((posted.body.error as { message?: string } | undefined)?.message ?? "")),
                    `keys=${Object.keys(posted.body).sort().join(",")} message=${String((posted.body.error as { message?: string } | undefined)?.message ?? "").slice(0, 70)}`,
                )
                // A write verb must be refused before any parameter is read, or a POST with no
                // workspaceId is reported as a missing parameter and the method problem is never named.
                const postedBare = await call(api.preview(new Request(BASE, { method: "POST" })))
                checkInvertible(
                    "the method is checked BEFORE the parameters, so a POST is refused as a method and not reported as a missing workspaceId",
                    postedBare.status === 400 &&
                        !/workspaceId/.test(String((postedBare.body.error as { message?: string } | undefined)?.message ?? "")),
                    String((postedBare.body.error as { message?: string } | undefined)?.message ?? "").slice(0, 70),
                )
                for (const verb of ["PUT", "PATCH", "DELETE"] as const) {
                    const other = await call(api.preview(new Request(`${BASE}?workspaceId=${ids.wsA}`, { method: verb })))
                    checkInvertible(
                        `MEASURED: the service refuses ${verb} too, so the guarantee is about "not GET" rather than about POST alone`,
                        other.status === 400 && errCode(other) === "BAD_REQUEST",
                        `status=${other.status} code=${errCode(other)}`,
                    )
                }
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
                // mixedScope is CONSTANT-TRUE, and this assertion says only that, on purpose.
                //
                // engine.ts computes it over the frozen OPERATIONS_DOMAIN_SCOPE map, which always holds both
                // "profile" and "workspace", so `scopes.size > 1` is true for every workspace and every
                // dataset - including one with no rows in it. It is therefore a property of the declared
                // coverage list, not a measurement of this fixture's data, and the name below says so. An
                // assertion phrased as "the response reports that its total spans more than one tenant
                // boundary" would claim to have observed something about the data that was never observed;
                // that phrasing exists in check-operations-runtime.ts and is left alone here rather than
                // copied. This pins the current truth and no more than the current truth.
                checkInvertible(
                    "mixedScope is true because the DECLARED COVERAGE LIST spans two tenant boundaries - a static property of that list, not a measurement of this fixture's data",
                    data.mixedScope === true,
                    `mixedScope=${String(data.mixedScope)}; boundaries in the frozen coverage map=[${[...new Set(Object.values(OPERATIONS_DOMAIN_SCOPE))].sort().join(",")}] so this is constant-true for every workspace and every dataset`,
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
        const broken = await call(brokenApi.preview(get(`${BASE}?workspaceId=whatever`)))
        // The precondition for every leak assertion below. Without this the mock can silently stop
        // reaching the throw again - a refactor of the tenancy chain would do it - and the leak
        // assertions would go back to passing against an error containing no secret.
        checkInvertible(
            "MEASURED: the injected secret was actually produced - the failure path reached the throw",
            leakProbe.workspaceLookups === 1,
            `workspace lookups=${leakProbe.workspaceLookups}`,
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

        // ---- the strongest no-write claim, measured on COMMITTED data ----------
        //
        // THIS USED TO PROVE NOTHING. `before` was taken before prisma.$transaction opened, every real
        // request ran inside that transaction, and the transaction ended in `throw new Rollback()`. So
        // if `preview` had written a row, the rollback would have erased it and the counts would still
        // have matched. The assertion was guaranteed to pass by its own test harness.
        //
        // The envelope and authorization work above still uses the rollback, which is correct - it
        // needs seeded tenants and must leave none behind. But the no-write claim has to be measured
        // against data the request can actually persist against, so it gets its own committed fixture
        // and its own explicit cleanup.
        const committed = await seedCommitted(prisma)
        try {
            const beforeCommitted = await countAll()
            const identity = new ControlledIdentity()
            identity.current = committed.user
            const committedApi = new DueWorkApiService(
                new OperationsService(new OperationsContext(prisma, new PersistedTenancy(prisma, identity))),
            )
            const persisted = await call(committedApi.preview(get(`${BASE}?workspaceId=${committed.workspace}`)))
            checkInvertible(
                "the committed-fixture request really succeeded, so the no-write claim is measured on a 200",
                persisted.status === 200,
                `status=${persisted.status} ${String((persisted.body.error as { message?: string } | undefined)?.message ?? "")}`,
            )
            const afterCommitted = await countAll()
            checkInvertible(
                "MEASURED: a committed, non-rolled-back preview request wrote nothing to any counted table",
                JSON.stringify(beforeCommitted) === JSON.stringify(afterCommitted),
                Object.keys(beforeCommitted)
                    .filter(
                        (k) =>
                            (beforeCommitted as Record<string, number>)[k] !==
                            (afterCommitted as Record<string, number>)[k],
                    )
                    .join(",") || "all counts identical",
            )
        } finally {
            await cleanupCommitted(prisma)
        }
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
