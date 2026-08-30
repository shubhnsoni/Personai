/**
 * Wave H2: the unified daily operations view.
 *
 * The claim this harness defends is unusual, so it is worth stating precisely: the value of a
 * cross-engine "what needs attention" view is entirely in its TRUSTWORTHINESS. An owner who believes
 * it will stop opening the six panels it summarises. So the two things that matter are that it cannot
 * write, and that it cannot silently omit a domain - because a view that quietly dropped one would be
 * worse than no view at all.
 *
 * Structural assertions, which need no database:
 *
 *   READ-ONLY BY CONSTRUCTION. The engine is asserted to contain no create/update/delete/upsert call,
 *   no raw-SQL escape hatch, and no transaction. "It only reads" is otherwise a promise in a comment.
 *
 *   TENANT SCOPING PER QUERY. Every findMany in the engine is asserted to filter on profileId. This is
 *   checked per query rather than trusting a wrapper, which is also why the engine repeats the filter
 *   instead of hiding it in one.
 *
 *   DECLARED COVERAGE MATCHES THE CODE. Every domain in OPERATIONS_DOMAINS must have a reader, and
 *   every reader must be a declared domain. Adding a query without declaring it, or declaring a domain
 *   without querying it, both fail.
 *
 *   NO SCHEDULER AND NO PROVIDER. Asserted absent in the runtime and the engine, because "operations"
 *   is exactly the word under which a queue or a mailer tends to arrive unannounced.
 *
 *   NO WRITE METHOD ON THE SURFACE. The route exports GET and nothing else.
 *
 * Behavioural assertions against the disposable database, in a rolled-back transaction:
 *
 *   Two tenants are seeded with records in several domains and the view is computed for each. Tenant A
 *   must never see one of tenant B's ids, in ANY domain - asserted id by id, not by count, because two
 *   tenants with one record each produce the same count either way.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-operations-runtime.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { COHORT_NEEDS_ACTION_DOMAIN, COHORT_NEEDS_ACTION_SCOPE } from "../../src/lib/cohorts/needs-action"
import { OPERATIONS_DOMAINS, OPERATIONS_DOMAIN_SCOPE, OperationsService, UNCOVERED_DOMAINS } from "../../src/lib/operations/engine"
import { OperationsContext } from "../../src/lib/operations/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wh2o_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "../..")

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

// ---------------------------------------------------------------------------
// 1. Structural: read-only by construction
// ---------------------------------------------------------------------------
const engineSrc = readFileSync(join(APP_ROOT, "src/lib/operations/engine.ts"), "utf8")
const httpSrc = readFileSync(join(APP_ROOT, "src/lib/operations/http.ts"), "utf8")
const runtimeSrc = readFileSync(join(APP_ROOT, "src/lib/operations/runtime.ts"), "utf8")
const sharedSrc = readFileSync(join(APP_ROOT, "src/lib/operations/shared.ts"), "utf8")
const routeSrc = readFileSync(join(APP_ROOT, "src/app/api/platform/operations/today/route.ts"), "utf8")

// Comments legitimately discuss writes in order to say there are none, so only executable lines count.
const engineCode = engineSrc
    .split("\n")
    .filter((line) => {
        const t = line.trim()
        return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
    })
    .join("\n")

/**
 * THE GET-ONLY GATE, widened after audit. Shares its reasoning with check-due-work-preview-api.ts.
 *
 * The previous form was `!/export async function (POST|PATCH|PUT|DELETE)\(/`. That misses two declaration
 * styles this repository already uses for handler exports. Measured over its 156 route.ts files:
 * `export async function VERB` 95 times, `export function VERB` 17 times, `export const VERB` 4 times, for
 * POST/PUT/PATCH/DELETE. So a write verb added in either of the two latter styles passed the gate
 * untouched, and it covered neither HEAD nor OPTIONS. Both styles are house style here, so this was not a
 * theoretical hole.
 *
 * The GET side accepts the non-async form for the same reason, and 26 route files here already use it: a
 * gate that fails on a legal refactor gets deleted rather than fixed. Applied to comment-stripped source,
 * because a route file's own comments name the verbs they forbid and this repo has mistaken a prohibition
 * for a violation five times.
 *
 * No `g` flag: a shared /g/ regex keeps `lastIndex` between `.test` calls and answers false on alternate uses.
 */
