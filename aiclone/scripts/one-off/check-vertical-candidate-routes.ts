/**
 * check-vertical-candidate-routes.ts
 *
 * Executable contract for /api/business-os/vertical-candidates - the PROTECTED, READ-ONLY surface over
 * the six UNREGISTERED vertical pack candidates.
 *
 * WHAT THIS HARNESS EXISTS TO FALSIFY. A read-only API over something the repository guarantees is not
 * installable has exactly four ways to become a defect, and each one is asserted here rather than
 * described:
 *
 *   1. IT COULD BE READABLE WITHOUT AUTHORIZATION. The route is exercised through the REAL guard
 *      (src/lib/business-os/api/guard.ts) with only `@/lib/auth-sync` substituted, so the assertion is
 *      about the guard this route actually calls - not about a stub that agrees with it. The
 *      `businessOs` surface decision goes through the REAL `hasSurface`/`extrasOf`.
 *
 *   2. ITS REFUSALS COULD ENUMERATE. A caller who can tell "exists but forbidden" from "does not exist"
 *      has been given the catalogue. Every refusal body is compared BYTE-FOR-BYTE across an existing id,
 *      a non-existing id and no id at all.
 *
 *   3. IT COULD OVERCLAIM. Every candidate must report registered:false, status draft, and the
 *      Candidate / Not installed / Not active labels; every capability marked available in the payload is
 *      cross-checked against the REAL engine registry; messages, deposits, payments and providers must
 *      appear only as unsupported or owner-gated.
 *
 *   4. IT COULD BECOME AN INSTALL SURFACE. The route module is parsed with the repository's own AST
 *      classifier and must export no state-changing verb in ANY declaration style, including a
 *      re-export; calling it leaves every row count in the rehearsal database unchanged; and no candidate
 *      id appears in listBusinessBlueprints() before or after.
 *
 * TWO CONDITIONAL CLAIMS ARE PROVEN CONDITIONAL, not merely present. The home-services-v1 alias marker
 * and the clinic-practice-v1 non-clinical boundary are both DERIVED, so each is asserted twice: once on
 * the real descriptor (it appears) and once on a locally mutated copy (it disappears). A marker that
 * cannot disappear is a marker that would keep asserting an equivalence after the equivalence died.
 *
 * DATABASE. Read-only. It opens one connection to the authorized disposable rehearsal database, counts
 * every row in the public schema before and after the route calls, and writes nothing. Zero residue by
 * construction: there is no INSERT, UPDATE, DELETE or DDL anywhere in this file.
 *
 * INVERSION. INVERT_ASSERTION=1 flips every invertible assertion. Non-vacuity assertions - the ones that
 * prove a FIXTURE really has the property a negative test depends on, and the MEASURED pins - use plain
 * `check` and are not inverted, because inverting them would assert the fixture is well-formed, which is
 * the opposite of their purpose.
 *
 *   & "…/run-harness.ps1" -Worktree "…" -Harness "scripts/one-off/check-vertical-candidate-routes.ts"
 */
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

import { PrismaClient } from "@prisma/client"
import ts from "typescript"

import { getBusinessBlueprint, listBusinessBlueprints } from "../../src/lib/business-os"
import {
    CANDIDATE_ACTIVATION_LABEL,
    CANDIDATE_REGISTRATION_LABEL,
    CANDIDATE_STATUS_LABEL,
    engineCompositionFingerprint,
    toVerticalCandidateView,
} from "../../src/lib/business-os/api/serialize-vertical-candidates"
import type { VerticalCandidateView } from "../../src/lib/business-os/api/serialize-vertical-candidates"
import { businessEngineDescriptors } from "../../src/lib/business-os/engines"
import { getVerticalPackCandidate, listVerticalPackCandidates } from "../../src/lib/business-os/vertical-packs"
import type { VerticalPackCandidate } from "../../src/lib/business-os/vertical-packs"
import { extrasOf, hasSurface } from "../../src/lib/surfaces"
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
const APP_ROOT = join(__dirname, "..", "..")
const ROUTE_RELATIVE = "src/app/api/business-os/vertical-candidates/route.ts"
const SERIALIZER_RELATIVE = "src/lib/business-os/api/serialize-vertical-candidates.ts"
const BASE = "https://app.test/api/business-os/vertical-candidates"

/** A DSN with a password in it, so "does the envelope leak the failure" is a real question. */
const FAKE_DSN = "postgresql://bizos_user:sup3rs3cret@db.internal.example:5432/personalink?sslmode=require"

const EXPECTED_CANDIDATE_IDS = [
    "salon-spa-v1",
    "events-studio-v1",
    "real-estate-brokerage-v1",
    "home-services-v1",
    "recruitment-agency-v1",
    "clinic-practice-v1",
] as const

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * ASSERTION EVIDENCE, counted inside the helper that decides the verdict.
 *
 * The gates manifest's evidence allowlist is size ZERO, so this harness must emit its own count and that
 * count must be produced by the same call that records the failure - a separately maintained total would
 * keep printing a healthy number after somebody deleted half the assertions, which is the precise failure
 * the evidence contract exists to catch. Every assertion reaching `check` increments `assertionsRun`;
 * only one whose condition held increments `assertionsPassed`. A failing assertion therefore necessarily
 * LOWERS the passed count and, through `failures`, sets a non-zero exit.
 */
let assertionsRun = 0
let assertionsPassed = 0

function check(name: string, condition: unknown, detail?: string): void {
    assertionsRun += 1
    if (condition) {
        assertionsPassed += 1
        return
    }
    failures.push(detail === undefined ? name : `${name}: ${detail}`)
}

function checkInvertible(name: string, condition: unknown, detail?: string): void {
    check(name, INVERT ? !condition : condition, detail)
}

// ---------------------------------------------------------------------------
// In-process module loading with substituted dependencies.
//
// The route is COMPILED FROM THE FILE ON DISK on every run, so it cannot drift from what ships. Only the
// dependencies named in `overrides` are replaced; everything else resolves natively through
// tsconfig-paths, which means the guard, the params parser and the serializer under test are the real
// modules and not copies of them.
// ---------------------------------------------------------------------------

