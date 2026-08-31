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
 *   BOUNDED IN THE DATABASE - FOR THE EIGHT READERS THAT LIVE HERE, WHICH IS NOT ALL NINE DOMAINS. Every
 *   findMany in engine.ts is asserted to carry `take`. That scan reads engine.ts and nothing else, so it
 *   covers eight of the nine declared domains. The ninth, cohortTasks, does all of its reading in
 *   src/lib/cohorts/needs-action.ts, and its reads are NOT bounded by take. The assertion below says so
 *   in its own words rather than claiming all nine, and the excluded domain is asserted as a declared,
 *   counted gap - see THE NINTH DOMAIN, BROUGHT INSIDE THE NET.
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
 *   DETERMINISM ON A TIE-HEAVY FIXTURE. Every domain orders by a business key that is not unique, so the
 *   fixture is built so that those keys TIE: reservations sharing one startAt, appointments sharing one
 *   startTime, field jobs sharing both a null scheduledStartAt and one createdAt, milestones sharing both
 *   a dueAt and an ordinal, and a whole catalogue sitting at onHand 0. A fixture where nothing ties would
 *   pass whether or not the ordering is reproducible, and would therefore prove nothing.
 *
 *   Two of those groups are seeded LARGER THAN THE PER-DOMAIN CAP on purpose, because a cap over an
 *   undefined order does not merely reshuffle the answer - it changes which rows are IN it. Each
 *   tie-heavy group is also inserted in DESCENDING id order, so id-ascending is not the order the rows
 *   physically sit in and a reader that fails to ask for one cannot pass by accident.
 *
 *   THE CAP MUST DROP THE LEAST IMPORTANT ROW, NEVER THE MOST IMPORTANT. This is the one way a
 *   bounding change could do real damage - an owner is not told about a stockout because the query got
 *   cheaper - so it is asserted directly, against an independently computed answer rather than against
 *   the engine's own.
 *
 *   THE INVENTORY BOUND IS ASSERTED EQUIVALENT, NOT MERELY CHEAPER. The reorder comparison moved from
 *   TypeScript into SQL as a field reference. The old computation - fetch every tracked row, filter
 *   onHand <= reorderPoint in TypeScript, sort, cut - is performed here independently and the engine's
 *   answer must equal it exactly.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-operations-runtime.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import {
    COHORT_NEEDS_ACTION_DOMAIN,
    COHORT_NEEDS_ACTION_SCOPE,
    COHORT_NEEDS_ACTION_SORT_KEYS,
    COHORT_NEEDS_ACTION_UNBOUNDED_READS,
} from "../../src/lib/cohorts/needs-action"
import {
    OPERATIONS_DOMAINS,
    OPERATIONS_DOMAIN_SCOPE,
    type OperationsDomain,
    OperationsService,
    type OperationsSummary,
    UNCOVERED_DOMAINS,
} from "../../src/lib/operations/engine"
import { OperationsApiService } from "../../src/lib/operations/http"
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
 * THE HANDLER-EXPORT GATE, widened after audit and then SPLIT. Shares its reasoning with
 * check-due-work-preview-api.ts, where the split is argued at length.
 *
 * The previous form was `!/export async function (POST|PATCH|PUT|DELETE)\(/`. That misses two declaration
 * styles this repository already uses for handler exports. Measured over its 156 route.ts files:
 * `export async function VERB` 95 times, `export function VERB` 17 times, `export const VERB` 4 times, for
 * POST/PUT/PATCH/DELETE. So a write verb added in either of the two latter styles passed the gate
 * untouched. Both styles are house style here, so this was not a theoretical hole.
 *
 * THE WIDENING THEN OVERSHOT, and this round corrects it. It folded HEAD and OPTIONS into the same
 * alternation and named the result `WRITE_VERB_EXPORT`. Under RFC 9110 those two are SAFE methods; a
 * constant named for write verbs that contains them is a lie in the code, and the assertion built on it
 * would have gone red on a legal, RFC-compliant HEAD export. Measured: nothing under src/ exports HEAD or
 * OPTIONS today, so this was latent rather than failing. The two ideas are now two constants:
 *
 *   STATE_CHANGING_VERB_EXPORT  POST, PUT, PATCH, DELETE. Their absence IS the no-write guarantee.
 *   SAFE_METHOD_HANDLER_EXPORT  HEAD, OPTIONS. Their absence guarantees nothing about writes; it is the
 *                               precondition for next@16.3.3 deriving HEAD from GET and answering OPTIONS
 *                               itself, which is a fact worth recording and not a prohibition.
 *
 * The GET side accepts the non-async form for the same reason as before, and 26 route files here already
 * use it: a gate that fails on a legal refactor gets deleted rather than fixed. Applied to
 * comment-stripped source, because a route file's own comments name the verbs they forbid and this repo
 * has mistaken a prohibition for a violation five times.
 *
 * No `g` flag: a shared /g/ regex keeps `lastIndex` between `.test` calls and answers false on alternate uses.
 */
const STATE_CHANGING_VERB_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/
const SAFE_METHOD_HANDLER_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(?:HEAD|OPTIONS)\b/
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
    "the operations route exports GET and no POST, PUT, PATCH or DELETE - in ANY of the three export styles this repo uses",
    GET_EXPORT.test(routeCode) && !STATE_CHANGING_VERB_EXPORT.test(routeCode),
    "no state-changing verb, checked against `export [async] function|const VERB`",
)
// NOT a prohibition. HEAD and OPTIONS are safe methods and exporting either would be legal; this records
// the precondition that makes next@16.3.3 derive HEAD from GET and answer OPTIONS itself, which is what
// the behavioural block below then measures against the real service.
check(
    "MEASURED: the operations route exports GET and neither HEAD nor OPTIONS, so the framework derives both - HEAD by invoking this GET handler, OPTIONS as its own 204 with Allow",
    GET_EXPORT.test(routeCode) && !SAFE_METHOD_HANDLER_EXPORT.test(routeCode),
    "GET exported; HEAD/OPTIONS left to the framework",
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
// 2b. Structural: every reader asks for a REPRODUCIBLE order, and asks the database to bound it
// ---------------------------------------------------------------------------
/**
 * DETERMINISM PROVEN BY CONSTRUCTION, which is the only way it can be proven.
 *
 * A behavioural test can only show that two requests HAPPENED to agree. `ORDER BY` on a non-unique key
 * leaves tied rows in an undefined order, and undefined does not mean different - the same plan over the
 * same physical rows will usually return the same sequence, so a fixture can agree twice and still be
 * riding on luck. What makes the answer reproducible is a total order in the query, and that is a
 * property of the source. So it is asserted here, per reader, and the tie-heavy fixture further down
 * demonstrates the consequence.
 *
 * The expected key sequences are PINNED IN FULL rather than merely checked for a trailing id. That is
 * deliberate: the cheap way to make sorting deterministic is to simplify what is being sorted, and
 * pinning every key ahead of the tie-break means a change to a domain's business ordering - dropping
 * `scheduledStartAt` so nulls stop sorting last, or dropping `ordinal` from the milestone order - fails
 * here instead of passing quietly as "still deterministic".
 */
const EXPECTED_ORDER_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    // Business key first, exactly as audited; the unique id last, and only last.
    reservation: ["startAt", "id"],
    booking: ["startTime", "id"],
    fieldJob: ["scheduledStartAt", "createdAt", "id"],
    fieldJobInspection: ["createdAt", "id"],
    inventoryItem: ["onHand", "id"],
    fulfilment: ["createdAt", "id"],
    returnRequest: ["createdAt", "id"],
    caseMilestone: ["dueAt", "ordinal", "id"],
})

