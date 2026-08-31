/**
 * Blueprint preview: resolver and HTTP boundary.
 *
 * The claim this defends is narrow and load-bearing: **preview resolves, and does not install.** There
 * is no installation runtime in this repository, so every response must say so, and the code must be
 * incapable of writing rather than merely uninterested in it.
 *
 * Structural assertions, no database needed:
 *
 *   READ-ONLY BY CONSTRUCTION. The resolver contains no Prisma import, no create/update/delete/upsert,
 *   no raw SQL, no transaction and no fetch - asserted over EXECUTABLE lines only, because the comments
 *   discuss writes in order to say there are none and a whole-file scan would flag the explanation as the
 *   violation.
 *
 *   NO FABRICATED PRESENTATION. BusinessBlueprint declares no terminology, surfaces or modules; that is
 *   asserted against the type itself, so if a future blueprint gains a `terminology` field this check
 *   goes red and somebody has to decide whether preview should now read it instead of deriving it.
 *
 *   EVERY presentation value is tagged role-derived, and `installed` is null on every blueprint.
 *
 * Behavioural assertions against the disposable database, in a rolled-back transaction, because the
 * BOUNDARY needs real tenancy: 401, 403 for a foreign workspace, 404 for an unknown blueprint id, 400
 * for a missing workspaceId, the shared envelope per status, and a 503 whose body leaks no DSN.
 *
 * WHY 404 IS CORRECT HERE and 403 is correct everywhere else is asserted explicitly, because it is the
 * one place this platform deliberately breaks its own non-enumeration rule: a blueprint id is a public
 * static registry key, identical for every tenant. The assertion pins the reasoning so a future reader
 * does not "fix" it into a 403.
 *
 * INVERSION IS BY SOURCE MUTATION, not by an env flag: a flag that flips the expectation only proves
 * the flag works. Each load-bearing rule here was proven to fail by actually breaking the resolver -
 * making an unknown id fall back to `all[0]` turns the fabrication and 404 assertions red, and deleting
 * the `required` guard in resolveBlockers turns the synthetic optional-capability assertion red.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-blueprint-preview.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { listBusinessBlueprints } from "../../src/lib/business-os/blueprints"
import { businessEngineDescriptors } from "../../src/lib/business-os/engines"
import { BlueprintPreviewService, resolveBlockers } from "../../src/lib/business-os/preview"
import { BlueprintPreviewApiService } from "../../src/lib/business-os/preview-http"
import { PreviewContext } from "../../src/lib/business-os/preview-shared"
import type { BusinessBlueprint } from "../../src/lib/business-os/types"
import { CORRESPONDING_BLUEPRINT } from "../../src/lib/onboarding-needs"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"

import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"
import { classifyRouteModule, describeMethods, exportsMethod, exportsNoStateChangingMethod } from "../lib/http-method-classifier"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `bpp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "../..")
const BASE = "http://preview.test/api/platform/blueprints"

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
    return (called.body.error as { code?: string } | undefined)?.code ?? ""
}
function refusal(called: Called): string {
    return JSON.stringify(called.body)
}

// ---------------------------------------------------------------------------
// 1. Structural: the resolver cannot write
// ---------------------------------------------------------------------------
const resolverSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/preview.ts"), "utf8")
const httpSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/preview-http.ts"), "utf8")
const sharedSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/preview-shared.ts"), "utf8")
const runtimeSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/preview-runtime.ts"), "utf8")
const typesSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/preview-types.ts"), "utf8")
const listRoutePath = join(APP_ROOT, "src/app/api/platform/blueprints/route.ts")
const previewRoutePath = join(APP_ROOT, "src/app/api/platform/blueprints/[blueprintId]/preview/route.ts")
const listRouteSrc = readFileSync(listRoutePath, "utf8")
const previewRouteSrc = readFileSync(previewRoutePath, "utf8")
const listRouteMethods = classifyRouteModule(listRoutePath, listRouteSrc)
const previewRouteMethods = classifyRouteModule(previewRoutePath, previewRouteSrc)

function executableOnly(source: string): string {
    return source
        .split("\n")
        .filter((line) => {
            const t = line.trim()
            return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
        })
        .join("\n")
}
const resolverCode = executableOnly(resolverSrc)

const WRITE_FORMS = [".create(", ".createMany(", ".update(", ".updateMany(", ".delete(", ".deleteMany(", ".upsert("]
const foundWrites = WRITE_FORMS.filter((needle) => resolverCode.includes(needle))
checkInvertible(
    "the preview resolver contains no create, update, delete or upsert call",
    foundWrites.length === 0,
    foundWrites.join(", ") || `checked ${WRITE_FORMS.length} forms`,
)
checkInvertible(
    "the preview resolver does not import Prisma at all, so it cannot reach a database",
    !/from "@prisma\/client"/.test(resolverCode) && !/\bprisma\b/.test(resolverCode),
    "no @prisma/client import, no prisma identifier",
)
checkInvertible(
    "the preview resolver has no raw SQL, no transaction and no fetch",
    !/\$executeRaw|\$queryRaw|\$transaction|fetch\(/.test(resolverCode),
    "none present",
)
/**
 * MIGRATED TO THE CANONICAL CLASSIFIER. This was the narrower of the two sites in this file and it was
 * the strictest of the seven: `/export async function GET\(/` plus
 * `!/export async function (POST|PATCH|PUT|DELETE)\(/`, which requires the paren immediately after the
 * verb and so cannot see `export function GET`, `export const GET`, a multiline parameter list, or an
 * aliased re-export. Measured over this repo's 154 api route files that narrow GET pattern is blind to 28
 * GET-exporting files and the narrow write pattern to 21 files that really do export a state-changing verb.
 *
 * Both of these routes happen to use `export async function`, so the old pattern was right about them by
 * luck. The verdict is unchanged - asserted file by file in check-http-method-classifier.ts - and it is now
 * right by construction.
 */