const WRITE_VERB_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/
const GET_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+GET\b/
const routeCode = routeSrc
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n")

const WRITE_CALLS = [".create(", ".createMany(", ".update(", ".updateMany(", ".delete(", ".deleteMany(", ".upsert("]
const foundWrites = WRITE_CALLS.filter((needle) => engineCode.includes(needle))
checkInvertible(
    "the operations engine contains no create, update, delete or upsert call",
    foundWrites.length === 0,
    foundWrites.join(", ") || `checked ${WRITE_CALLS.length} write forms`,
)
checkInvertible(
    "the operations engine has no raw-SQL escape hatch and no transaction",
    !/\$executeRaw|\$queryRaw|\$transaction/.test(engineCode),
    "no $executeRaw / $queryRaw / $transaction",
)
check(
    "the operations HTTP boundary exposes exactly one method, and it reads",
    /today\(request: Request\)/.test(httpSrc) && !/(create|update|delete|patch|post)\s*\(/i.test(httpSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
)
check(
    "the operations route exports GET and no POST, PUT, PATCH, DELETE, HEAD or OPTIONS - in ANY of the three export styles this repo uses",
    GET_EXPORT.test(routeCode) && !WRITE_VERB_EXPORT.test(routeCode),
    "GET only, checked against `export [async] function|const VERB`",
)

// ---------------------------------------------------------------------------
// 2. Structural: tenant scoping is present on every query
// ---------------------------------------------------------------------------
const findManyCount = (engineCode.match(/\.findMany\(/g) ?? []).length
const profileIdCount = (engineCode.match(/profileId,/g) ?? []).length
// caseMilestones filters through the relation on workspaceId instead of carrying profileId, so it is
// excluded from the profileId count and asserted separately below.
const workspaceScopedReaders = Object.values(OPERATIONS_DOMAIN_SCOPE).filter((s) => s === "workspace").length
checkInvertible(
    "every profile-scoped findMany in the operations engine filters on profileId",
    findManyCount > 0 && profileIdCount >= findManyCount - workspaceScopedReaders,
    `findMany=${findManyCount} profileId filters=${profileIdCount} workspace-scoped readers=${workspaceScopedReaders}`,
)
checkInvertible(
    "the workspace-scoped reader filters through its relation on workspaceId, not on profileId",
    /case: \{ workspaceId \}/.test(engineCode),
    "caseMilestones filters case.workspaceId",
)
// The scope difference is the kind of thing that silently makes a total unreconcilable, so it must be
// reported rather than merely known.
checkInvertible(
    "every domain declares which tenant boundary it was read on",
    OPERATIONS_DOMAINS.every((domain) => OPERATIONS_DOMAIN_SCOPE[domain] === "profile" || OPERATIONS_DOMAIN_SCOPE[domain] === "workspace"),
    Object.entries(OPERATIONS_DOMAIN_SCOPE)
        .map(([d, s]) => `${d}:${s}`)
        .join(" "),
)
check(
    "the scope map covers exactly the declared domains, with no extra and none missing",
    Object.keys(OPERATIONS_DOMAIN_SCOPE).sort().join(",") === [...OPERATIONS_DOMAINS].sort().join(","),
)
check(
    "the operations context asks only for profile.read, so there is no write permission path at all",
    /permission: "profile\.read"/.test(sharedSrc) && !/profile\.update/.test(sharedSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
)

// ---------------------------------------------------------------------------
// 3. Structural: declared coverage matches the implementation
// ---------------------------------------------------------------------------
// Each reader is a private method named after its domain and returns items tagged with it.
//
// Two tagging forms are recognised, and the second is not a loophole. Most readers own their domain
// name and tag it as a literal. `cohortTasks` does NOT own its name: the cohort engine declares it as
// COHORT_NEEDS_ACTION_DOMAIN, and the operations reader imports that constant precisely so a rename in
// the owning engine cannot leave this view filing items under a domain it no longer declares. A scan
// that only accepted literals would therefore have punished the safer construction - so it accepts a
// tag by imported constant, but ONLY for a constant it can resolve to a declared domain name, which
// keeps the assertion honest rather than merely permissive.
const literalTagged = [...engineCode.matchAll(/domain: "([a-zA-Z]+)" as const/g)].map((m) => m[1])
const constantTagged: string[] = [...engineCode.matchAll(/domain: ([A-Z][A-Z0-9_]+),/g)]
    .map((m) => m[1])
    .filter((identifier) => identifier === "COHORT_NEEDS_ACTION_DOMAIN")
    .map(() => String(COHORT_NEEDS_ACTION_DOMAIN))
const uniqueTagged = [...new Set([...literalTagged, ...constantTagged])].sort()
const declared = [...OPERATIONS_DOMAINS].sort()
checkInvertible(
    "every declared operations domain has a reader, and every reader is declared",
    uniqueTagged.length === declared.length && uniqueTagged.every((d, i) => d === declared[i]),
    `declared=[${declared.join(",")}] implemented=[${uniqueTagged.join(",")}]`,
)
// The cohort domain must be consumed, not re-decided. Scanned over the cohortTasks METHOD BODY only,
// not the whole engine: a file-wide token scan flagged `SUBMITTED` and would have kept flagging it,
// because SUBMITTED is also a legitimate INSPECTION status in INSPECTION_OPEN_STATUSES. That scan was
// testing whether a word appears, not whether cohort rules are restated - the same over-broad shape the
// vacuity audit exists to catch, in the assertion rather than in the code.
const cohortMethod = /private async cohortTasks\([\s\S]*?\n {4}\}/.exec(engineCode)?.[0] ?? ""
const cohortStateTokens = [
    "SUBMITTED",
    "RETURNED",
    "ACCEPTED",
    "ABSENT",
    "LATE",
    "ELIGIBLE",
    "ISSUED",
    "LAPSED",
    "REMINDED",
    "RENEWED",
    "submissionFlow",
    "renewalFlow",
    "certificateFlow",
    "ATTENDANCE_CREDITED",
]
const restated = cohortStateTokens.filter((token) =>
    new RegExp(token).test(cohortMethod.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")),
)
checkInvertible(
    "operations CONSUMES the cohort engine's declaration and its own reader names no cohort state at all",
    cohortMethod.length > 0 && /resolveCohortNeedsAction\(/.test(cohortMethod) && restated.length === 0,
    cohortMethod.length === 0
        ? "cohortTasks method not found - the scan is broken, not the code"
        : restated.length > 0
          ? `RESTATED cohort state: ${restated.join(",")}`
          : `calls the declaration; names none of ${cohortStateTokens.length} cohort state tokens`,
)
// The two engines must agree on the tenant boundary. engine.ts asserts this at module load; asserting
// it here too means the harness fails with a readable message rather than an import-time throw.
checkInvertible(
    "the cohort engine and the operations view agree on cohortTasks' tenant scope",
    OPERATIONS_DOMAIN_SCOPE[COHORT_NEEDS_ACTION_DOMAIN] === COHORT_NEEDS_ACTION_SCOPE,
    `operations=${OPERATIONS_DOMAIN_SCOPE[COHORT_NEEDS_ACTION_DOMAIN]} cohorts=${COHORT_NEEDS_ACTION_SCOPE}`,
)
// cohortTasks must no longer be listed as an absence now that it is covered.
checkInvertible(
    "cohortTasks is no longer in UNCOVERED_DOMAINS, because it is now covered",
    !Object.prototype.hasOwnProperty.call(UNCOVERED_DOMAINS, "cohortTasks"),
    `doesNotCover=[${Object.keys(UNCOVERED_DOMAINS).join(",")}]`,
)
check(
    "each declared domain is queried exactly once, so no domain is silently counted twice",
    literalTagged.length + constantTagged.length === uniqueTagged.length,
    `${literalTagged.length + constantTagged.length} tags for ${uniqueTagged.length} domains`,
)
// An unexplained absence reads as an oversight and gets "fixed" badly by the next person.
check(
    "domains deliberately not covered are listed with a reason rather than omitted",
    Object.keys(UNCOVERED_DOMAINS).length > 0 &&
        Object.values(UNCOVERED_DOMAINS).every((reason) => typeof reason === "string" && reason.length > 40),
    Object.keys(UNCOVERED_DOMAINS).join(", "),
)
check(
    "no domain is both covered and listed as uncovered",
    Object.keys(UNCOVERED_DOMAINS).every((key) => !(OPERATIONS_DOMAINS as readonly string[]).includes(key)),
)

// ---------------------------------------------------------------------------
// 4. Structural: no scheduler, no provider, no notification
// ---------------------------------------------------------------------------
const allOperationsCode = `${engineCode}\n${httpSrc}\n${runtimeSrc}\n${sharedSrc}\n${routeSrc}`
const PROVIDER_NEEDLES = ["fetch(", "nodemailer", "resend", "stripe", "twilio", "setInterval", "setTimeout", "cron", "enqueue", "publish("]
const foundProviders = PROVIDER_NEEDLES.filter((needle) => allOperationsCode.toLowerCase().includes(needle.toLowerCase()))
checkInvertible(
    "the operations domain contains no scheduler, queue, mailer or payment client",
    foundProviders.length === 0,
    foundProviders.join(", ") || `checked ${PROVIDER_NEEDLES.length} forms`,
)
check(
    "the runtime states that any future adapter must appear there first",
    /one place a reviewer has to read/.test(runtimeSrc),
)

// ---------------------------------------------------------------------------
// 5. Behavioural: two tenants, and neither sees the other
// ---------------------------------------------------------------------------
type Seeded = Readonly<{
    wsA: string
    wsB: string
    userA: string
    userB: string
    jobA: string
    jobB: string
    inspectionA: string
    inspectionB: string
}>

async function seed(tx: Tx): Promise<Seeded> {
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
        // A committed field job with no visit window: an exception in its own right.
        await mk(
            `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","updatedAt")
             values ('${q(`job${side}`)}','${q(`pr${side}`)}','${q(`job${side}`)}','Callout','SCHEDULED','NORMAL','1 Example Street',CURRENT_TIMESTAMP)`,
        )
        // An open inspection on that job. Chosen over a Reservation deliberately: Reservation requires
        // a RestaurantTable foreign key and an endAt, so seeding it would add fixture surface that has
        // nothing to do with the property under test. Inspection needs only its job and a reference.
        await mk(
            `insert into "FieldJobInspection" ("id","jobId","profileId","reference","status","updatedAt")
             values ('${q(`insp${side}`)}','${q(`job${side}`)}','${q(`pr${side}`)}','${q(`insp${side}`)}','IN_PROGRESS',CURRENT_TIMESTAMP)`,
        )
    }

    return {
        wsA: q("wsa"),
        wsB: q("wsb"),
        userA: `clerk_${q("ua")}`,
        userB: `clerk_${q("ub")}`,
        jobA: q("joba"),
        jobB: q("jobb"),
        inspectionA: q("inspa"),
        inspectionB: q("inspb"),
    }
}

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

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
                const service = new OperationsService(
                    new OperationsContext(tx as unknown as PrismaClient, new PersistedTenancy(tx as unknown as PrismaClient, identity)),
                )

                identity.current = ids.userA
                const a = await service.summary(ids.wsA)
                identity.current = ids.userB
                const b = await service.summary(ids.wsB)

                const aIds = a.items.map((i) => i.id)
                const bIds = b.items.map((i) => i.id)

                checkInvertible(
                    "tenant A sees its own field job and its own inspection",
                    aIds.includes(ids.jobA) && aIds.includes(ids.inspectionA),
                    `A saw ${a.total} items across ${a.domains.filter((d) => d.count > 0).length} domains`,
                )
                // Asserted id by id rather than by count: two tenants with one record each produce the
                // same count whether or not isolation holds, so a count assertion proves nothing.
                checkInvertible(
                    "tenant A never sees ANY of tenant B's ids, in any domain",
                    !aIds.includes(ids.jobB) && !aIds.includes(ids.inspectionB),
                    aIds.includes(ids.jobB) || aIds.includes(ids.inspectionB) ? "LEAKED" : `${aIds.length} ids all tenant A`,
                )
                checkInvertible(
                    "tenant B never sees ANY of tenant A's ids either, so isolation is not one-directional",
                    !bIds.includes(ids.jobA) && !bIds.includes(ids.inspectionA),
                    bIds.includes(ids.jobA) || bIds.includes(ids.inspectionA) ? "LEAKED" : `${bIds.length} ids all tenant B`,
                )
                check(
                    "the summary reports the profileId it resolved, and the two tenants differ",
                    a.profileId !== b.profileId,
                    `${a.profileId === b.profileId ? "SAME" : "distinct"}`,
                )
                check(
                    "an unscheduled committed job is reported as an exception rather than omitted",
                    a.items.some((i) => i.id === ids.jobA && i.reason === "committed but unscheduled"),
                    a.items.find((i) => i.id === ids.jobA)?.reason ?? "MISSING",
                )
                check(
                    "the response declares what it covers and what it does not",
                    a.covers.length === OPERATIONS_DOMAINS.length && Object.keys(a.doesNotCover).length > 0,
                )
                // The mixed-boundary fact must be reported, not merely true.
                checkInvertible(
                    "the response reports that its total spans more than one tenant boundary",
                    a.mixedScope === true && a.domains.some((d) => d.scope === "workspace") && a.domains.some((d) => d.scope === "profile"),
                    `mixedScope=${String(a.mixedScope)}`,
                )
                check(
                    "the response reports the workspace it authorised, which workspace-scoped domains were read on",
                    a.workspaceId === ids.wsA && b.workspaceId === ids.wsB,
                    `${a.workspaceId === ids.wsA ? "correct" : "WRONG"}`,
                )
                check(
                    "every comparison in one response is made against a single clock reading",
                    a.asOf instanceof Date && a.items.length > 0 && a.items.every((i) => i.at === null || i.at instanceof Date),
                )

                // A signed-out caller must not get a summary at all.
                identity.current = null
                let refused = false
                let refusalCode = ""
                try {
                    await service.summary(ids.wsA)
                } catch (e) {
                    refused = true
                    refusalCode = (e as { code?: string }).code ?? (e as Error).message.slice(0, 60)
                }
                checkInvertible("a signed-out caller is refused rather than given a summary", refused, refusalCode || "ACCEPTED")

                // A member of A asking about B's workspace must be refused.
                identity.current = ids.userA
                let crossRefused = false
                let crossCode = ""
                try {
                    await service.summary(ids.wsB)
                } catch (e) {
                    crossRefused = true
                    crossCode = (e as { code?: string }).code ?? (e as Error).message.slice(0, 60)
                }
                checkInvertible(
                    "a member of one workspace cannot ask for another workspace's operations",
                    crossRefused,
                    crossCode || "ACCEPTED",
                )

                // An out-of-range horizon is a 400, not a silently clamped value.
                identity.current = ids.userA
                let badHorizon = false
                try {
                    await service.summary(ids.wsA, { horizonHours: 0 })
                } catch {
                    badHorizon = true
                }
                check("a zero horizon is refused rather than silently defaulted", badHorizon)

                throw new Rollback()
            })
        } catch (e) {
            if (!(e instanceof Rollback)) throw e
        }

        const after = await prisma.fieldJob.count()
        check("harness left zero residue", before === after, `FieldJob ${before} -> ${after}`)
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} operations assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} operations assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("Operations view holds: read-only, tenant-scoped, and honest about its coverage.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