type LoadedModule = Record<string, unknown>

const nativeRequire = createRequire(__filename)

function loadTypeScriptModule(relativePath: string, overrides: Readonly<Record<string, unknown>>): LoadedModule {
    const filename = resolve(APP_ROOT, relativePath)
    const source = readFileSync(filename, "utf8")
    const output = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
        },
    }).outputText
    const loaded = { exports: {} as LoadedModule }
    const localRequire = (request: string): unknown =>
        Object.prototype.hasOwnProperty.call(overrides, request) ? overrides[request] : nativeRequire(request)
    const execute = new Function("exports", "require", "module", "__filename", "__dirname", output)
    execute(loaded.exports, localRequire, loaded, filename, dirname(filename))
    return loaded.exports
}

/** `NextResponse.json` stands in as a plain `Response`, so the shared envelope is observable here. */
const nextServerStub = {
    NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) },
}

type StubProfile = { roleTemplate: string | null; personalityConfig: string | null }
type StubUser = { profiles: StubProfile[] }
type SyncUser = () => Promise<StubUser | null>

type RouteModule = { GET: (req: unknown) => Promise<Response> }

/** Everything `req` is read for by this route: `nextUrl.searchParams`. */
function request(url: string): unknown {
    return { nextUrl: new URL(url) }
}

type Captured = { status: number; raw: string; body: Record<string, unknown> }

async function call(response: Promise<Response>): Promise<Captured> {
    const settled = await response
    const raw = await settled.text()
    let body: Record<string, unknown> = {}
    try {
        body = JSON.parse(raw) as Record<string, unknown>
    } catch {
        body = { unparseable: raw.slice(0, 200) }
    }
    return { status: settled.status, raw, body }
}

function errorCode(body: Record<string, unknown>): string {
    const error = body.error as { code?: string } | undefined
    return error?.code ?? ""
}

function dataOf(body: Record<string, unknown>): Record<string, unknown> {
    return (body.data as Record<string, unknown> | undefined) ?? {}
}

/**
 * Builds a route instance over the REAL guard, with only `syncUser` substituted.
 *
 * `responses.ts` is loaded once per instance and handed to BOTH the guard and the route, so a refusal
 * built by the guard and a payload built by the route come out of the same envelope module - which is
 * what makes "the refusal uses the shared envelope" an observation rather than an assumption.
 */
function buildRoute(syncUser: SyncUser, extraRouteOverrides: Readonly<Record<string, unknown>> = {}): RouteModule {
    const responses = loadTypeScriptModule("src/lib/business-os/api/responses.ts", { "next/server": nextServerStub })
    const guard = loadTypeScriptModule("src/lib/business-os/api/guard.ts", {
        "@/lib/auth-sync": { syncUser },
        "./responses": responses,
    })
    return loadTypeScriptModule(ROUTE_RELATIVE, {
        "next/server": nextServerStub,
        "@/lib/business-os/api/guard": guard,
        "@/lib/business-os/api/responses": responses,
        ...extraRouteOverrides,
    }) as unknown as RouteModule
}

const ANONYMOUS: SyncUser = async () => null
const NO_PROFILE: SyncUser = async () => ({ profiles: [] })
const WITHOUT_SURFACE: SyncUser = async () => ({
    profiles: [{ roleTemplate: "CONSULTANT", personalityConfig: null }],
})
/** CUSTOM is the schema default and receives ALL_SURFACES - which deliberately excludes businessOs. */
const CUSTOM_WITHOUT_OPT_IN: SyncUser = async () => ({
    profiles: [{ roleTemplate: "CUSTOM", personalityConfig: null }],
})
const WITH_SURFACE: SyncUser = async () => ({
    profiles: [
        {
            roleTemplate: "CONSULTANT",
            personalityConfig: JSON.stringify({ extras: { surfaces: ["businessOs"], packs: [], addons: [] } }),
        },
    ],
})