check(
    "both preview routes export GET and no state-changing verb, in ANY declaration style",
    exportsMethod(listRouteMethods, "GET") &&
        exportsMethod(previewRouteMethods, "GET") &&
        exportsNoStateChangingMethod(listRouteMethods) &&
        exportsNoStateChangingMethod(previewRouteMethods),
    `list=[${describeMethods(listRouteMethods)}] preview=[${describeMethods(previewRouteMethods)}]`,
)
check(
    "the preview context asks only for profile.read, so no write permission path exists",
    /"profile\.read"/.test(sharedSrc) && !/profile\.update/.test(executableOnly(sharedSrc)),
)
// There are now TWO blueprint listing surfaces, and that is deliberate rather than duplication:
// /api/business-os/blueprints sits behind requireBusinessOsAccess (the owner-console surface, which is
// opt-in per profile and asserted below to never be granted by a blueprint choice), while
// /api/platform/blueprints needs only workspace membership. Onboarding happens BEFORE anyone opts into
// the owner console, so merging the two would either lock preview out of onboarding or quietly widen
// what the businessOs surface implies. Pinned here so a future de-duplication has to argue with it.
const businessOsListPath = join(APP_ROOT, "src/app/api/business-os/blueprints/route.ts")
const businessOsListSrc = readFileSync(businessOsListPath, "utf8")
const businessOsListMethods = classifyRouteModule(businessOsListPath, businessOsListSrc)
// `platformListSrc` was a SECOND read of the same file `listRouteSrc` already holds, and the second site
// below re-tested it with a different pattern than the site above used. That is exactly the drift this
// wave removes, so the duplicate read is gone and both sites now consult one classification of one file.
const platformListSrc = listRouteSrc
checkInvertible(
    "MEASURED: the two blueprint listing surfaces authorize differently, so neither is a duplicate of the other",
    /requireBusinessOsAccess/.test(businessOsListSrc) && !/requireBusinessOsAccess/.test(platformListSrc),
    "business-os route requires the businessOs surface; platform route requires only workspace membership",
)
check(
    "both blueprint listing surfaces are GET-only, so neither is an install path",
    exportsNoStateChangingMethod(businessOsListMethods) && exportsNoStateChangingMethod(listRouteMethods),
    `business-os=[${describeMethods(businessOsListMethods)}] platform=[${describeMethods(listRouteMethods)}]`,
)
const PROVIDER_FORMS = ["nodemailer", "resend", "stripe", "twilio", "setInterval", "setTimeout", "cron", "enqueue"]
const allPreviewCode = `${resolverCode}\n${httpSrc}\n${sharedSrc}\n${runtimeSrc}\n${listRouteSrc}\n${previewRouteSrc}`
const foundProviders = PROVIDER_FORMS.filter((n) => allPreviewCode.toLowerCase().includes(n.toLowerCase()))
checkInvertible(
    "the preview domain contains no scheduler, queue, mailer or payment client",
    foundProviders.length === 0,
    foundProviders.join(", ") || `checked ${PROVIDER_FORMS.length} forms`,
)