type ReaderQuery = Readonly<{ delegate: string; body: string; orderKeys: readonly string[]; directions: readonly string[] }>
const readerQueries: ReaderQuery[] = []
{
    const starts = [...engineCode.matchAll(/this\.ctx\.db\.(\w+)\.findMany\(/g)]
    for (let i = 0; i < starts.length; i += 1) {
        const from = starts[i].index ?? 0
        const to = i + 1 < starts.length ? (starts[i + 1].index ?? engineCode.length) : engineCode.length
        const body = engineCode.slice(from, to)
        const orderBy = /orderBy:\s*(\[[\s\S]*?\]|\{[\s\S]*?\})/.exec(body)?.[1] ?? ""
        const pairs = [...orderBy.matchAll(/(\w+):\s*"(asc|desc)"/g)]
        readerQueries.push({
            delegate: starts[i][1],
            body,
            orderKeys: pairs.map((p) => p[1]),
            directions: pairs.map((p) => p[2]),
        })
    }
}

checkInvertible(
    "every database reader in the engine was found by the scan, so the assertions below cover all of them",
    readerQueries.length === findManyCount && readerQueries.length === Object.keys(EXPECTED_ORDER_KEYS).length,
    `readers=${readerQueries.length} findMany=${findManyCount} pinned=${Object.keys(EXPECTED_ORDER_KEYS).length}: ${readerQueries.map((r) => r.delegate).join(",")}`,
)
// The load-bearing one: a non-unique ORDER BY leaves tied rows undefined, and a cap over an undefined
// order changes the SET, not just the sequence.
const notUniquelyOrdered = readerQueries.filter((r) => r.orderKeys[r.orderKeys.length - 1] !== "id")
checkInvertible(
    "every reader's ordering ends on the UNIQUE id, so no reader can return tied rows in an undefined order",
    readerQueries.length > 0 && notUniquelyOrdered.length === 0,
    notUniquelyOrdered.length > 0
        ? `NO UNIQUE TIE-BREAK: ${notUniquelyOrdered.map((r) => `${r.delegate}[${r.orderKeys.join(">")}]`).join(" ")}`
        : readerQueries.map((r) => `${r.delegate}[${r.orderKeys.join(">")}]`).join(" "),
)
// Appended LAST is what makes it safe. A tie-break placed anywhere else would outrank a business key and
// silently reorder work by an arbitrary cuid.
const wrongKeys = readerQueries.filter(
    (r) => (EXPECTED_ORDER_KEYS[r.delegate] ?? []).join(">") !== r.orderKeys.join(">"),
)
checkInvertible(
    "each reader's BUSINESS ordering is exactly the audited one with the tie-break appended after it, not woven into it",
    wrongKeys.length === 0,
    wrongKeys.length > 0
        ? wrongKeys.map((r) => `${r.delegate}: expected [${(EXPECTED_ORDER_KEYS[r.delegate] ?? []).join(">")}] got [${r.orderKeys.join(">")}]`).join(" | ")
        : `all ${readerQueries.length} readers in engine.ts match their pinned key sequence`,
)
checkInvertible(
    "no reader silently reverses a business ordering, so overdue and low-stock work still sorts first",
    readerQueries.every((r) => r.directions.every((d) => d === "asc")),
    readerQueries.map((r) => `${r.delegate}:${r.directions.join(",")}`).join(" "),
)
// The unbounded reader is the one that could return a different SET on two identical requests.
const unbounded = readerQueries.filter((r) => !/take: MAX_ITEMS_PER_DOMAIN/.test(r.body))
/**
 * WHAT THIS ASSERTION COVERS, WHICH IS NARROWER THAN IT USED TO SAY.
 *
 * It read "every reader is bounded IN THE DATABASE by take, so none fetches a whole table to show twenty
 * rows". Both halves of that are measured over ONE file: `readerQueries` is scanned out of `engineCode`,
 * and `findManyCount` is `(engineCode.match(/\.findMany\(/g) ?? []).length`. Nine domains are declared.
 * Eight of them read in this file. The ninth, cohortTasks, does all of its reading in
 * src/lib/cohorts/needs-action.ts, which this scan cannot see - and it is the one domain whose reads
 * carry no `take` at all. So the sentence made a nine-reader claim on eight readers' evidence, and the
 * reader it silently excluded is the only one for which the claim is false.
 *
 * The wording is narrowed to the file it measures, and the excluded domain is asserted immediately below
 * rather than left outside the net. An overstated assertion is worse than a declared gap: a declared gap
 * gets closed, an overstatement gets believed - including by the next person deciding whether this whole
 * area still needs looking at.
 */
checkInvertible(
    "every reader IN ENGINE.TS is bounded IN THE DATABASE by take, so no reader in this file fetches a whole table to show twenty rows",
    unbounded.length === 0 && readerQueries.length === findManyCount,
    unbounded.length > 0
        ? `UNBOUNDED: ${unbounded.map((r) => r.delegate).join(",")}`
        : `all ${readerQueries.length} of ${findManyCount} engine.ts readers carry take: MAX_ITEMS_PER_DOMAIN - cohortTasks reads elsewhere and is asserted separately below`,
)
// The inventory reader is the one that used to cut in TypeScript. Scanned over ITS body only: cohortTasks
// slices legitimately, because it caps an in-memory declaration rather than a query result.
const inventoryReader = readerQueries.find((r) => r.delegate === "inventoryItem")
checkInvertible(
    "the inventory reorder comparison happens in SQL as a field reference, so its take is correct rather than lossy",
    inventoryReader !== undefined &&
        /onHand: \{ lte: this\.ctx\.db\.inventoryItem\.fields\.reorderPoint \}/.test(inventoryReader.body),
    inventoryReader === undefined ? "inventory reader not found - the scan is broken, not the code" : "onHand <= reorderPoint compared in the database",
)
checkInvertible(
    "the inventory reader no longer cuts its result in TypeScript, which is what made its SET undefined",
    inventoryReader !== undefined && !/\.slice\(/.test(inventoryReader.body),
    inventoryReader === undefined ? "inventory reader not found" : "no .slice() in the inventory reader",
)
/**
 * cohortTasks has no orderBy of its own and must not acquire one: it consumes a declaration the cohort
 * engine has already put in a total order. That inheritance is asserted at its source, so the day
 * `resolveCohortNeedsAction` stops ending its sort chain on the unique id, this fails here rather than
 * showing up as an operations view that reshuffles cohort work between two refreshes.
 */
const cohortSrc = readFileSync(join(APP_ROOT, "src/lib/cohorts/needs-action.ts"), "utf8")
// Comment-stripped the same way routeCode is, and for the same reason: that file's comments discuss the
// `take` it does not have, and a prohibition has been mistaken for a violation here before.
const cohortCode = cohortSrc
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n")
checkInvertible(
    "the cohort declaration this view consumes is itself totally ordered, ending its sort chain on the unique id",
    /a\.id\.localeCompare\(b\.id\)/.test(cohortSrc) && /items\.sort\(/.test(cohortSrc),
    "resolveCohortNeedsAction sorts at, then reason, then id",
)
/**
 * THE INHERITANCE PINNED AGAINST A PUBLISHED CONTRACT, NOT ONLY AGAINST THE FILE'S TEXT.
 *
 * The regex above catches the id tie-break disappearing, which is the failure that would make the slice
 * above cut an undefined sequence. It does not catch the chain being SHORTENED in the middle, and that
 * matters for the same reason EXPECTED_ORDER_KEYS is pinned in full here: the cheap way to make a sort
 * reproducible is to simplify what is being sorted, and a chain reduced to `at` then `id` would still
 * end on the unique id and still read as "deterministic" while having silently dropped the key that
 * separates a whole cohort's absences on one session from the submissions sharing that timestamp.
 *
 * So the owning module publishes its chain as COHORT_NEEDS_ACTION_SORT_KEYS and it is pinned in full
 * here, exactly as the eight local readers are. Its own harness asserts that the published chain is the
 * chain the code applies and that the returned sequence obeys it pairwise.
 */
checkInvertible(
    "the cohort declaration PUBLISHES its sort chain, and it is the audited one in full - so the order this reader inherits is a contract rather than something re-derived from another file's text",
    COHORT_NEEDS_ACTION_SORT_KEYS.join(">") === "at>reason>id" &&
        COHORT_NEEDS_ACTION_SORT_KEYS[COHORT_NEEDS_ACTION_SORT_KEYS.length - 1] === "id",
    `cohortTasks inherits [${COHORT_NEEDS_ACTION_SORT_KEYS.join(">")}]`,
)
/**
 * THE NINTH DOMAIN, BROUGHT INSIDE THE NET.
 *
 * The boundedness assertion above is scoped to engine.ts, and the arithmetic of why that is not the whole
 * story is asserted rather than described: nine domains are declared, eight readers were found in this
 * file, and the one left over is cohortTasks, which delegates its reading to needs-action.ts.
 *
 * That file's reads are unbounded, and the gap is DECLARED at its source with the reason a `take` there
 * would return the wrong rows rather than fewer of the right ones. Counting it from here is what makes
 * the ninth domain visible to this harness at all: the count is two-sided, so a `take` appearing in that
 * file, or an eighth read being added to it, fails here as well as there. Neither this view nor that
 * declaration can drift into a quieter state without a red assertion.
 */
const cohortFindMany = (cohortCode.match(/\.findMany\(/g) ?? []).length
const cohortTakes = (cohortCode.match(/\btake:/g) ?? []).length
checkInvertible(
    "exactly one declared domain does no reading in engine.ts and it is cohortTasks - the arithmetic that makes an engine-only boundedness claim cover eight of nine domains",
    OPERATIONS_DOMAINS.length === findManyCount + 1 &&
        (OPERATIONS_DOMAINS as readonly string[]).includes(COHORT_NEEDS_ACTION_DOMAIN) &&
        !readerQueries.some((r) => r.delegate.startsWith("cohort")),
    `${OPERATIONS_DOMAINS.length} declared domains, ${findManyCount} readers in engine.ts, remainder=${COHORT_NEEDS_ACTION_DOMAIN}`,
)
checkInvertible(
    "the ninth domain's reads are unbounded, that gap is declared at its source with a reason, and the declared count is exactly what that file contains",
    cohortFindMany === COHORT_NEEDS_ACTION_UNBOUNDED_READS.count &&
        cohortTakes === 0 &&
        COHORT_NEEDS_ACTION_UNBOUNDED_READS.reason.length > 200,
    `needs-action.ts: findMany=${cohortFindMany} take=${cohortTakes}; declared unbounded=${COHORT_NEEDS_ACTION_UNBOUNDED_READS.count}, reason ${COHORT_NEEDS_ACTION_UNBOUNDED_READS.reason.length} chars`,
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
/**
 * THE PER-DOMAIN CAP, read out of the engine rather than restated here.
 *
 * The expected sequences below have to cut where the engine cuts. Hardcoding 20 would make this harness
 * agree with a stale number the day the cap moves, and exporting the constant would widen the engine's
 * API for a test's convenience, so it is read from the source instead.
 */
const CAP = Number(/const MAX_ITEMS_PER_DOMAIN = (\d+)/.exec(engineSrc)?.[1] ?? "0")
check("the per-domain cap was recovered from the engine source, so the expected cuts below are its cut", CAP > 0, `MAX_ITEMS_PER_DOMAIN=${CAP}`)

/**
 * THE TIE-HEAVY FIXTURE.
 *
 * Every group below shares its domain's business ordering key, because a fixture in which each row has a
 * distinct timestamp cannot tell a total order from a partial one - both return the same sequence, so a
 * passing assertion would say nothing about determinism.
 *
 * Two groups deliberately EXCEED the cap - reservations at 22 and stockouts at 24, against a cap of 20 -
 * because that is where an undefined order stops being cosmetic: the cap has to cut somewhere, and
 * cutting an undefined order makes the SET undefined rather than merely its arrangement.
 *
 * Both groups also carry rows that are genuinely LESS urgent by their domain's own rule - reservations
 * dated three months later, stock sitting at 4 against a reorder point of 5 - which must be the rows the
 * cap drops. A cap that dropped a stockout to make room for a well-stocked item would be the one way this
 * change could do real damage, so the fixture contains the material to catch it.
 *
 * IDS ARE COLLATION-PROOF ON PURPOSE. Every id in a group has the same length and differs only in
 * zero-padded digits, so "ascending id" means the same thing in TypeScript as in the database whatever
 * collation the target uses. Without that, an expected sequence computed here could disagree with the
 * database's ORDER BY over an underscore, and the failure would look like the bug this harness exists to
 * catch instead of the fixture artefact it would actually be.
 *
 * ROWS ARE INSERTED IN DESCENDING ID ORDER, so ascending-by-id is never the order the rows physically sit
 * in. A reader that asks for no tie-break tends to get physical order back, which here is the exact
 * REVERSE of the right answer - so the mutation of removing a tie-break is caught behaviourally and not
 * only structurally.
 */
const TIED_AT = "2020-03-01 10:00:00"
const TIED_END = "2020-03-01 11:00:00"
const LATER_AT = "2020-06-01 10:00:00"
const LATER_END = "2020-06-01 11:00:00"
const RES_TIED = 22
const INV_TIED = 24
const SMALL_GROUP = 3

type TieHeavy = Readonly<{
    reservationsTied: readonly string[]
    /** Later-dated, therefore less urgent: the cap must drop these before any tied row. */
    reservationsLater: readonly string[]
    appointmentsTied: readonly string[]
    fieldJobsTied: readonly string[]
    inspectionsTied: readonly string[]
    fulfilmentsTied: readonly string[]
    returnsTied: readonly string[]
    milestonesTied: readonly string[]
    /** onHand 0 against a reorder point of 5: the most urgent rows, and more of them than the cap admits. */
    inventoryTied: readonly string[]
    /** onHand 4 against a reorder point of 5: still needs reordering, but less urgently. */
    inventoryHigher: readonly string[]
    /** Above its own reorder point, untracked, or with no reorder point: must never be reported at all. */
    inventoryNotCandidates: readonly string[]
}>

type Seeded = Readonly<{
    wsA: string
    wsB: string
    userA: string
    userB: string
    profileA: string
    profileB: string
    jobA: string
    jobB: string
    inspectionA: string
    inspectionB: string
    tie: TieHeavy
    probeB: InventoryProbe
}>

/** Ascending by id, compared the way the database compares these ids. See the note on collation above. */
function byId(x: string, y: string): number {
    return x < y ? -1 : x > y ? 1 : 0
}

/**
 * A SECOND INVENTORY SHAPE, on tenant B, that can tell a real column-to-column comparison from a
 * cheap approximation of one.
 *
 * Tenant A's inventory is deliberately tie-heavy and larger than the cap, which is what proves the cut is
 * reproducible - but it also makes A blind to one specific regression. With 24 stockouts filling a cap of
 * 20, dropping the `onHand <= reorderPoint` comparison from the query changes nothing OBSERVABLE on A: the
 * twenty lowest-stock rows are the same rows either way. A harness that only had tenant A would catch that
 * mutation by reading the source and not by running it.
 *
 * So tenant B carries a shape where the comparison decides the ANSWER. Its candidate set is smaller than
 * the cap, and it holds rows with LOWER absolute stock than a genuine candidate which are nevertheless
 * above their OWN reorder point. Order by stock alone and those rows come first; compare each row against
 * its own reorder point and they are not candidates at all.
 */
type InventoryProbe = Readonly<{
    /** onHand 0 against a reorder point of 2: candidates, and the most urgent. */
    candidatesUrgent: readonly string[]
    /** onHand 5 against a reorder point of 9: candidates, less urgent, and OUTRANKED BY STOCK by the rows below. */
    candidatesLessUrgent: readonly string[]
    /** onHand 1 against a reorder point of 0: NOT candidates, despite holding less stock than the rows above. */
    nonCandidatesLowerStock: readonly string[]
}>

async function seedInventoryProbe(tx: Tx, profileId: string, workspaceId: string, q: (s: string) => string): Promise<InventoryProbe> {
    const mk = (sql: string) => tx.$executeRawUnsafe(sql)
    const group = (kind: string, from: number, count: number) =>
        Array.from({ length: count }, (_, i) => q(`${kind}_${String(from + i).padStart(3, "0")}`))
    const rev = <T,>(xs: readonly T[]) => [...xs].reverse()

    const location = q("bloc_001")
    await mk(
        `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${location}','${workspaceId}','${location}',CURRENT_TIMESTAMP)`,
    )
    const product = q("bprod_001")
    await mk(
        `insert into "DigitalProduct" ("id","profileId","title","updatedAt") values ('${product}','${profileId}','Probe',CURRENT_TIMESTAMP)`,
    )
    const candidatesUrgent = group("binv", 1, 3)
    const nonCandidatesLowerStock = group("binv", 101, 4)
    const candidatesLessUrgent = group("binv", 201, 3)
    const rows = [
        ...candidatesUrgent.map((id) => ({ id, onHand: 0, point: 2 })),
        ...nonCandidatesLowerStock.map((id) => ({ id, onHand: 1, point: 0 })),
        ...candidatesLessUrgent.map((id) => ({ id, onHand: 5, point: 9 })),
    ]
    await mk(
        `insert into "ProductVariant" ("id","profileId","productId","title","updatedAt") values ` +
            rev(rows)
                .map((r) => `('${r.id}_v','${profileId}','${product}','Probe',CURRENT_TIMESTAMP)`)
                .join(","),
    )
    await mk(
        `insert into "InventoryItem" ("id","profileId","productId","locationId","variantId","onHand","reserved","reorderPoint","trackingEnabled","updatedAt") values ` +
            rev(rows)
                .map(
                    (r) =>
                        `('${r.id}','${profileId}','${product}','${location}','${r.id}_v',${r.onHand},0,${r.point},true,CURRENT_TIMESTAMP)`,
                )
                .join(","),
    )
    return { candidatesUrgent, candidatesLessUrgent, nonCandidatesLowerStock }
}

async function seedTieHeavy(tx: Tx, profileId: string, workspaceId: string, q: (s: string) => string): Promise<TieHeavy> {
    const mk = (sql: string) => tx.$executeRawUnsafe(sql)
    const group = (kind: string, from: number, count: number) =>
        Array.from({ length: count }, (_, i) => q(`${kind}_${String(from + i).padStart(3, "0")}`))
    /** Insert order is the REVERSE of the correct answer, so physical order cannot pass for sorted. */
    const rev = <T,>(xs: readonly T[]) => [...xs].reverse()

    // -- reservations: one startAt shared by 22 rows, plus 2 that are genuinely later ------------------
    const reservationsTied = group("res", 1, RES_TIED)
    const reservationsLater = group("res", 101, 2)
    // The reservation exclusion constraint forbids two active reservations overlapping on ONE table, and
    // these deliberately share a time window, so each gets its own table. That is fixture surface the
    // constraint forces, not a choice.
    const tables = group("tbl", 1, RES_TIED + reservationsLater.length)
    await mk(
        `insert into "RestaurantTable" ("id","profileId","label","code","updatedAt") values ` +
            rev(tables)
                .map((t) => `('${t}','${profileId}','${t}','${t}',CURRENT_TIMESTAMP)`)
                .join(","),
    )
    const reservationRows = [
        ...reservationsTied.map((id, i) => ({ id, tableId: tables[i], at: TIED_AT, end: TIED_END })),
        ...reservationsLater.map((id, i) => ({ id, tableId: tables[RES_TIED + i], at: LATER_AT, end: LATER_END })),
    ]
    await mk(
        `insert into "Reservation" ("id","profileId","tableId","partySize","startAt","endAt","status","guestName","updatedAt") values ` +
            rev(reservationRows)
                .map((r) => `('${r.id}','${profileId}','${r.tableId}',2,'${r.at}','${r.end}','REQUESTED','Tie',CURRENT_TIMESTAMP)`)
                .join(","),
    )

    // -- appointments: three bookings on one startTime ------------------------------------------------
    const offering = q("svc_001")
    await mk(
        `insert into "ServiceOffering" ("id","profileId","name","updatedAt") values ('${offering}','${profileId}','Tie',CURRENT_TIMESTAMP)`,
    )
    const appointmentsTied = group("apt", 1, SMALL_GROUP)
    // resourceId is left null so the appointment exclusion constraint does not apply; these must share a
    // startTime, and that constraint exists to stop two bookings sharing a RESOURCE at one time.
    await mk(
        `insert into "Booking" ("id","profileId","visitorName","visitorEmail","serviceOfferingId","startTime","endTime","status","updatedAt") values ` +
            rev(appointmentsTied)
                .map((id) => `('${id}','${profileId}','Tie','tie@example.test','${offering}','${TIED_AT}','${TIED_END}','CONFIRMED',CURRENT_TIMESTAMP)`)
                .join(","),
    )

    // -- field jobs: BOTH existing keys tie - no visit window, and one createdAt ----------------------
    const fieldJobsTied = group("fj", 1, SMALL_GROUP)
    await mk(
        `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","createdAt","updatedAt") values ` +
            rev(fieldJobsTied)
                .map((id) => `('${id}','${profileId}','${id}','Tie','SCHEDULED','NORMAL','1 Example Street','${TIED_AT}',CURRENT_TIMESTAMP)`)
                .join(","),
    )

    // -- inspections: three sharing one createdAt --------------------------------------------------
    // ONE PER JOB, because a partial unique index allows at most one OPEN inspection per job - a job may
    // be inspected repeatedly over its life, but not twice at once. So each tie-heavy inspection hangs off
    // its own tie-heavy job rather than three off one. The fixture obeys the domain rule; it does not
    // reshape the rule to make the fixture convenient.
    const inspectionsTied = group("insp", 1, SMALL_GROUP)
    await mk(
        `insert into "FieldJobInspection" ("id","jobId","profileId","reference","status","createdAt","updatedAt") values ` +
            rev(inspectionsTied.map((id, i) => ({ id, jobId: fieldJobsTied[i] })))
                .map((r) => `('${r.id}','${r.jobId}','${profileId}','${r.id}','IN_PROGRESS','${TIED_AT}',CURRENT_TIMESTAMP)`)
                .join(","),
    )

    // -- fulfilments and returns: one order, one createdAt each ---------------------------------------
    const order = q("ord_001")
    await mk(
        `insert into "Order" ("id","profileId","publicToken","number","businessDate","subtotalCents","totalCents","currency","updatedAt")
         values ('${order}','${profileId}','${order}',1,'2020-03-01',0,0,'USD',CURRENT_TIMESTAMP)`,
    )
    const fulfilmentsTied = group("ful", 1, SMALL_GROUP)
    await mk(
        `insert into "Fulfilment" ("id","profileId","orderId","reference","state","createdAt","updatedAt") values ` +
            rev(fulfilmentsTied)
                .map((id) => `('${id}','${profileId}','${order}','${id}','DRAFT','${TIED_AT}',CURRENT_TIMESTAMP)`)
                .join(","),
    )
    const returnsTied = group("ret", 1, SMALL_GROUP)
    await mk(
        `insert into "ReturnRequest" ("id","profileId","orderId","reference","state","createdAt","updatedAt") values ` +
            rev(returnsTied)
                .map((id) => `('${id}','${profileId}','${order}','${id}','REQUESTED','${TIED_AT}',CURRENT_TIMESTAMP)`)
                .join(","),
    )

    // -- case milestones: ordinal is unique only WITHIN a case, so three cases each hold ordinal 1 ----
    const cases = group("case", 1, SMALL_GROUP)
    await mk(
        `insert into "CaseProject" ("id","workspaceId","reference","title","updatedAt") values ` +
            rev(cases)
                .map((id) => `('${id}','${workspaceId}','${id}','Tie',CURRENT_TIMESTAMP)`)
                .join(","),
    )
    const milestonesTied = group("ms", 1, SMALL_GROUP)
    await mk(
        `insert into "CaseMilestone" ("id","caseId","title","ordinal","status","dueAt","updatedAt") values ` +
            rev(milestonesTied.map((id, i) => ({ id, caseId: cases[i] })))
                .map((r) => `('${r.id}','${r.caseId}','Tie',1,'PENDING','${TIED_AT}',CURRENT_TIMESTAMP)`)
                .join(","),
    )

    // -- inventory: a catalogue at onHand 0, plus rows that must be dropped and rows that must never
    //    appear at all. The last three groups are what tell a real column-to-column comparison from a
    //    filter that merely looks like one.
    const location = q("loc_001")
    await mk(
        `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${location}','${workspaceId}','${location}',CURRENT_TIMESTAMP)`,
    )
    const product = q("prod_001")
    await mk(
        `insert into "DigitalProduct" ("id","profileId","title","updatedAt") values ('${product}','${profileId}','Tie',CURRENT_TIMESTAMP)`,
    )
    const inventoryTied = group("inv", 1, INV_TIED)
    const inventoryHigher = group("inv", 101, 3)
    const inventoryAbovePoint = group("inv", 201, 2)
    const inventoryUntracked = group("inv", 301, 1)
    const inventoryNoPoint = group("inv", 401, 1)
    const inventoryRows = [
        ...inventoryTied.map((id) => ({ id, onHand: 0, point: "5", tracked: "true" })),
        ...inventoryHigher.map((id) => ({ id, onHand: 4, point: "5", tracked: "true" })),
        // Above its own reorder point: excluded by the comparison itself, not by any other clause.
        ...inventoryAbovePoint.map((id) => ({ id, onHand: 9, point: "5", tracked: "true" })),
        // Opted out of stock control while sitting at zero.
        ...inventoryUntracked.map((id) => ({ id, onHand: 0, point: "5", tracked: "false" })),
        // No reorder point at all while sitting at zero.
        ...inventoryNoPoint.map((id) => ({ id, onHand: 0, point: "null", tracked: "true" })),
    ]
    // (variantId, locationId) is unique, so one variant per item lets every item share one location.
    await mk(
        `insert into "ProductVariant" ("id","profileId","productId","title","updatedAt") values ` +
            rev(inventoryRows)
                .map((r) => `('${r.id}_v','${profileId}','${product}','Tie',CURRENT_TIMESTAMP)`)
                .join(","),
    )
    await mk(
        `insert into "InventoryItem" ("id","profileId","productId","locationId","variantId","onHand","reserved","reorderPoint","trackingEnabled","updatedAt") values ` +
            rev(inventoryRows)
                .map(
                    (r) =>
                        `('${r.id}','${profileId}','${product}','${location}','${r.id}_v',${r.onHand},0,${r.point},${r.tracked},CURRENT_TIMESTAMP)`,
                )
                .join(","),
    )

    return {
        reservationsTied,
        reservationsLater,
        appointmentsTied,
        fieldJobsTied,
        inspectionsTied,
        fulfilmentsTied,
        returnsTied,
        milestonesTied,
        inventoryTied,
        inventoryHigher,
        inventoryNotCandidates: [...inventoryAbovePoint, ...inventoryUntracked, ...inventoryNoPoint],
    }
}

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

    // The tie-heavy fixture is TENANT A ONLY, and that is load-bearing twice over. It keeps tenant B a
    // clean control for the isolation assertions - B's item list stays small enough to read - and it
    // leaves B with items in profile-scoped domains only, which is the counterexample the mixed-scope
    // assertions need.
    const tie = await seedTieHeavy(tx, q("pra"), q("wsa"), q)
    // Tenant B stays profile-scoped only - it is the mixed-scope counterexample - and carries the inventory
    // shape in which the reorder comparison decides the answer. See the note on InventoryProbe.
    const probeB = await seedInventoryProbe(tx, q("prb"), q("wsb"), q)

    return {
        wsA: q("wsa"),
        wsB: q("wsb"),
        userA: `clerk_${q("ua")}`,
        userB: `clerk_${q("ub")}`,
        profileA: q("pra"),
        profileB: q("prb"),
        jobA: q("joba"),
        jobB: q("jobb"),
        inspectionA: q("inspa"),
        inspectionB: q("inspb"),
        tie,
        probeB,
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

                // =============================================================================
                // THE OPERATIONS SURFACE'S METHOD BEHAVIOUR, MEASURED RATHER THAN ASSUMED.
                //
                // The export scan above says the route exports GET and neither HEAD nor OPTIONS. It is
                // tempting to read that as "this route answers only GET". It does not. next@16.3.3's
                // auto-implement-methods.js assigns `methods.HEAD = handlers.GET`, so a HEAD request is
                // served by invoking THIS handler with method "HEAD", and answers OPTIONS itself with 204
                // and `Allow: GET, HEAD, OPTIONS` without reaching a handler at all.
                //
                // WHAT THAT MEANS HERE, AND IT IS NOT THE SAME ANSWER AS FOR DUE-WORK. `OperationsApiService`
                // has NO method guard: `today` never looks at `request.method`. So:
                //
                //   HEAD     is answered exactly as GET, which is what RFC 9110 9.3.2 asks for. The
                //            response object it returns still carries content; over HTTP the transport
                //            suppresses a HEAD body, so an HTTP caller sees the correct thing. A direct
                //            caller of the service object does not, and that difference is real.
                //   OPTIONS  never reaches `today` over HTTP - the framework answers it. A DIRECT caller
                //            gets the summary instead of a method directory, because nothing here refuses.
                //   POST     is refused by the framework with its own bare 405. `today` itself does not
                //            refuse it: called directly with a POST Request it answers 200 with data. The
                //            surface's read-only guarantee therefore rests ENTIRELY on the route module's
                //            exports, which is precisely the weakness due-work-http.ts's own header
                //            describes and guards against with `requireAllowedMethod`.
                //
                // RECORDED, NOT FIXED. src/lib/operations/http.ts is outside this package's owned paths, so
                // adding the guard there is not this package's change to make. Asserting the measured truth
                // is: it declares the gap, and it goes red the day someone closes or widens it, instead of
                // this file continuing to imply a GET-only surface that the framework never delivered.
                // =============================================================================
                identity.current = ids.userA
                const opsApi = new OperationsApiService(service)
                const opsUrl = `http://ops.test/api/platform/operations?workspaceId=${ids.wsA}`
                const opsStatus = async (method: string) =>
                    (await opsApi.today(new Request(opsUrl, { method }))).status
                const opsGet = await opsStatus("GET")
                const opsHead = await opsStatus("HEAD")
                const opsOptions = await opsStatus("OPTIONS")
                const opsPost = await opsStatus("POST")
                checkInvertible(
                    "MEASURED: HEAD on the operations surface is answered exactly as GET - the framework routes it to this handler and nothing here refuses it, which is what RFC 9110 9.3.2 requires",
                    opsGet === 200 && opsHead === 200,
                    `GET=${opsGet} HEAD=${opsHead}`,
                )
                checkInvertible(
                    "MEASURED AND DECLARED AS A GAP: `today` has no method guard at all, so called DIRECTLY it answers OPTIONS and even POST with 200 and data. Over HTTP the framework refuses POST and answers OPTIONS itself, so nothing is exposed today - but this surface's read-only guarantee rests only on the route module's exports. src/lib/operations/http.ts is outside this package's owned paths; recorded, not fixed",
                    opsOptions === 200 && opsPost === 200,
                    `direct OPTIONS=${opsOptions} direct POST=${opsPost} (framework: OPTIONS=204 with Allow, POST=405 with no Allow)`,
                )
                identity.current = ids.userB

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
                // The mixed-boundary fact must be reported for what it is, and what it is is a
                // measurement of the response. See the three assertions below.
                const boundariesWithItems = (s: OperationsSummary) =>
                    [...new Set(s.items.map((i) => OPERATIONS_DOMAIN_SCOPE[i.domain]))].sort().join(",")
                const declaredBoundaries = [...new Set(Object.values(OPERATIONS_DOMAIN_SCOPE))].sort()
                const aBoundaries = boundariesWithItems(a)
                const bBoundaries = boundariesWithItems(b)
                /**
                 * WHAT THIS USED TO ASSERT, IN TWO STAGES, AND WHY BOTH ARE NOW OBSOLETE.
                 *
                 * STAGE ONE was `a.mixedScope === true && a.domains.some(workspace) && a.domains.some(profile)`,
                 * named "the response reports that its total spans more than one tenant boundary". Every
                 * clause was constant: `mixedScope` was `scopes.size > 1` over the FROZEN
                 * OPERATIONS_DOMAIN_SCOPE map, and `a.domains` lists all nine declared domains with their
                 * declared scope whether or not any returned a row. It restated the response's own constants
                 * back to itself and could not have failed for any data.
                 *
                 * STAGE TWO replaced it with a MEASUREMENT, a COUNTEREXAMPLE - tenant B's rows span exactly
                 * one boundary while `mixedScope` still reported true - and a pin on `a.mixedScope ===
                 * (declaredBoundaries.length > 1)`. Those were right about the code as it stood: the field
                 * genuinely could not describe a dataset, and the counterexample documented it.
                 *
                 * THE DEFECT THEY DOCUMENTED IS FIXED. `deriveMixedScope` in engine.ts now reads the domains
                 * that actually returned something, so the field measures the response. A counterexample to a
                 * defect that no longer exists would either fail or, worse, pass and re-freeze the defect, so
                 * it is REPLACED - not deleted - by the positive assertion its own comment said could not be
                 * made: single-boundary data yields false, genuinely mixed data yields true, on two tenants
                 * of the same fixture. The measurement leg is kept unchanged, and the declared-coverage
                 * conjunction the stage-one form checked is kept too, now asserted as what it always was - a
                 * fact about `domains[].scope` - instead of being tied to `mixedScope`.
                 *
                 * Both legs are recomputed here from the returned items and the frozen map rather than read
                 * off the response, so the response cannot satisfy them by agreeing with itself.
                 */
                checkInvertible(
                    "MEASURED: tenant A's returned items really do span two tenant boundaries - derived from the items returned and each domain's boundary, not read off the response",
                    aBoundaries === "profile,workspace" &&
                        a.items.some((i) => ids.tie.milestonesTied.includes(i.id)) &&
                        a.items.some((i) => i.id === ids.jobA),
                    `A items span [${aBoundaries}]: workspace via caseMilestones, profile via fieldJobs`,
                )
                checkInvertible(
                    "SINGLE BOUNDARY YIELDS FALSE: tenant B's rows span exactly ONE boundary and mixedScope reports false for it - the assertion the old counterexample proved could not be made",
                    bBoundaries === "profile" && b.mixedScope === false,
                    `B items span [${bBoundaries}] and mixedScope=${String(b.mixedScope)} - measured from the domains that returned rows, not from the coverage list`,
                )
                checkInvertible(
                    "MEASURED BOTH WAYS: mixedScope equals whether the returned items span more than one boundary, for the mixed tenant AND the single-boundary tenant, recomputed here from the items and the frozen scope map",
                    a.mixedScope === (aBoundaries.split(",").length > 1) &&
                        b.mixedScope === (bBoundaries.split(",").length > 1) &&
                        a.mixedScope === true &&
                        b.mixedScope === false,
                    `A spans [${aBoundaries}] -> mixedScope=${String(a.mixedScope)}; B spans [${bBoundaries}] -> mixedScope=${String(b.mixedScope)}; two tenants of one fixture disagree, so the field is not a constant`,
                )
                checkInvertible(
                    "the DECLARED coverage still reports both boundaries per domain, which is where that fact belongs now that mixedScope no longer carries it",
                    declaredBoundaries.length > 1 &&
                        a.domains.some((d) => d.scope === "workspace") &&
                        a.domains.some((d) => d.scope === "profile") &&
                        b.domains.some((d) => d.scope === "workspace") &&
                        b.domains.some((d) => d.scope === "profile"),
                    `frozen map boundaries=[${declaredBoundaries.join(",")}] declared per domain on both tenants, including tenant B whose rows span only [${bBoundaries}]`,
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

                // ---- determinism, on a fixture built so that a partial order cannot pass -----------
                const idsIn = (s: OperationsSummary, domain: OperationsDomain) =>
                    s.items.filter((i) => i.domain === domain).map((i) => i.id)
                const short = (xs: readonly string[]) => xs.map((x) => x.replace(`${RUN}_`, "")).join(",")
                const sorted = (xs: readonly string[]) => [...xs].sort(byId)
                /**
                 * Each expectation is the ONE sequence a total order permits, computed here from the
                 * fixture rather than compared against a previous response. Two identical requests agreeing
                 * would be much weaker evidence: an undefined order is free to be stable, so agreement can
                 * be luck, while equality with the independently computed answer cannot.
                 */
                const expectOrder = (domain: OperationsDomain, expected: readonly string[], why: string) => {
                    const got = idsIn(a, domain)
                    checkInvertible(
                        `${domain} come back in the one order a total ordering permits, on rows that tie on ${why}`,
                        got.join(",") === expected.join(","),
                        got.join(",") === expected.join(",") ? `${got.length} ids, exactly as ordered` : `expected [${short(expected)}] got [${short(got)}]`,
                    )
                }
                expectOrder("reservations", sorted(ids.tie.reservationsTied).slice(0, CAP), "one startAt")
                expectOrder("appointments", sorted(ids.tie.appointmentsTied), "one startTime")
                // The tie-heavy jobs were created before the isolation fixture's own job, so createdAt still
                // leads and the tie-break only settles the three that share it. If id had been placed ahead
                // of createdAt this expectation would fail, which is the point of asserting the whole
                // sequence rather than just the tied block.
                expectOrder("fieldJobs", [...sorted(ids.tie.fieldJobsTied), ids.jobA], "a null scheduledStartAt AND one createdAt")
                expectOrder("inspections", [...sorted(ids.tie.inspectionsTied), ids.inspectionA], "one createdAt")
                expectOrder("fulfilments", sorted(ids.tie.fulfilmentsTied), "one createdAt")
                expectOrder("returns", sorted(ids.tie.returnsTied), "one createdAt")
                expectOrder("caseMilestones", sorted(ids.tie.milestonesTied), "one dueAt AND one ordinal")
                expectOrder("inventory", sorted(ids.tie.inventoryTied).slice(0, CAP), "onHand 0")

                /**
                 * THE CAP MUST DROP THE LEAST IMPORTANT ROWS. Both groups below hold more urgent work than
                 * the cap admits, so the rows that fall outside it are the test: if a later reservation or a
                 * better-stocked item appeared while urgent work was cut, the bound would be actively
                 * harmful rather than merely cheaper.
                 */
                const reservationIds = idsIn(a, "reservations")
                checkInvertible(
                    "the reservation cap drops LATER work, never earlier work - 22 rows share the earliest startAt and the cap is full of them",
                    reservationIds.length === CAP && ids.tie.reservationsLater.every((id) => !reservationIds.includes(id)),
                    `returned ${reservationIds.length} of ${RES_TIED + ids.tie.reservationsLater.length} candidates; the ${ids.tie.reservationsLater.length} later-dated rows are absent`,
                )
                const inventoryIds = idsIn(a, "inventory")
                checkInvertible(
                    "the inventory cap drops the BEST-STOCKED candidates first; with 24 rows tied at onHand 0 and a cap of 20 the cut falls INSIDE that level, so four stockouts are dropped and the label must not claim otherwise",
                    inventoryIds.length === CAP && ids.tie.inventoryHigher.every((id) => !inventoryIds.includes(id)),
                    `returned ${inventoryIds.length}; the ${ids.tie.inventoryHigher.length} rows at onHand 4 are absent while stockouts fill the cap`,
                )
                checkInvertible(
                    "no row above its own reorder point, opted out of stock control, or without a reorder point is ever reported - the comparison is a real column-to-column one",
                    ids.tie.inventoryNotCandidates.every((id) => !inventoryIds.includes(id)),
                    `${ids.tie.inventoryNotCandidates.length} non-candidates, none reported`,
                )
                /**
                 * THE BOUND IS EQUIVALENT, NOT MERELY CHEAPER.
                 *
                 * The reorder comparison moved out of TypeScript and into SQL so that `take` could be
                 * applied in the database. A bare `take` would have been a regression: the twenty
                 * lowest-stock rows are not the twenty lowest-stock rows that are ALSO at or below their own
                 * reorder point. So the OLD computation is performed here from scratch - every tracked row
                 * with a reorder point, filtered and sorted and cut in TypeScript, with no ORDER BY asked of
                 * the database at all - and the engine's answer must equal it exactly.
                 */
                const everyTrackedRow = await tx.inventoryItem.findMany({
                    where: { profileId: ids.profileA, trackingEnabled: true, reorderPoint: { not: null } },
                    select: { id: true, onHand: true, reorderPoint: true },
                })
                const oldWayCandidates = everyTrackedRow
                    .filter((row) => row.reorderPoint !== null && row.onHand <= row.reorderPoint)
                    .sort((x, y) => x.onHand - y.onHand || byId(x.id, y.id))
                const oldWay = oldWayCandidates.slice(0, CAP).map((row) => row.id)
                checkInvertible(
                    "the database-bounded inventory read returns EXACTLY what the whole-table scan and TypeScript filter returned, so nothing that needs reordering was lost to the bound",
                    inventoryIds.join(",") === oldWay.join(","),
                    inventoryIds.join(",") === oldWay.join(",")
                        ? `${oldWayCandidates.length} candidates over ${everyTrackedRow.length} tracked rows, same first ${oldWay.length}`
                        : `expected [${short(oldWay)}] got [${short(inventoryIds)}]`,
                )
                const kept = new Set(inventoryIds)
                const droppedOnHand = oldWayCandidates.filter((row) => !kept.has(row.id)).map((row) => row.onHand)
                const keptOnHand = oldWayCandidates.filter((row) => kept.has(row.id)).map((row) => row.onHand)
                checkInvertible(
                    "every candidate the cap dropped is at least as well stocked as every candidate it kept, so the bound cannot hide more urgent work behind less urgent work",
                    droppedOnHand.length > 0 && keptOnHand.length > 0 && Math.max(...keptOnHand) <= Math.min(...droppedOnHand),
                    `kept onHand max=${keptOnHand.length > 0 ? Math.max(...keptOnHand) : "n/a"} dropped onHand min=${droppedOnHand.length > 0 ? Math.min(...droppedOnHand) : "n/a"}`,
                )

                /**
                 * THE COMPARISON, OBSERVED RATHER THAN READ. Tenant B's shape is built so that ordering by
                 * stock alone gives a different ANSWER from comparing each row against its own reorder point:
                 * four rows hold LESS stock than a genuine candidate and are still not candidates, because
                 * they are above their own reorder point. A `take` bolted onto a query that had lost the
                 * comparison would return them. On tenant A it could not: 24 stockouts fill the cap there, so
                 * that regression is invisible on A's data and is why this second shape exists.
                 */
                const bInventory = idsIn(b, "inventory")
                checkInvertible(
                    "a row holding LESS stock than a reported candidate is still excluded when it sits above its OWN reorder point, so the bound compares two columns and not one column against the cap",
                    ids.probeB.nonCandidatesLowerStock.every((id) => !bInventory.includes(id)) &&
                        ids.probeB.candidatesUrgent.every((id) => bInventory.includes(id)) &&
                        ids.probeB.candidatesLessUrgent.every((id) => bInventory.includes(id)),
                    `${ids.probeB.nonCandidatesLowerStock.length} lower-stock non-candidates excluded; all ${ids.probeB.candidatesUrgent.length + ids.probeB.candidatesLessUrgent.length} real candidates reported`,
                )
                checkInvertible(
                    "tenant B's inventory is ordered by absolute stock with the id tie-break, urgent before less urgent, and the non-candidates that would have sorted between them are absent",
                    bInventory.join(",") ===
                        [...sorted(ids.probeB.candidatesUrgent), ...sorted(ids.probeB.candidatesLessUrgent)].join(","),
                    bInventory.join(",") === [...sorted(ids.probeB.candidatesUrgent), ...sorted(ids.probeB.candidatesLessUrgent)].join(",")
                        ? `${bInventory.length} ids, exactly as ordered`
                        : `expected [${short([...sorted(ids.probeB.candidatesUrgent), ...sorted(ids.probeB.candidatesLessUrgent)])}] got [${short(bInventory)}]`,
                )
                const bTrackedRows = await tx.inventoryItem.findMany({
                    where: { profileId: ids.profileB, trackingEnabled: true, reorderPoint: { not: null } },
                    select: { id: true, onHand: true, reorderPoint: true },
                })
                const bOldWay = bTrackedRows
                    .filter((row) => row.reorderPoint !== null && row.onHand <= row.reorderPoint)
                    .sort((x, y) => x.onHand - y.onHand || byId(x.id, y.id))
                    .slice(0, CAP)
                    .map((row) => row.id)
                checkInvertible(
                    "on the shape where the comparison decides the answer, the bounded read still equals the whole-table scan and TypeScript filter exactly",
                    bInventory.join(",") === bOldWay.join(","),
                    bInventory.join(",") === bOldWay.join(",")
                        ? `${bOldWay.length} candidates of ${bTrackedRows.length} tracked rows, identical`
                        : `expected [${short(bOldWay)}] got [${short(bInventory)}]`,
                )

                // Repeated identical requests. Weaker evidence than the expectations above and kept for what
                // it does add: it exercises the whole response rather than one domain at a time, and it is
                // the shape of the complaint an owner would actually make - the same screen, twice, different.
                identity.current = ids.userA
                const sequence = (s: OperationsSummary) => s.items.map((i) => `${i.domain}:${i.id}`).join("|")
                const again = await service.summary(ids.wsA)
                const onceMore = await service.summary(ids.wsA)
                checkInvertible(
                    "three identical requests over the tie-heavy fixture return the identical ordered id sequence, across every domain at once",
                    a.items.length > 0 && sequence(a) === sequence(again) && sequence(again) === sequence(onceMore),
                    `${a.items.length} items; ${sequence(a) === sequence(again) && sequence(again) === sequence(onceMore) ? "identical across 3 calls" : "DIVERGED"}`,
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

        /**
         * ZERO RESIDUE, PROVEN BY QUERY PER TABLE AND SCOPED TO THIS RUN.
         *
         * The count above is global, which makes it both weaker and more fragile than it looks: it says
         * nothing about the eighteen other tables this fixture now touches, and it can be moved by any other
         * process writing to the same database while this runs. Every id this harness inserts is prefixed
         * with the run token, so the same question can be asked exactly - are any of MY rows still here -
         * and answered per table, without a cascade being taken on trust and without another stage's
         * concurrent work being able to change the answer.
         *
         * The three append-only ledgers are included and are asked about through their parent id, because
         * their own ids are generated and would not carry the prefix. Nothing here inserts a ledger row; the
         * assertion states that rather than assuming it.
         */
        const scoped = { id: { startsWith: RUN } }
        const parent = (field: string) => ({ [field]: { startsWith: RUN } })
        const residueProbes: ReadonlyArray<readonly [string, () => Promise<number>]> = [
            ["User", () => prisma.user.count({ where: scoped })],
            ["Profile", () => prisma.profile.count({ where: scoped })],
            ["Workspace", () => prisma.workspace.count({ where: scoped })],
            ["Membership", () => prisma.membership.count({ where: scoped })],
            ["FieldJob", () => prisma.fieldJob.count({ where: scoped })],
            ["FieldJobInspection", () => prisma.fieldJobInspection.count({ where: scoped })],
            ["RestaurantTable", () => prisma.restaurantTable.count({ where: scoped })],
            ["Reservation", () => prisma.reservation.count({ where: scoped })],
            ["ServiceOffering", () => prisma.serviceOffering.count({ where: scoped })],
            ["Booking", () => prisma.booking.count({ where: scoped })],
            ["Order", () => prisma.order.count({ where: scoped })],
            ["Fulfilment", () => prisma.fulfilment.count({ where: scoped })],
            ["ReturnRequest", () => prisma.returnRequest.count({ where: scoped })],
            ["Location", () => prisma.location.count({ where: scoped })],
            ["DigitalProduct", () => prisma.digitalProduct.count({ where: scoped })],
            ["ProductVariant", () => prisma.productVariant.count({ where: scoped })],
            ["InventoryItem", () => prisma.inventoryItem.count({ where: scoped })],
            ["CaseProject", () => prisma.caseProject.count({ where: scoped })],
            ["CaseMilestone", () => prisma.caseMilestone.count({ where: scoped })],
            ["ReservationEvent", () => prisma.reservationEvent.count({ where: parent("reservationId") })],
            ["AppointmentEvent", () => prisma.appointmentEvent.count({ where: parent("bookingId") })],
            ["InventoryMovement", () => prisma.inventoryMovement.count({ where: parent("itemId") })],
        ]
        const leftBehind: string[] = []
        for (const [table, count] of residueProbes) {
            const rows = await count()
            if (rows !== 0) leftBehind.push(`${table}=${rows}`)
        }
        checkInvertible(
            "not one fixture row survives the rollback, asked table by table for this run's own ids rather than inferred from a cascade",
            leftBehind.length === 0,
            leftBehind.length === 0 ? `${residueProbes.length} tables, all zero for this run` : `RESIDUE: ${leftBehind.join(" ")}`,
        )
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