async function main(): Promise<void> {
    // -----------------------------------------------------------------------
    // 0. Database target. Read-only from here on, but the target is still proven.
    // -----------------------------------------------------------------------
    const databaseUrl = process.env.DATABASE_URL ?? ""
    const databaseName = parseDatabaseName(databaseUrl)
    assertDisposableTarget(databaseUrl)
    if (databaseName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: this harness only runs against ${AUTHORIZED_TARGET}, got ${String(databaseName)}`)
        process.exit(1)
    }
    check("the connection target is the authorized disposable rehearsal database", databaseName === AUTHORIZED_TARGET, String(databaseName))

    // -----------------------------------------------------------------------
    // 1. STRUCTURE. No state-changing verb, in any declaration style.
    // -----------------------------------------------------------------------
    const routePath = join(APP_ROOT, ROUTE_RELATIVE)
    const serializerPath = join(APP_ROOT, SERIALIZER_RELATIVE)
    checkInvertible("the vertical-candidates route module exists on disk", existsSync(routePath), routePath)
    checkInvertible("the candidate serializer module exists on disk", existsSync(serializerPath), serializerPath)

    const routeSource = readFileSync(routePath, "utf8")
    const serializerSource = readFileSync(serializerPath, "utf8")
    const classified = classifyRouteModule(routePath, routeSource)

    checkInvertible("the route exports GET", exportsMethod(classified, "GET"), describeMethods(classified))
    checkInvertible(
        "the route exports NO state-changing verb - no POST, PUT, PATCH or DELETE in any declaration style, including a re-export",
        exportsNoStateChangingMethod(classified),
        `stateChanging=[${classified.stateChanging.join(",")}] all=[${describeMethods(classified)}]`,
    )
    checkInvertible(
        "the route exports exactly one handler, GET",
        classified.methods.length === 1 && classified.methods[0] === "GET",
        describeMethods(classified),
    )
    checkInvertible(
        "HEAD and OPTIONS are left to the framework to derive from GET, so no extra handler exists to audit",
        frameworkDerivesSafeMethods(classified),
        `safeMethodHandlers=[${classified.safeMethodHandlers.join(",")}]`,
    )
    checkInvertible("the route calls the shared Business OS guard", routeSource.includes("requireBusinessOsAccess"))
    checkInvertible("the route is force-dynamic", routeSource.includes('dynamic = "force-dynamic"'))
    checkInvertible("the route runs on the node runtime", routeSource.includes('runtime = "nodejs"'))

    // Non-vacuity: the classifier must actually be able to SEE a state-changing verb, or the assertion
    // above passes because nothing could ever match it.
    const syntheticWriteRoute = classifyRouteModule(
        "synthetic-write-route.ts",
        'export async function GET() {}\nconst handler = async () => {}\nexport { handler as POST }\n',
    )
    check(
        "the classifier detects an aliased re-exported POST, so the no-write assertion is not vacuous",
        !exportsNoStateChangingMethod(syntheticWriteRoute) && syntheticWriteRoute.stateChanging.includes("POST"),
        `stateChanging=[${syntheticWriteRoute.stateChanging.join(",")}]`,
    )

    // Neither module may be able to reach a database, a network, a provider or a scheduler. A read-only
    // surface that CAN write is one edit from writing.
    const FORBIDDEN_SOURCE_PATTERNS: Array<[string, RegExp]> = [
        ["prisma client", /@prisma\/client|PrismaClient|\bprisma\./u],
        ["database write", /\b(create|createMany|update|updateMany|upsert|delete|deleteMany|\$executeRaw|\$executeRawUnsafe)\b/u],
        ["network call", /\bfetch\s*\(|axios|node-fetch|https?\.request/u],
        ["provider sdk", /\bstripe\b|twilio|sendgrid|nodemailer|razorpay|googleapis/iu],
        ["filesystem write", /writeFileSync|createWriteStream|\bunlinkSync\b/u],
        ["timer or scheduler", /setInterval|setTimeout|node-cron|node-schedule/u],
        ["install or registration call", /installBlueprint|registerBlueprint|businessBlueprintRegistry/u],
    ]
    const forbiddenHits: string[] = []
    for (const [label, pattern] of FORBIDDEN_SOURCE_PATTERNS) {
        if (pattern.test(routeSource)) forbiddenHits.push(`route: ${label}`)
        if (pattern.test(serializerSource)) forbiddenHits.push(`serializer: ${label}`)
    }
    checkInvertible(
        "neither the route nor the serializer can reach a database, network, provider, scheduler or installer",
        forbiddenHits.length === 0,
        forbiddenHits.join("; "),
    )
    check(
        "the forbidden-source detector matches a real write call, so the assertion above is not vacuous",
        FORBIDDEN_SOURCE_PATTERNS.some(([, pattern]) => pattern.test('await prisma.workspace.create({ data })')),
    )

    report.structure = {
        methods: classified.methods,
        stateChanging: classified.stateChanging,
        safeMethodHandlers: classified.safeMethodHandlers,
        forbiddenSourceHits: forbiddenHits.length,
    }

    // -----------------------------------------------------------------------
    // 2. AUTHORIZATION at the real server boundary.
    // -----------------------------------------------------------------------

    // Non-vacuity of the two profile fixtures: the surface decision has to actually differ between them,
    // through the REAL hasSurface, or every authorization assertion below is about nothing.
    check(
        "FIXTURE: a CONSULTANT profile with no extras does NOT hold the businessOs surface",
        !hasSurface("CONSULTANT", "businessOs", extrasOf(null)),
    )
    check(
        "FIXTURE: a CUSTOM profile with no extras does NOT hold the businessOs surface either - it is never role-granted",
        !hasSurface("CUSTOM", "businessOs", extrasOf(null)),
    )
    check(
        "FIXTURE: the opt-in profile DOES hold the businessOs surface",
        hasSurface(
            "CONSULTANT",
            "businessOs",
            extrasOf(JSON.stringify({ extras: { surfaces: ["businessOs"], packs: [], addons: [] } })),
        ),
    )

    const anonymousList = await call(buildRoute(ANONYMOUS).GET(request(BASE)))
    checkInvertible(
        "an unauthenticated caller is refused 401 UNAUTHORIZED through the shared envelope",
        anonymousList.status === 401 && anonymousList.body.ok === false && errorCode(anonymousList.body) === "UNAUTHORIZED",
        `${anonymousList.status} ${anonymousList.raw.slice(0, 160)}`,
    )
    checkInvertible(
        "the unauthenticated refusal carries no data key at all",
        !Object.prototype.hasOwnProperty.call(anonymousList.body, "data"),
        Object.keys(anonymousList.body).join(","),
    )

    const noProfileList = await call(buildRoute(NO_PROFILE).GET(request(BASE)))
    checkInvertible(
        "a signed-in caller with no profile is refused 403 FORBIDDEN through the shared envelope",
        noProfileList.status === 403 && noProfileList.body.ok === false && errorCode(noProfileList.body) === "FORBIDDEN",
        `${noProfileList.status} ${noProfileList.raw.slice(0, 160)}`,
    )

    const surfacelessList = await call(buildRoute(WITHOUT_SURFACE).GET(request(BASE)))
    checkInvertible(
        "a caller without the businessOs surface is refused 403 FORBIDDEN through the shared envelope",
        surfacelessList.status === 403 && surfacelessList.body.ok === false && errorCode(surfacelessList.body) === "FORBIDDEN",
        `${surfacelessList.status} ${surfacelessList.raw.slice(0, 160)}`,
    )

    const customList = await call(buildRoute(CUSTOM_WITHOUT_OPT_IN).GET(request(BASE)))
    checkInvertible(
        "the CUSTOM role template does not grant this surface - the owner console stays an explicit per-profile opt-in",
        customList.status === 403 && errorCode(customList.body) === "FORBIDDEN",
        `${customList.status} ${errorCode(customList.body)}`,
    )

    // No refusal may leak the catalogue it is refusing access to.
    const leakedInRefusals: string[] = []
    for (const refusal of [anonymousList, noProfileList, surfacelessList, customList]) {
        for (const id of EXPECTED_CANDIDATE_IDS) {
            if (refusal.raw.includes(id)) leakedInRefusals.push(id)
        }
    }
    checkInvertible(
        "no refusal body contains a candidate id",
        leakedInRefusals.length === 0,
        [...new Set(leakedInRefusals)].join(","),
    )

    const authorized = buildRoute(WITH_SURFACE)
    const listed = await call(authorized.GET(request(BASE)))
    checkInvertible(
        "a signed-in caller holding the businessOs surface reads the candidates",
        listed.status === 200 && listed.body.ok === true,
        `${listed.status} ${listed.raw.slice(0, 160)}`,
    )

    report.authorization = {
        anonymous: { status: anonymousList.status, code: errorCode(anonymousList.body) },
        noProfile: { status: noProfileList.status, code: errorCode(noProfileList.body) },
        withoutSurface: { status: surfacelessList.status, code: errorCode(surfacelessList.body) },
        customRoleTemplate: { status: customList.status, code: errorCode(customList.body) },
        withSurface: { status: listed.status, ok: listed.body.ok },
    }

    // -----------------------------------------------------------------------
    // 3. NON-ENUMERATION. A refusal must not vary with what was asked for.
    // -----------------------------------------------------------------------
    const REAL_ID = "clinic-practice-v1"
    const FAKE_ID = "not-a-real-candidate-v1"
    const OTHER_FAKE_ID = "also-not-a-candidate-v1"

    check(
        `FIXTURE: ${REAL_ID} really exists and ${FAKE_ID} really does not, so the comparison below is between an existing and a non-existing id`,
        getVerticalPackCandidate(REAL_ID) !== null && getVerticalPackCandidate(FAKE_ID) === null,
    )

    const anonymousReal = await call(buildRoute(ANONYMOUS).GET(request(`${BASE}?id=${REAL_ID}`)))
    const anonymousFake = await call(buildRoute(ANONYMOUS).GET(request(`${BASE}?id=${FAKE_ID}`)))
    checkInvertible(
        "an unauthenticated caller gets a byte-identical refusal for an existing and a non-existing id",
        anonymousReal.status === anonymousFake.status && anonymousReal.raw === anonymousFake.raw,
        `${anonymousReal.status}:${anonymousReal.raw} vs ${anonymousFake.status}:${anonymousFake.raw}`,
    )
    checkInvertible(
        "an unauthenticated refusal is also identical with no id at all, so the query shape reveals nothing either",
        anonymousList.raw === anonymousReal.raw,
        `${anonymousList.raw} vs ${anonymousReal.raw}`,
    )

    const surfacelessReal = await call(buildRoute(WITHOUT_SURFACE).GET(request(`${BASE}?id=${REAL_ID}`)))
    const surfacelessFake = await call(buildRoute(WITHOUT_SURFACE).GET(request(`${BASE}?id=${FAKE_ID}`)))
    checkInvertible(
        "a caller without the surface gets a byte-identical refusal for an existing and a non-existing id",
        surfacelessReal.status === surfacelessFake.status && surfacelessReal.raw === surfacelessFake.raw,
        `${surfacelessReal.status}:${surfacelessReal.raw} vs ${surfacelessFake.status}:${surfacelessFake.raw}`,
    )

    const notFoundA = await call(authorized.GET(request(`${BASE}?id=${FAKE_ID}`)))
    const notFoundB = await call(authorized.GET(request(`${BASE}?id=${OTHER_FAKE_ID}`)))
    checkInvertible(
        "an authorized caller gets 404 NOT_FOUND for an unknown id",
        notFoundA.status === 404 && errorCode(notFoundA.body) === "NOT_FOUND",
        `${notFoundA.status} ${notFoundA.raw.slice(0, 160)}`,
    )
    checkInvertible(
        "two different unknown ids produce byte-identical 404 bodies",
        notFoundA.raw === notFoundB.raw,
        `${notFoundA.raw} vs ${notFoundB.raw}`,
    )
    checkInvertible(
        "the 404 body does not echo the requested id back",
        !notFoundA.raw.includes(FAKE_ID) && !notFoundB.raw.includes(OTHER_FAKE_ID),
        `${notFoundA.raw} | ${notFoundB.raw}`,
    )

    // A refused caller and a not-found caller must not be separable into "exists" and "does not exist":
    // the 401/403 bodies are id-invariant (asserted above) and the 404 body is id-invariant too, so no
    // pair of responses differs on the existence of an id.
    const authorizedReal = await call(authorized.GET(request(`${BASE}?id=${REAL_ID}`)))
    checkInvertible(
        "the same existing id yields 200 for an authorized caller and a refusal for an unauthorized one - the surface, not the id, decides",
        authorizedReal.status === 200 && anonymousReal.status === 401 && surfacelessReal.status === 403,
        `${authorizedReal.status}/${anonymousReal.status}/${surfacelessReal.status}`,
    )

    report.nonEnumeration = {
        anonymousRealVsFakeIdentical: anonymousReal.raw === anonymousFake.raw,
        surfacelessRealVsFakeIdentical: surfacelessReal.raw === surfacelessFake.raw,
        unknownIdsIdentical: notFoundA.raw === notFoundB.raw,
        notFoundEchoesId: notFoundA.raw.includes(FAKE_ID),
        statuses: { authorized: authorizedReal.status, anonymous: anonymousReal.status, surfaceless: surfacelessReal.status },
    }

    // -----------------------------------------------------------------------
    // 4. TRUTHFUL PAYLOAD.
    // -----------------------------------------------------------------------
    const listData = dataOf(listed.body)
    const views = (listData.candidates ?? []) as VerticalCandidateView[]

    checkInvertible("the payload carries all six candidates", views.length === 6, `${views.length}`)
    checkInvertible("the payload reports the total", listData.total === 6, String(listData.total))
    checkInvertible("the payload declares itself read-only", listData.readOnly === true, String(listData.readOnly))
    checkInvertible("the payload declares nothing installable", listData.installable === false, String(listData.installable))
    checkInvertible(
        "the payload's MEASURED registry cross-check reports zero candidates in the blueprint registry",
        listData.registeredInRegistry === 0,
        String(listData.registeredInRegistry),
    )
    checkInvertible(
        "the payload ids are exactly the expected six",
        JSON.stringify(views.map((view) => view.id).sort()) === JSON.stringify([...EXPECTED_CANDIDATE_IDS].sort()),
        views.map((view) => view.id).join(","),
    )

    for (const view of views) {
        checkInvertible(`${view.id} reports registered false at the top level`, view.registered === false, String(view.registered))
        checkInvertible(`${view.id} reports truth.registered false`, view.truth.registered === false, String(view.truth.registered))
        checkInvertible(`${view.id} reports truth.installed false`, view.truth.installed === false, String(view.truth.installed))
        checkInvertible(`${view.id} reports truth.active false`, view.truth.active === false, String(view.truth.active))
        checkInvertible(
            `${view.id} reports it is not installable through this API`,
            view.truth.installableThroughThisApi === false,
            String(view.truth.installableThroughThisApi),
        )
        checkInvertible(`${view.id} reports status draft`, view.status === "draft", view.status)
        checkInvertible(`${view.id} reports truth.status draft`, view.truth.status === "draft", view.truth.status)
        checkInvertible(
            `${view.id} reports readiness candidate-not-registered`,
            view.readiness === "candidate-not-registered",
            view.readiness,
        )
        checkInvertible(`${view.id} is labelled Candidate`, view.truth.statusLabel === "Candidate", view.truth.statusLabel)
        checkInvertible(
            `${view.id} is labelled Not installed`,
            view.truth.registrationLabel === "Not installed",
            view.truth.registrationLabel,
        )
        checkInvertible(
            `${view.id} is labelled Not active`,
            view.truth.activationLabel === "Not active",
            view.truth.activationLabel,
        )
        checkInvertible(
            `${view.id} states no correspondence to an existing onboarding role`,
            view.truth.correspondsToExistingRole === false && view.onboarding.correspondsToExistingRole === false,
        )
        checkInvertible(`${view.id} carries no executed workflow`, view.workflows.executed === false)
        checkInvertible(
            `${view.id} declares its workflow definitions as unexecuted`,
            view.workflows.definitions.length > 0 &&
                view.workflows.definitions.every((workflow) => workflow.executed === false),
        )
        checkInvertible(
            `${view.id} marks proposed terminology and intended surfaces as unresolved`,
            view.proposedTerminology.resolved === false && view.intendedSurfaces.resolved === false,
        )
        checkInvertible(
            `${view.id} never intends the businessOs owner console surface`,
            !view.intendedSurfaces.surfaces.includes("businessOs"),
            view.intendedSurfaces.surfaces.join(","),
        )
        checkInvertible(
            `${view.id} carries every engine composition with an explicit required/optional flag`,
            view.engines.length > 0 &&
                view.engines.every(
                    (engine) => engine.requirement === (engine.required ? "required" : "optional"),
                ),
            view.engines.map((engine) => `${engine.engineId}:${engine.requirement}`).join(","),
        )
        checkInvertible(
            `${view.id} reports every unsupported function as unavailable`,
            view.unsupported.length > 0 && view.unsupported.every((entry) => entry.available === false),
            `${view.unsupported.length}`,
        )
        checkInvertible(
            `${view.id} reports every owner-gated function as unavailable and boundaried`,
            view.ownerGated.length > 0 &&
                view.ownerGated.every(
                    (entry) => entry.available === false && (entry.boundary === "inert" || entry.boundary === "owner-gated"),
                ),
            view.ownerGated.map((entry) => `${entry.id}:${entry.boundary}`).join(","),
        )
        checkInvertible(
            `${view.id} reports daily opportunities as read-only`,
            view.dailyOpportunities.length > 0 && view.dailyOpportunities.every((entry) => entry.readOnly === true),
        )
    }

    // The label constants and the payload must agree; a flipped constant must show up as a payload defect
    // rather than being invisible because the assertion reads the same constant.
    //
    // Widened to `string` on purpose. Comparing the imported constants DIRECTLY against the expected words
    // would make a flipped constant a TypeScript 2367 error inside this harness - the run would die before
    // any assertion recorded a verdict, and the evidence line would never print. Read as strings, the same
    // mutation is caught as what it is: a failing assertion with a count that drops.
    const labelConstants: Record<string, string> = {
        status: CANDIDATE_STATUS_LABEL,
        registration: CANDIDATE_REGISTRATION_LABEL,
        activation: CANDIDATE_ACTIVATION_LABEL,
    }
    checkInvertible(
        "the exported label constants are the three truth labels the payload must carry",
        labelConstants.status === "Candidate" &&
            labelConstants.registration === "Not installed" &&
            labelConstants.activation === "Not active",
        `${labelConstants.status} / ${labelConstants.registration} / ${labelConstants.activation}`,
    )

    // -----------------------------------------------------------------------
    // 5. NOTHING BECOMES REGISTERED OR INSTALLABLE.
    // -----------------------------------------------------------------------
    const registryIdsBefore = listBusinessBlueprints().map((blueprint) => blueprint.id)
    for (const id of EXPECTED_CANDIDATE_IDS) {
        checkInvertible(`${id} does not appear in listBusinessBlueprints()`, !registryIdsBefore.includes(id), registryIdsBefore.join(","))
        checkInvertible(`${id} does not resolve through getBusinessBlueprint()`, getBusinessBlueprint(id) === null)
    }
    checkInvertible(
        "no id returned by this surface appears in the blueprint registry",
        views.length > 0 && views.every((view) => !registryIdsBefore.includes(view.id)),
        registryIdsBefore.join(","),
    )

    // Capability truth: anything the payload marks available must be available in the REAL registry.
    const overclaimedCapabilities: string[] = []
    const backloggedPairs: string[] = []
    for (const view of views) {
        for (const engine of view.engines) {
            const descriptor = businessEngineDescriptors[engine.engineId]
            for (const capability of engine.capabilities) {
                const real = descriptor?.capabilities.find((entry) => entry.id === capability.id)
                if (capability.available && real?.maturity !== "available") {
                    overclaimedCapabilities.push(`${view.id}:${engine.engineId}:${capability.id}`)
                }
            }
            for (const capability of engine.backloggedCapabilities) {
                backloggedPairs.push(`${engine.engineId}:${capability.id}`)
                if (capability.available) overclaimedCapabilities.push(`${view.id}:${engine.engineId}:${capability.id} (backlogged)`)
                if (capability.composed) overclaimedCapabilities.push(`${view.id}:${engine.engineId}:${capability.id} (composed+backlogged)`)
            }
        }
    }
    checkInvertible(
        "no capability is presented as available unless the real engine registry says it is available",
        overclaimedCapabilities.length === 0,
        overclaimedCapabilities.join("; "),
    )
    checkInvertible(
        "reminders and deposits - the inert message and payment providers - appear only as backlogged, never as composed capabilities",
        backloggedPairs.includes("appointments:reminders") && backloggedPairs.includes("appointments:deposits"),
        backloggedPairs.join(","),
    )
    check(
        "MEASURED: appointments:reminders and appointments:deposits are still only partial in the registry, so the assertion above is not vacuous",
        businessEngineDescriptors.appointments.capabilities.find((entry) => entry.id === "reminders")?.maturity === "partial" &&
            businessEngineDescriptors.appointments.capabilities.find((entry) => entry.id === "deposits")?.maturity === "partial",
    )

    // Every gated function names a human action, and every unsupported one names a reason: a payload that
    // dropped either would be representing an absent provider as merely undocumented.
    const gatedWithoutGate = views.flatMap((view) =>
        view.ownerGated.filter((entry) => entry.gate.trim().length === 0).map((entry) => `${view.id}:${entry.id}`),
    )
    const unsupportedWithoutReason = views.flatMap((view) =>
        view.unsupported.filter((entry) => entry.reason.trim().length === 0).map((entry) => `${view.id}:${entry.id}`),
    )
    checkInvertible("every owner-gated function states its human gate", gatedWithoutGate.length === 0, gatedWithoutGate.join(","))
    checkInvertible(
        "every unsupported function states why it is absent",
        unsupportedWithoutReason.length === 0,
        unsupportedWithoutReason.join(","),
    )

    // -----------------------------------------------------------------------
    // 6. ALIAS MARKER - present, and provably CONDITIONAL.
    // -----------------------------------------------------------------------
    const homeCandidate = getVerticalPackCandidate("home-services-v1")
    const fieldService = getBusinessBlueprint("field-service-v1")
    check(
        "FIXTURE: both sides of the alias relationship resolve - the home-services candidate and the registered field-service blueprint",
        homeCandidate !== null && fieldService !== null,
        `candidate=${homeCandidate !== null} blueprint=${fieldService !== null}`,
    )

    if (homeCandidate === null || fieldService === null) {
        failures.push("alias fixtures unavailable, alias assertions could not run")
    } else {
        // Computed HERE, from the two blueprints, rather than read back out of the marker - an expectation
        // taken from the observation would agree with the marker however wrong the marker was.
        const homeFingerprint = engineCompositionFingerprint(homeCandidate.blueprint)
        const fieldFingerprint = engineCompositionFingerprint(fieldService)
        check(
            "MEASURED: the home-services and field-service engine fingerprints are still identical, so the alias marker is the binding claim - if this fails the compositions have diverged and the marker SHOULD drop",
            homeFingerprint === fieldFingerprint,
            `home=[${homeFingerprint}] field=[${fieldFingerprint}]`,
        )
        checkInvertible(
            "field-service-v1, the alias target, is a registered ACTIVE blueprint",
            registryIdsBefore.includes("field-service-v1") && fieldService.status === "active",
            fieldService.status,
        )

        const homeView = views.find((view) => view.id === "home-services-v1")
        checkInvertible("home-services-v1 is present in the payload", homeView !== undefined)
        const marker = homeView?.aliasMarker ?? null
        checkInvertible(
            "home-services-v1 carries the alias marker naming field-service-v1",
            marker !== null && marker.aliasOfBlueprintId === "field-service-v1",
            JSON.stringify(marker),
        )
        checkInvertible(
            "the alias marker records the matching fingerprints and names the relationship as a fold/terminology alias",
            marker !== null &&
                marker.fingerprintsMatch === true &&
                marker.relationship === "fold-or-terminology-alias-candidate" &&
                marker.engineFingerprint === homeFingerprint &&
                marker.aliasTargetFingerprint === fieldFingerprint,
            JSON.stringify(marker),
        )
        checkInvertible(
            "the alias marker does not claim the candidate is registered or installed",
            marker !== null && homeView?.registered === false && homeView?.truth.installed === false,
        )

        // THE CONDITIONALITY PROOF. A copy of the candidate whose composition genuinely diverges must lose
        // the marker. This is the assertion that fails if somebody makes the marker unconditional.
        const divergedCandidate = {
            ...homeCandidate,
            blueprint: {
                ...homeCandidate.blueprint,
                engines: homeCandidate.blueprint.engines.filter((engine) => engine.engineId !== "commerce"),
            },
        } as VerticalPackCandidate
        const divergedFingerprint = engineCompositionFingerprint(divergedCandidate.blueprint)
        check(
            "FIXTURE: the diverged copy really has a different fingerprint, so the conditionality proof is not vacuous",
            divergedFingerprint !== fieldFingerprint,
            `diverged=[${divergedFingerprint}]`,
        )
        checkInvertible(
            "the alias marker DROPS when the engine fingerprints diverge - it is conditional, not unconditional",
            toVerticalCandidateView(divergedCandidate).aliasMarker === null,
            JSON.stringify(toVerticalCandidateView(divergedCandidate).aliasMarker),
        )

        const otherMarkers = views
            .filter((view) => view.id !== "home-services-v1")
            .filter((view) => view.aliasMarker !== null)
            .map((view) => view.id)
        checkInvertible(
            "no other candidate carries an alias marker",
            otherMarkers.length === 0,
            otherMarkers.join(","),
        )

        report.aliasMarker = {
            homeFingerprint,
            fieldFingerprint,
            identical: homeFingerprint === fieldFingerprint,
            markerPresent: marker !== null,
            divergedFingerprint,
            markerDropsOnDivergence: toVerticalCandidateView(divergedCandidate).aliasMarker === null,
            otherCandidatesWithMarker: otherMarkers.length,
        }
    }

    // -----------------------------------------------------------------------
    // 7. CLINIC BOUNDARY - first-class, verbatim, and provably derived.
    // -----------------------------------------------------------------------
    const clinicCandidate = getVerticalPackCandidate("clinic-practice-v1")
    check("FIXTURE: the clinic candidate resolves", clinicCandidate !== null)

    const clinicView = views.find((view) => view.id === "clinic-practice-v1")
    checkInvertible("clinic-practice-v1 is present in the payload", clinicView !== undefined)
    checkInvertible(
        "clinic-practice-v1 carries its non-clinical boundary as a first-class field",
        clinicView !== undefined &&
            clinicView.boundaries.length > 0 &&
            clinicView.boundaries[0].id === "non-clinical-administration-only" &&
            clinicView.boundaries[0].domain === "clinical",
        JSON.stringify(clinicView?.boundaries.map((boundary) => boundary.id)),
    )
    checkInvertible(
        "the non-clinical boundary is the candidate's headline boundary, not something a reader has to dig for",
        clinicView?.primaryBoundary === "Non-clinical administration only",
        String(clinicView?.primaryBoundary),
    )
    const clinicStatements = clinicView?.boundaries[0]?.statements ?? []
    checkInvertible(
        "the boundary carries multiple explicit statements, from more than one part of the descriptor",
        clinicStatements.length >= 5 && new Set(clinicStatements.map((statement) => statement.source)).size >= 2,
        `${clinicStatements.length} statements from [${[...new Set(clinicStatements.map((s) => s.source))].join(",")}]`,
    )

    // Every boundary statement must be VERBATIM descriptor text. A paraphrase in a safety boundary is a
    // new claim nobody reviewed.
    if (clinicCandidate !== null) {
        const descriptorStrings = new Set<string>([
            clinicCandidate.blueprint.summary,
            ...clinicCandidate.onboarding.steps,
            ...clinicCandidate.onboarding.requiredOwnerDecisions,
            ...clinicCandidate.unsupported.map((entry) => `${entry.label}: ${entry.reason}`),
        ])
        const paraphrased = clinicStatements.filter((statement) => !descriptorStrings.has(statement.text))
        checkInvertible(
            "every boundary statement is verbatim descriptor text, never a paraphrase",
            paraphrased.length === 0,
            paraphrased.map((statement) => statement.text.slice(0, 80)).join(" ;; "),
        )
        checkInvertible(
            "the boundary names the clinical exclusions the descriptor enumerates - diagnosis, prescriptions, medical records and protected health information",
            ["clinic-no-diagnosis", "clinic-no-prescriptions", "clinic-no-medical-records", "clinic-no-phi-claim"].every((id) =>
                clinicStatements.some((statement) => statement.id === id),
            ),
            clinicStatements.map((statement) => statement.id ?? "-").join(","),
        )

        // THE DERIVATION PROOF. Strip the descriptor's clinical denials and the boundary must disappear:
        // the field is computed from what the descriptor says, not attached because of the candidate's id.
        const strippedCandidate = {
            ...clinicCandidate,
            blueprint: { ...clinicCandidate.blueprint, summary: "Front-desk scheduling for a practice." },
            unsupported: clinicCandidate.unsupported.filter((entry) => entry.id === "clinic-no-insurance-claims"),
            onboarding: {
                ...clinicCandidate.onboarding,
                steps: ["List the consultation types offered and how long each takes."],
                requiredOwnerDecisions: ["Who is offered a freed slot."],
            },
        } as VerticalPackCandidate
        checkInvertible(
            "the boundary DISAPPEARS when the descriptor stops stating it - the field is derived, not hardcoded by candidate id",
            toVerticalCandidateView(strippedCandidate).boundaries.length === 0,
            JSON.stringify(toVerticalCandidateView(strippedCandidate).boundaries.map((boundary) => boundary.id)),
        )
    }

    // The detector must not over-attach a clinical boundary to a vertical that has not declared one.
    const candidatesWithClinicalBoundary = views
        .filter((view) => view.boundaries.some((boundary) => boundary.domain === "clinical"))
        .map((view) => view.id)
    checkInvertible(
        "exactly one candidate carries a clinical boundary, and it is the clinic",
        candidatesWithClinicalBoundary.length === 1 && candidatesWithClinicalBoundary[0] === "clinic-practice-v1",
        candidatesWithClinicalBoundary.join(","),
    )
    check(
        "MEASURED: salon-spa-v1 uses 'treatment' affirmatively as a service noun and still gets no clinical boundary, so the detector is not matching on the word alone",
        JSON.stringify(getVerticalPackCandidate("salon-spa-v1")?.proposedTerminology ?? {}).includes("treatment") &&
            !candidatesWithClinicalBoundary.includes("salon-spa-v1"),
    )

    report.clinicBoundary = {
        boundaryIds: clinicView?.boundaries.map((boundary) => boundary.id) ?? [],
        primaryBoundary: clinicView?.primaryBoundary ?? null,
        statementCount: clinicStatements.length,
        statementSources: [...new Set(clinicStatements.map((statement) => statement.source))],
        candidatesWithClinicalBoundary,
    }

    // -----------------------------------------------------------------------
    // 8. NO MUTATION. Row counts across the whole public schema, before and after.
    // -----------------------------------------------------------------------
    const prisma = new PrismaClient()
    try {
        const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
            "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
        )
        const names = tables
            .map((row) => row.table_name)
            .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name))
        check("the rehearsal schema exposes tables to count, so the no-mutation assertion has something to measure", names.length > 0, `${names.length}`)

        const countAll = async (): Promise<string> => {
            const sql = names.map((name) => `select '${name}' as t, count(*)::text as c from "${name}"`).join(" union all ")
            const rows = await prisma.$queryRawUnsafe<Array<{ t: string; c: string }>>(sql)
            return JSON.stringify([...rows].sort((a, b) => a.t.localeCompare(b.t)))
        }

        const before = await countAll()
        const callsMade = [
            await call(buildRoute(WITH_SURFACE).GET(request(BASE))),
            await call(buildRoute(WITH_SURFACE).GET(request(`${BASE}?id=${REAL_ID}`))),
            await call(buildRoute(WITH_SURFACE).GET(request(`${BASE}?id=${FAKE_ID}`))),
            await call(buildRoute(ANONYMOUS).GET(request(BASE))),
            await call(buildRoute(WITHOUT_SURFACE).GET(request(`${BASE}?id=${REAL_ID}`))),
        ]
        const after = await countAll()

        check(
            "FIXTURE: the no-mutation window really contains route calls, including a successful read",
            callsMade.length === 5 && callsMade.some((captured) => captured.status === 200),
            callsMade.map((captured) => captured.status).join(","),
        )
        checkInvertible(
            "calling this surface changes no row count anywhere in the schema - it is read-only in fact, not only by declaration",
            before === after,
            `${before.length === after.length ? "same length, different content" : "different length"}`,
        )

        const registryIdsAfter = listBusinessBlueprints().map((blueprint) => blueprint.id)
        checkInvertible(
            "the blueprint registry is unchanged by these calls - nothing became registered",
            JSON.stringify(registryIdsBefore) === JSON.stringify(registryIdsAfter),
            `${registryIdsBefore.join(",")} vs ${registryIdsAfter.join(",")}`,
        )
        checkInvertible(
            "the candidate set is unchanged by these calls - nothing was added, removed or promoted",
            JSON.stringify(listVerticalPackCandidates().map((candidate) => candidate.blueprint.id)) ===
                JSON.stringify([...EXPECTED_CANDIDATE_IDS]),
            listVerticalPackCandidates().map((candidate) => candidate.blueprint.id).join(","),
        )

        report.noMutation = {
            tablesCounted: names.length,
            routeCalls: callsMade.length,
            rowCountsUnchanged: before === after,
            registryUnchanged: JSON.stringify(registryIdsBefore) === JSON.stringify(registryIdsAfter),
        }
    } finally {
        await prisma.$disconnect()
    }

    // -----------------------------------------------------------------------
    // 9. DEPENDENCY FAILURE. The envelope, not a stack, and never the DSN.
    // -----------------------------------------------------------------------
    check(
        "FIXTURE: the injected failure really carries a secret, so the leak assertions below are meaningful",
        FAKE_DSN.includes("sup3rs3cret"),
    )

    const guardThrows: SyncUser = async () => {
        throw new Error(`connect ECONNREFUSED for ${FAKE_DSN}`)
    }
    const guardFailure = await call(buildRoute(guardThrows).GET(request(BASE)))
    checkInvertible(
        "a failing guard dependency yields the shared 500 INTERNAL_ERROR envelope",
        guardFailure.status === 500 && guardFailure.body.ok === false && errorCode(guardFailure.body) === "INTERNAL_ERROR",
        `${guardFailure.status} ${guardFailure.raw.slice(0, 160)}`,
    )

    const readFailure = await call(
        buildRoute(WITH_SURFACE, {
            "@/lib/business-os/vertical-packs": {
                listVerticalPackCandidates: () => {
                    throw new Error(`candidate read failed against ${FAKE_DSN}`)
                },
                getVerticalPackCandidate: () => {
                    throw new Error(`candidate read failed against ${FAKE_DSN}`)
                },
            },
        }).GET(request(BASE)),
    )
    checkInvertible(
        "a failing underlying read yields the shared 500 INTERNAL_ERROR envelope rather than propagating",
        readFailure.status === 500 && readFailure.body.ok === false && errorCode(readFailure.body) === "INTERNAL_ERROR",
        `${readFailure.status} ${readFailure.raw.slice(0, 160)}`,
    )

    const STACK_MARKERS = ["sup3rs3cret", "bizos_user", "db.internal.example", "ECONNREFUSED", "    at ", ".ts:", "stack"]
    const leaked: string[] = []
    for (const captured of [guardFailure, readFailure]) {
        for (const marker of STACK_MARKERS) {
            if (captured.raw.includes(marker)) leaked.push(marker)
        }
    }
    checkInvertible(
        "no dependency-failure body leaks a connection string, a credential, a driver code or a stack frame",
        leaked.length === 0,
        [...new Set(leaked)].join(","),
    )
    checkInvertible(
        "a dependency failure is also non-enumerating - the body carries no candidate id",
        EXPECTED_CANDIDATE_IDS.every((id) => !guardFailure.raw.includes(id) && !readFailure.raw.includes(id)),
    )

    report.dependencyFailure = {
        guardFailure: { status: guardFailure.status, code: errorCode(guardFailure.body) },
        readFailure: { status: readFailure.status, code: errorCode(readFailure.body) },
        leakedMarkers: leaked.length,
    }
}

main()
    .catch((error: unknown) => {
        // A thrown harness is a failed harness, never a silent pass.
        failures.push(`harness threw: ${error instanceof Error ? error.message : String(error)}`)
    })
    .finally(() => {
        report.invert = INVERT
        report.result = failures.length === 0 ? "PASS" : "FAIL"
        report.failureCount = failures.length
        report.failures = failures
        report.assertionsRun = assertionsRun
        report.assertionsPassed = assertionsPassed

        console.log(JSON.stringify(report, null, 2))

        // Machine-readable assertion evidence for scripts/gates/run-gates.js. The evidence allowlist is
        // size ZERO, so this harness must produce its own count; both numbers come from the counters
        // incremented inside check(), so neither can claim more than actually ran. The harness id must
        // match this file's name exactly or the driver reports EVIDENCE_IDENTITY_MISMATCH.
        console.log(`GATE-EVIDENCE harness=check-vertical-candidate-routes.ts assertions=${assertionsPassed}`)
        console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

        if (failures.length > 0) process.exitCode = 1
    })