// ---------------------------------------------------------------------------
// 2. Structural: nothing is fabricated
// ---------------------------------------------------------------------------
// If BusinessBlueprint ever gains one of these, this goes red and somebody must decide whether preview
// should read it instead of deriving it from the role. That decision should not happen silently.
const blueprintTypeSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/types.ts"), "utf8")
const blueprintTypeBlock = /export type BusinessBlueprint = \{[\s\S]*?\n\}/.exec(blueprintTypeSrc)?.[0] ?? ""
checkInvertible(
    "MEASURED: BusinessBlueprint still declares no terminology, surfaces or modules, so deriving them is still correct",
    blueprintTypeBlock.length > 0 &&
        !/terminology/i.test(blueprintTypeBlock) &&
        !/surfaces/i.test(blueprintTypeBlock) &&
        !/modules/i.test(blueprintTypeBlock),
    blueprintTypeBlock.length > 0 ? "none of the three present" : "TYPE BLOCK NOT FOUND",
)
check(
    "the contract types `installed` as null rather than as an optional object",
    /installed: null/.test(typesSrc),
)
check(
    "the contract requires a limitations list, so a caller cannot render a preview without the caveats",
    /limitations: readonly string\[\]/.test(typesSrc),
)

// ---------------------------------------------------------------------------
// 3. Resolver behaviour, over the real registry
// ---------------------------------------------------------------------------
const service = new BlueprintPreviewService()
const all = listBusinessBlueprints()
const summaries = service.list()

check("list returns every registered blueprint", summaries.length === all.length, `${summaries.length}/${all.length}`)
check(
    "deprecated blueprints are listed and labelled rather than hidden",
    summaries.some((s) => s.status === "deprecated"),
    `${summaries.filter((s) => s.status === "deprecated").length} deprecated`,
)
// MEASURED registry size, pinned as a literal here AND repeated inside each `all.every(...)` condition
// below. The repetition is deliberate rather than clumsy: a guard held by a NEIGHBOURING assertion
// still leaves each of those rules individually green over an empty registry, because `[].every(...)`
// is true. Without the pin, a listBusinessBlueprints() that returned nothing - a registry that failed
// to build, a filter that matched nothing - would leave all four "every previewed blueprint ..." rules
// green having previewed nothing at all, and `summaries.length === all.length` would agree at 0 === 0.
// The second payoff: adding a blueprint cannot silently inherit these guarantees. It fails HERE first,
// and the fix is to preview the new blueprint, confirm it reports installed: null, carries the
// limitations and derives its presentation from the role, and only then raise this number.
check(
    "MEASURED: the registry holds exactly the 13 blueprints the rules below were written against",
    all.length === 13 && summaries.length === 13,
    `registry=${all.length} listed=${summaries.length} expected=13`,
)
checkInvertible(
    "every previewed blueprint reports installed: null",
    all.length === 13 && all.every((b) => service.preview(b.id)?.installed === null),
    `checked ${all.length}`,
)
checkInvertible(
    "every previewed blueprint explains that registry preview does not read workspace installation state",
    all.length === 13 && all.every((b) => {
        const p = service.preview(b.id)
        return (
            p !== null &&
            p.limitations.length > 0 &&
            p.limitations.some((l) => /does not read a workspace's installed-blueprint record/.test(l))
        )
    }),
    `checked ${all.length}`,
)
checkInvertible(
    "every presentation block is tagged role-derived, so it cannot be read as blueprint-declared",
    all.length === 13 && all.every((b) => service.preview(b.id)?.presentation.source === "role-derived"),
    `${all.length} role-derived`,
)
checkInvertible(
    "MEASURED: the owner console surface is never granted by a blueprint choice",
    all.length === 13 && all.every((b) => {
        const p = service.preview(b.id)
        return p !== null && p.presentation.businessOsRequiresOptIn === true && !p.presentation.surfaces.includes("businessOs")
    }),
    `businessOs opt-in on ${all.length} blueprint(s)`,
)
check("an unknown blueprint id resolves to null rather than a fabricated preview", service.preview("nonsense-v9") === null)
check("a blank blueprint id resolves to null", service.preview("   ") === null)

// installable is recomputed, not copied from status. Prove the two are computed independently by
// checking a blueprint whose required capabilities are all available really does come back installable.
const fieldService = service.preview("field-service-v1")
checkInvertible(
    "field-service-v1 is installable, and its blockers list is empty",
    fieldService !== null && fieldService.installable && fieldService.blockedBy.length === 0,
    fieldService ? `installable=${fieldService.installable} blockers=${fieldService.blockedBy.length}` : "MISSING",
)
// Every capability the registry marks unavailable must appear as a blocker when required, and never
// when optional. This CANNOT be proven through the live registry: the only optional composition in the
// repository is commerce:[catalog,orders], and both are "available", so deleting the `required` guard
// entirely still leaves every real blueprint with an empty blocker list. Driving it through the
// registry therefore asserts "nothing optional is unavailable" while appearing to assert "optional is
// excluded". So the rule is exercised with a SYNTHETIC composition over the REAL engine registry.
// appointments:reminders is genuinely "partial" - persisted and scheduled, but no messaging provider is
// wired - so it is an honest lever rather than a fabricated maturity.
const syntheticBase = {
    id: "synthetic-probe-v1",
    version: "1.0.0",
    status: "draft" as const,
    name: "Synthetic probe",
    vertical: "synthetic",
    summary: "Exists only inside this harness, to make the required/optional discriminator observable.",
    workflows: [],
    ownerCopilotPrompts: [],
}
const partialCapability = businessEngineDescriptors.appointments.capabilities.find((c) => c.id === "reminders")
checkInvertible(
    "MEASURED: appointments:reminders is still partial in the live registry, so the synthetic probe below is honest",
    partialCapability !== undefined && partialCapability.maturity !== "available",
    partialCapability ? `maturity=${partialCapability.maturity}` : "MISSING",
)
const requiredBlockers = resolveBlockers({
    ...syntheticBase,
    engines: [{ engineId: "appointments", capabilities: ["reminders"], required: true }],
} as BusinessBlueprint)
checkInvertible(
    "an unavailable capability DOES block when the blueprint requires it, so blocker detection is real",
    requiredBlockers.length === 1 && requiredBlockers[0].includes("appointments:reminders is partial"),
    `blockers=[${requiredBlockers.join(" | ")}]`,
)
const optionalBlockers = resolveBlockers({
    ...syntheticBase,
    engines: [{ engineId: "appointments", capabilities: ["reminders"], required: false }],
} as BusinessBlueprint)
checkInvertible(
    "the SAME unavailable capability never blocks when composed optionally, so `required` is the discriminator",
    optionalBlockers.length === 0,
    `blockers=[${optionalBlockers.join(" | ")}] (same capability, required:false)`,
)
// And the live registry must still agree: no real blueprint reports an optional capability as a blocker.
const optionalNotBlocking = all.every((b) => {
    const p = service.preview(b.id)
    if (p === null) return false
    const optionalIds = b.engines.filter((e) => !e.required).flatMap((e) => e.capabilities)
    return optionalIds.every((id) => !p.blockedBy.some((blocker) => blocker.includes(`:${id} `)))
})
check(
    "no registered blueprint reports an optional capability as a blocker",
    optionalNotBlocking,
    "optional capabilities excluded from blockers",
)
// Supersession, using the real chain: restaurant-venue-v3 supersedes v2 supersedes v1.
const v2 = service.preview("restaurant-venue-v2")
checkInvertible(
    "MEASURED: a superseded blueprint reports what replaces it, so choosing the old one is visible",
    v2 !== null && v2.versioning.isSuperseded && v2.versioning.supersededBy.includes("restaurant-venue-v3"),
    v2 ? `supersededBy=[${v2.versioning.supersededBy.join(",")}]` : "MISSING",
)
const v3 = service.preview("restaurant-venue-v3")
check(
    "the newest blueprint in a chain reports what it replaces and is not itself superseded",
    v3 !== null && v3.versioning.supersedes === "restaurant-venue-v2" && !v3.versioning.isSuperseded,
    v3 ? `supersedes=${String(v3.versioning.supersedes)} isSuperseded=${v3.versioning.isSuperseded}` : "MISSING",
)
// Approvals are the one place a workflow stops for a person, so they must survive resolution.
const approvals = fieldService?.workflows.flatMap((w) => w.approvals) ?? []
checkInvertible(
    "workflow approval requirements survive resolution, with the reason the approver is shown",
    approvals.length > 0 && approvals.every((a) => a.approverRole.length > 0 && a.reason.length > 20),
    `${approvals.length} approval(s)`,
)
// Capability maturity must come from the live registry, not from a copy.
const inspection = fieldService?.engines
    .find((e) => e.engineId === "fieldJobs")
    ?.capabilities.find((c) => c.id === "inspection")
const liveInspection = businessEngineDescriptors.fieldJobs.capabilities.find((c) => c.id === "inspection")
checkInvertible(
    "capability maturity and evidence are read from the live engine registry",
    inspection !== undefined &&
        liveInspection !== undefined &&
        inspection.maturity === liveInspection.maturity &&
        inspection.evidence === liveInspection.evidence,
    inspection ? `${inspection.maturity} / ${inspection.evidence}` : "MISSING",
)
// Presentation resolves through the onboarding correspondence, so it must agree with that map.
const mappedRole = Object.entries(CORRESPONDING_BLUEPRINT).find(([, id]) => id === "field-service-v1")?.[0]
check(
    "presentation resolves the role through the onboarding correspondence map",
    fieldService?.presentation.role === mappedRole,
    `${String(fieldService?.presentation.role)} vs ${String(mappedRole)}`,
)
check(
    "a blueprint with no corresponding onboarding role reports role null and empty surfaces rather than guessing",
    (() => {
        const unmapped = all.find((b) => !Object.values(CORRESPONDING_BLUEPRINT).includes(b.id))
        if (!unmapped) return true
        const p = service.preview(unmapped.id)
        return p !== null && p.presentation.role === null && p.presentation.surfaces.length === 0
    })(),
)

// ---------------------------------------------------------------------------
// 4. Boundary behaviour, with real tenancy
// ---------------------------------------------------------------------------
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
        const beforeWorkspaces = await prisma.workspace.count()

        try {
            await prisma.$transaction(async (tx) => {
                const ids = await seed(tx)
                const identity = new ControlledIdentity()
                const client = tx as unknown as PrismaClient
                const api = new BlueprintPreviewApiService(
                    new PreviewContext(client, new PersistedTenancy(client, identity)),
                    new BlueprintPreviewService(),
                )

                identity.current = null
                const anonList = await call(api.list(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible("a signed-out list request is 401", anonList.status === 401, `status=${anonList.status}`)
                const anonPreview = await call(api.preview("field-service-v1", get(`${BASE}/x/preview?workspaceId=${ids.wsA}`)))
                check("a signed-out preview request is 401", anonPreview.status === 401, `status=${anonPreview.status}`)

                identity.current = ids.userA
                const okList = await call(api.list(get(`${BASE}?workspaceId=${ids.wsA}`)))
                checkInvertible("a member's list request is 200", okList.status === 200, `status=${okList.status}`)
                const listed = (okList.body.data as { blueprints?: unknown[] } | undefined)?.blueprints ?? []
                check("the 200 list carries every blueprint", listed.length === all.length, `${listed.length}/${all.length}`)

                const okPreview = await call(
                    api.preview("field-service-v1", get(`${BASE}/field-service-v1/preview?workspaceId=${ids.wsA}`)),
                )
                checkInvertible("a member's preview request is 200", okPreview.status === 200, `status=${okPreview.status}`)
                const preview = (okPreview.body.data as { preview?: Record<string, unknown> } | undefined)?.preview
                checkInvertible(
                    "the serialised preview keeps installed null, its limitations and its role-derived tag",
                    preview !== undefined &&
                        preview.installed === null &&
                        Array.isArray(preview.limitations) &&
                        (preview.limitations as string[]).length > 0 &&
                        (preview.presentation as { source?: string }).source === "role-derived",
                    preview ? `keys=${Object.keys(preview).sort().join(",")}` : "MISSING",
                )
                // NOT `JSON.stringify(JSON.parse(raw)) === JSON.stringify(body)`: `body` IS
                // `JSON.parse(raw)`, produced by the `call()` helper, so that comparison is x === x and
                // cannot fail. What is worth asserting is that the wire bytes parse and carry the
                // envelope.
                check(
                    "the preview response body is valid JSON on the wire and carries the envelope key",
                    (() => {
                        try {
                            const parsed = JSON.parse(okPreview.raw) as Record<string, unknown>
                            return parsed.ok === true && typeof parsed.data === "object" && parsed.data !== null
                        } catch {
                            return false
                        }
                    })(),
                )

                // 403 for a workspace the caller is not in, on BOTH endpoints.
                const foreignList = await call(api.list(get(`${BASE}?workspaceId=${ids.wsB}`)))
                checkInvertible(
                    "listing another tenant's workspace is 403",
                    foreignList.status === 403,
                    `status=${foreignList.status} code=${errCode(foreignList)}`,
                )
                const foreignPreview = await call(
                    api.preview("field-service-v1", get(`${BASE}/field-service-v1/preview?workspaceId=${ids.wsB}`)),
                )
                check("previewing under another tenant's workspace is 403", foreignPreview.status === 403)
                const ghostWorkspace = await call(api.list(get(`${BASE}?workspaceId=${RUN}_ghost_ws`)))
                checkInvertible(
                    "MEASURED: a foreign workspace and a nonexistent one are BYTE-IDENTICAL refusals",
                    refusal(foreignList) === refusal(ghostWorkspace) && foreignList.status === ghostWorkspace.status,
                    `${foreignList.status}/${ghostWorkspace.status} ${refusal(ghostWorkspace)}`,
                )

                // THE DELIBERATE EXCEPTION: an unknown BLUEPRINT id is a 404, not a 403.
                const unknownBlueprint = await call(
                    api.preview("nonsense-v9", get(`${BASE}/nonsense-v9/preview?workspaceId=${ids.wsA}`)),
                )
                checkInvertible(
                    "MEASURED: an unknown blueprint id is 404, because a blueprint id is a public static registry key",
                    unknownBlueprint.status === 404 && errCode(unknownBlueprint) === "NOT_FOUND",
                    `status=${unknownBlueprint.status} code=${errCode(unknownBlueprint)}`,
                )
                // And the reasoning is pinned: authorisation is evaluated BEFORE the registry lookup, so
                // an unauthorised caller cannot use the 404/403 difference as a registry oracle.
                const unknownBlueprintForeignWs = await call(
                    api.preview("nonsense-v9", get(`${BASE}/nonsense-v9/preview?workspaceId=${ids.wsB}`)),
                )
                checkInvertible(
                    "MEASURED: an unauthorised caller gets 403 even for a nonexistent blueprint, so 404 is not a registry oracle",
                    unknownBlueprintForeignWs.status === 403,
                    `status=${unknownBlueprintForeignWs.status}`,
                )

                const noWorkspace = await call(api.list(get(BASE)))
                checkInvertible(
                    "a missing workspaceId is 400 rather than an unscoped listing",
                    noWorkspace.status === 400 && errCode(noWorkspace) === "BAD_REQUEST",
                    `status=${noWorkspace.status} code=${errCode(noWorkspace)}`,
                )
                const blankWorkspace = await call(api.list(get(`${BASE}?workspaceId=%20`)))
                check("a whitespace-only workspaceId is 400", blankWorkspace.status === 400)

                for (const [label, called] of [
                    ["200", okList],
                    ["400", noWorkspace],
                    ["401", anonList],
                    ["403", foreignList],
                    ["404", unknownBlueprint],
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

                throw new Rollback()
            })
        } catch (e) {
            if (!(e instanceof Rollback)) throw e
        }

        // 503 with an injected failure carrying a fake DSN, so the assertion is about LEAKAGE.
        const brokenPrisma = {} as unknown as PrismaClient
        const brokenTenancy = {
            requireAccess: async () => {
                throw new Error("SECRET_DETAIL postgres://user:pw@dbhost:5432/personalink")
            },
        } as unknown as PersistedTenancy
        const brokenApi = new BlueprintPreviewApiService(
            new PreviewContext(brokenPrisma, brokenTenancy),
            new BlueprintPreviewService(),
        )
        const broken = await call(brokenApi.list(get(`${BASE}?workspaceId=whatever`)))
        checkInvertible(
            "a dependency failure is 503 rather than a 500 or a stack trace",
            broken.status === 503 && errCode(broken) === "DEPENDENCY_UNAVAILABLE",
            `status=${broken.status} code=${errCode(broken)}`,
        )
        checkInvertible(
            "MEASURED: the 503 body leaks no DSN, host, credential or driver text",
            !/SECRET_DETAIL|postgres:\/\/|dbhost|personalink|user:pw/.test(broken.raw),
            broken.raw.slice(0, 130),
        )
        checkInvertible(
            "the 503 names THIS surface rather than the one whose envelope helper it reuses",
            /Blueprint preview is temporarily unavailable/.test(broken.raw) && !/Field jobs/.test(broken.raw),
            String((broken.body.error as { message?: string } | undefined)?.message ?? ""),
        )

        const afterWorkspaces = await prisma.workspace.count()
        check("harness left zero residue", beforeWorkspaces === afterWorkspaces, `Workspace ${beforeWorkspaces} -> ${afterWorkspaces}`)
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} blueprint preview assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} blueprint preview assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("Blueprint preview holds: it resolves, and it does not install.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
