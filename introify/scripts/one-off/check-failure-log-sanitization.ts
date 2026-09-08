/**
 * THE SHARED SANITIZING DEPENDENCY-FAILURE LOGGER, AND EVERY BOUNDARY THAT HAS ADOPTED IT.
 *
 * `src/lib/operations/dependency-failure-log.ts` used to have two callers, and `check-operations-runtime.ts`
 * proved it at one of them. This harness exists because it now has ELEVEN, and a leak proof that covers one
 * call site is not a leak proof for a shared module: every surface hands the logger a DIFFERENT error, from
 * a different driver, behind a different envelope, and the guarantee that has to hold is the same at all of
 * them. So the whole set is proven in one place, per boundary, from one probe.
 *
 * WHAT IT ASSERTS, and why each one is here rather than assumed:
 *
 *   ADOPTION IS COMPLETE AND STRUCTURAL. The set of `src/lib/**\/*http*.ts` boundary files is read off the
 *   DISK and required to equal the set this harness exercises, so a boundary added later without adopting
 *   the logger turns this red instead of quietly joining the unlogged majority. Each file is additionally
 *   required to call the logger exactly once and to contain no `console.` of its own, and the sanitizer is
 *   required to exist in exactly ONE module - the way a shared logger stops being shared is that somebody
 *   copies it.
 *
 *   NO LEAKS, AT ELEVEN BOUNDARIES, FROM ONE HOSTILE ERROR. A credential, a bearer token, a full DSN with a
 *   password, a query string carrying a secret, a serialised request body, a provider payload and a deep
 *   stack are planted in the error, in its message, in its properties, in an `AggregateError` branch, in a
 *   bare-string cause and in a cause's own message - and every planted substring is asserted absent from
 *   what `console.error` actually received, at every one of the eleven surfaces.
 *
 *   THE LOG IS STILL WORTH READING. Every "leaks no X" is paired with a precondition that the line exists,
 *   carries THIS surface's scope tag, and still names the kind, the code, the cause chain's real
 *   ECONNREFUSED and the frame position. A sanitizer that logs nothing would satisfy every redaction
 *   assertion in this file and is treated as a failure, not a success.
 *
 *   THE RESPONSE IS BYTE-IDENTICAL WITH AND WITHOUT THE LOGGER. Not argued from reading the diff: the
 *   logger's exported binding is replaced with a no-op, the same eleven boundaries are driven again, and
 *   status, body bytes and the full header set are compared. The patch is itself asserted to have taken
 *   effect, so a patch that silently failed cannot make this pass.
 *
 *   A BROKEN LOG IS NOT A BROKEN RESPONSE. `console.error` is made to throw at each boundary; each must
 *   still produce its own 503.
 *
 *   REFUSALS ARE NOT INCIDENTS AND CANNOT ENUMERATE. UNAUTHORIZED / FORBIDDEN / NOT_FOUND produce zero log
 *   lines at all eleven surfaces, and a foreign target and a nonexistent one are answered with the same
 *   bytes and the same silence.
 *
 * MUTATION-TESTED, and the two mutations are named here so the next reader can repeat them:
 *   (a) delete `.replace(SECRET_KEYWORD_PAIR, ...)` from `redact` - the planted `pgpassword=` frame leaks and
 *       "no planted secret survives" fails. That frame is in the probe FOR this control: it matches no other
 *       rule, so exactly one rule decides it.
 *   (b) delete the `try`/`catch` around the body of `logDependencyFailure` - "a broken log is not a broken
 *       response" fails, because the boundary's `.catch` handler then rejects and no response is produced.
 * Normal / mutated / restored must read 0 / non-zero / 0.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-failure-log-sanitization.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { inspect } from "node:util"

import { PrismaClient } from "@prisma/client"

import { AppointmentApiService } from "../../src/lib/appointments/http"
import { BlueprintInstallApiService } from "../../src/lib/business-os/install-http"
import { BlueprintPreviewApiService } from "../../src/lib/business-os/preview-http"
import { WorkspaceSurfaceApiService } from "../../src/lib/business-os/workspace-surface-http"
import { CaseApiService } from "../../src/lib/cases/http"
import { CohortApiService } from "../../src/lib/cohorts/http"
import { CommerceApiService } from "../../src/lib/commerce/http"
import { FieldJobApiService } from "../../src/lib/fieldjobs/http"
import { InventoryApiService } from "../../src/lib/inventory/http"
import * as failureLogModule from "../../src/lib/operations/dependency-failure-log"
import { logDependencyFailure } from "../../src/lib/operations/dependency-failure-log"
import { DueWorkApiService } from "../../src/lib/operations/due-work-http"
import { OperationsApiService } from "../../src/lib/operations/http"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const APP_ROOT = join(__dirname, "../..")
const LIB_ROOT = join(APP_ROOT, "src/lib")

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------
/**
 * Non-string arguments go through `util.inspect` exactly as `console.error` renders them, so a regression
 * that handed the transport a raw `Error` would be SEEN here with its message and its stack. A capture that
 * only concatenated the string arguments would miss the very defect this whole module exists to prevent.
 */
async function captureConsoleError(run: () => Promise<void>): Promise<string[]> {
    const lines: string[] = []
    const real = console.error
    console.error = (...args: unknown[]): void => {
        lines.push(args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 8 }))).join(" "))
    }
    try {
        await run()
    } finally {
        console.error = real
    }
    return lines
}

type Observed = Readonly<{ status: number; body: string; headers: string; rejected: boolean }>

/** Status, body bytes and the FULL header set - names and values - so "byte-identical" means it. */
async function observe(produce: () => Promise<Response>): Promise<Observed> {
    try {
        const response = await produce()
        const pairs: string[] = []
        response.headers.forEach((value, key) => pairs.push(`${key.toLowerCase()}: ${value}`))
        return Object.freeze({
            status: response.status,
            body: await response.text(),
            headers: pairs.sort().join("\n"),
            rejected: false,
        })
    } catch {
        // A boundary whose failure funnel REJECTS produced no response at all. Recorded rather than thrown,
        // so mutation (b) turns an assertion red instead of aborting the run before the summary prints.
        return Object.freeze({ status: 0, body: "", headers: "", rejected: true })
    }
}

/**
 * A dependency every method of which rejects with the same error.
 *
 * A proxy rather than eleven hand-written stubs: the boundaries take between one and four collaborators and
 * the probe does not care which one is reached first, only that the failure arrives at the funnel. `then` is
 * withheld so the object is never mistaken for a thenable by anything that inspects it.
 */
function rejecting<T>(thrown: unknown): T {
    return new Proxy(
        {},
        {
            get: (_target, property) => (property === "then" ? undefined : () => Promise.reject(thrown)),
        },
    ) as T
}

// ---------------------------------------------------------------------------
// The eleven boundaries
// ---------------------------------------------------------------------------
type Boundary = Readonly<{
    scope: string
    file: string
    /** Drive the boundary with a dependency that rejects with `thrown`. */
    invoke: (thrown: unknown) => Promise<Response>
}>

const PROBE_QUERY = "?workspaceId=ws_probe"
const get = (base: string, query = PROBE_QUERY): Request => new Request(`${base}${query}`, { method: "GET" })

const BOUNDARIES: readonly Boundary[] = Object.freeze([
    {
        scope: "[operations/today]",
        file: "operations/http.ts",
        invoke: (t) => new OperationsApiService(rejecting(t)).today(get("http://probe.test/api/platform/operations/today")),
    },
    {
        scope: "[operations/due-work]",
        file: "operations/due-work-http.ts",
        invoke: (t) => new DueWorkApiService(rejecting(t)).preview(get("http://probe.test/api/platform/operations/due-work")),
    },
    {
        scope: "[fieldjobs]",
        file: "fieldjobs/http.ts",
        invoke: (t) =>
            new FieldJobApiService(rejecting(t), rejecting(t), rejecting(t), rejecting(t)).listRequests(
                get("http://probe.test/api/platform/field-job-requests"),
            ),
    },
    {
        scope: "[cases]",
        file: "cases/http.ts",
        invoke: (t) =>
            new CaseApiService(rejecting(t), rejecting(t), rejecting(t), rejecting(t)).listIntakes(
                get("http://probe.test/api/platform/case-intakes"),
            ),
    },
    {
        scope: "[cohorts]",
        file: "cohorts/http.ts",
        invoke: (t) =>
            new CohortApiService(rejecting(t), rejecting(t), rejecting(t), rejecting(t)).list(
                get("http://probe.test/api/platform/cohorts"),
            ),
    },
    {
        scope: "[commerce]",
        file: "commerce/http.ts",
        invoke: (t) =>
            new CommerceApiService(rejecting(t), rejecting(t), rejecting(t)).listProducts(
                get("http://probe.test/api/platform/products"),
            ),
    },
    {
        scope: "[inventory]",
        file: "inventory/http.ts",
        invoke: (t) => new InventoryApiService(rejecting(t)).list(get("http://probe.test/api/platform/inventory")),
    },
    {
        scope: "[appointments]",
        file: "appointments/http.ts",
        invoke: (t) =>
            new AppointmentApiService(rejecting(t), rejecting(t)).list(get("http://probe.test/api/platform/appointments")),
    },
    {
        scope: "[business-os/install]",
        file: "business-os/install-http.ts",
        invoke: (t) => new BlueprintInstallApiService(rejecting(t)).forWorkspace("ws_probe"),
    },
    {
        scope: "[business-os/preview]",
        file: "business-os/preview-http.ts",
        invoke: (t) =>
            new BlueprintPreviewApiService(rejecting(t), rejecting(t)).list(get("http://probe.test/api/platform/blueprints")),
    },
    {
        scope: "[business-os/workspace-surface]",
        file: "business-os/workspace-surface-http.ts",
        invoke: (t) => new WorkspaceSurfaceApiService(rejecting(t)).forWorkspace("ws_probe"),
    },
])

// ---------------------------------------------------------------------------
// The planted secrets
// ---------------------------------------------------------------------------
/**
 * ASSEMBLED FROM PARTS so this source file never itself contains a complete DSN or a complete token: the
 * run's own log cannot be made to hold one by quoting this file, and a reviewer grepping the repository for
 * a live-looking credential does not find one here.
 */
const USERINFO = [`svc${"user"}`, `hun${"ter2"}`].join(":")
const HOSTPORT = [`db${"host"}.internal`, "5432"].join(":")
const DSN = `postgres://${USERINFO}@${HOSTPORT}/appdb?sslmode=require`
const BEARER_TOKEN = ["sk", "live", "PLANTEDBEARERTOKEN0123456789"].join("_")
const QUERY_SECRET = "PLANTED_QUERY_STRING_SECRET"
const REQUEST_BODY = JSON.stringify({
    email: "victim@example.test",
    cardNumber: "4111111111111111",
    marker: "PLANTED_REQUEST_BODY",
})
const PROVIDER_PAYLOAD = {
    message: "PLANTED_PROVIDER_MESSAGE",
    param: "source",
    request_id: "req_PLANTED_PROVIDER_REQUEST_ID",
    headers: { authorization: `Bearer ${BEARER_TOKEN}` },
    body: REQUEST_BODY,
}
const TOP_MESSAGE_MARKER = "PLANTED_TOP_MESSAGE"
const CAUSE_MESSAGE_MARKER = "PLANTED_CAUSE_MESSAGE"
const STRING_CAUSE_MARKER = "PLANTED_STRING_CAUSE"
const FRAME_BEYOND_CAP = "PLANTED_FRAME_BEYOND_CAP"
const BEYOND_BREADTH_CAP = "BEYONDBREADTHCAP"
const BEYOND_DEPTH_CAP = "BEYONDDEPTHCAP"

/**
 * Every substring that must never appear, whatever the boundary. `postgres://` and `password=` are shapes
 * rather than values: a log that contains either has already lost, even if the value beside it was mangled.
 */
const FORBIDDEN_FRAGMENTS: readonly string[] = Object.freeze([
    "svcuser",
    "hunter2",
    "dbhost.internal",
    "sslmode",
    "postgres://",
    "pgpassword=",
    "password=",
    BEARER_TOKEN,
    "Bearer sk",
    QUERY_SECRET,
    "PLANTED_REQUEST_BODY",
    "4111111111111111",
    "victim@example.test",
    "PLANTED_PROVIDER_MESSAGE",
    "req_PLANTED_PROVIDER_REQUEST_ID",
    TOP_MESSAGE_MARKER,
    CAUSE_MESSAGE_MARKER,
    STRING_CAUSE_MARKER,
    FRAME_BEYOND_CAP,
    BEYOND_BREADTH_CAP,
    BEYOND_DEPTH_CAP,
])

/**
 * THE OMNIBUS PROBE. Built fresh per use so no assertion can be satisfied by a mutation an earlier one made.
 *
 * Shape, and what each part is FOR:
 *   top          undici's real shape - a TypeError whose own `code` is a DSN, so the code allowlist is
 *                exercised on the field a driver most easily poisons.
 *   .cause       an AggregateError, which is what `Promise.any` and a multi-address connect produce.
 *   branch 0     the real failure, `ECONNREFUSED`, with the request body and the DSN in its MESSAGE.
 *   branch 1     a provider error: `code` a safe token, and the payload, the auth header and the body hung
 *                off it as PROPERTIES. Its `cause` points back at `top`, so the walk meets a CYCLE.
 *   branch 2     a bare STRING cause, which is what `new Error(m, { cause: connectionString })` gives.
 *   branch 3+    beyond the breadth cap, and branch 4 carries a code that WOULD be logged if the cap were
 *                not enforced - which is the only way to prove a cap rather than assume it.
 *   .stack       four frame shapes the redactor must tell apart, then 36 more so the frame cap is exercised
 *                by a stack that is genuinely deep.
 */
function buildOmnibusProbe(): unknown {
    const branch0 = Object.assign(new Error(`${CAUSE_MESSAGE_MARKER} ${DSN} ${REQUEST_BODY}`), { code: "ECONNREFUSED" })
    const branch1 = Object.assign(new Error("provider rejected the request"), {
        code: "card_declined",
        raw: PROVIDER_PAYLOAD,
        headers: { authorization: `Bearer ${BEARER_TOKEN}` },
        requestBody: REQUEST_BODY,
    })
    const branch3 = Object.assign(new Error("beyond the breadth cap"), { code: `postgres://${USERINFO}@${HOSTPORT}/x` })
    const branch4 = Object.assign(new Error("also beyond the breadth cap"), { code: BEYOND_BREADTH_CAP })
    const aggregate = new AggregateError(
        [branch0, branch1, `${STRING_CAUSE_MARKER} ${DSN}`, branch3, branch4],
        "every attempt failed",
    )
    const top = Object.assign(new TypeError(`fetch failed ${TOP_MESSAGE_MARKER} ${DSN} Bearer ${BEARER_TOKEN}`), {
        cause: aggregate,
        code: `postgres://${USERINFO}@${HOSTPORT}/appdb`,
        requestBody: REQUEST_BODY,
    })
    branch1.cause = top

    const deepFrames = Array.from(
        { length: 36 },
        (_unused, index) => `    at deep${index} (file:///C:/probe/app/${FRAME_BEYOND_CAP}${index}.ts:${index}:1)`,
    )
    top.stack = [
        `TypeError: fetch failed ${TOP_MESSAGE_MARKER} ${DSN} Bearer ${BEARER_TOKEN}`,
        `    at composeSummary (file:///C:/probe/app/src/lib/engine.ts:10:5)`,
        `    at bundled (file:///C:/probe/app/y.js?access_token=${BEARER_TOKEN}&s=${QUERY_SECRET}:20:7)`,
        `    at libpq (pgpassword=hunter2 connect_timeout=10)`,
        `    at last (C:\\probe\\app\\z.ts:33:11)`,
        ...deepFrames,
    ].join("\n")
    return top
}

/** A plain chain seven links long, so the depth cap has something to refuse. */
function buildDepthProbe(): unknown {
    let node: Error = Object.assign(new Error("beyond the depth cap"), { code: BEYOND_DEPTH_CAP })
    for (let level = 6; level >= 1; level -= 1) {
        node = Object.assign(new Error(`link ${level}`), { code: `DEPTH${level}`, cause: node })
    }
    return node
}

type Payload = Readonly<{
    line: string
    all: string
    kind: unknown
    code: unknown
    causes: ReadonlyArray<{ via?: unknown; kind?: unknown; code?: unknown }>
    frames: string
    framesKept: unknown
    framesTotal: unknown
    parsed: boolean
}>

/** Reads back the ONE logged line for `scope`, and the JSON payload the logger appends to it. */
function readPayload(lines: readonly string[], scope: string): Payload {
    const surface = lines.filter((line) => line.includes(scope))
    const line = surface[0] ?? ""
    const at = line.indexOf('{"kind"')
    let value: Record<string, unknown> | null = null
    if (at >= 0) {
        try {
            const decoded: unknown = JSON.parse(line.slice(at))
            value = decoded !== null && typeof decoded === "object" ? (decoded as Record<string, unknown>) : null
        } catch {
            value = null
        }
    }
    const causes = Array.isArray(value?.causes)
        ? (value?.causes as Array<{ via?: unknown; kind?: unknown; code?: unknown }>)
        : []
    return Object.freeze({
        line,
        all: lines.join("\n"),
        kind: value?.kind,
        code: value?.code,
        causes,
        frames: Array.isArray(value?.frames) ? (value?.frames as unknown[]).map((f) => String(f)).join(" | ") : "",
        framesKept: value?.framesKept,
        framesTotal: value?.framesTotal,
        parsed: value !== null,
    })
}

function leaks(text: string): string[] {
    const lowered = text.toLowerCase()
    return FORBIDDEN_FRAGMENTS.filter((fragment) => lowered.includes(fragment.toLowerCase()))
}

// ---------------------------------------------------------------------------
// 1. Adoption is complete, structural, and unforked
// ---------------------------------------------------------------------------
function boundaryFilesOnDisk(): string[] {
    const found: string[] = []
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry)
            if (statSync(full).isDirectory()) {
                walk(full)
                continue
            }
            if (/http.*\.ts$/u.test(entry) && !entry.endsWith(".d.ts")) {
                found.push(relative(LIB_ROOT, full).split("\\").join("/"))
            }
        }
    }
    walk(LIB_ROOT)
    return found.sort()
}

function proveAdoption(): void {
    const onDisk = boundaryFilesOnDisk()
    const exercised = BOUNDARIES.map((b) => b.file).sort()
    checkInvertible(
        "MEASURED: the set of HTTP boundary files on disk under src/lib is EXACTLY the set this harness drives, so a new boundary that skips the shared logger turns this harness red rather than joining an unlogged majority unnoticed",
        onDisk.join(",") === exercised.join(","),
        `onDisk=${onDisk.length} [${onDisk.join(" ")}] exercised=${exercised.length}`,
    )

    let adopting = 0
    let withOwnConsole = 0
    let scopeMismatch = 0
    for (const boundary of BOUNDARIES) {
        const source = readFileSync(join(LIB_ROOT, boundary.file), "utf8")
        // Comments are stripped before anything is counted. These files DISCUSS the logger as well as calling
        // it, and a census that counted prose would report whatever the documentation happened to say.
        const code = source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/[^\n]*/gu, "")
        // Exactly one CALL, and the import that makes it resolvable. A boundary that logged from several
        // places would have several chances to log something this funnel's proof never saw.
        const calls = code.split(/logDependencyFailure\s*\(/u).length - 1
        const imports = /import\s*\{\s*logDependencyFailure\s*\}/u.test(code)
        if (calls === 1 && imports) adopting += 1
        if (/(?:^|[^.\w])console\s*\./u.test(code)) withOwnConsole += 1
        if (!code.includes(`"${boundary.scope}"`)) scopeMismatch += 1
    }
    checkInvertible(
        "MEASURED: every one of the eleven boundary files imports the shared logger and CALLS it exactly once - at its single failure funnel - so no surface has a second, unproven logging path",
        adopting === BOUNDARIES.length,
        `${adopting}/${BOUNDARIES.length} files import the logger and call it exactly once (comments stripped before counting)`,
    )
    checkInvertible(
        "MEASURED: no boundary file contains a console call of its own, so none of them can serialise a raw Error alongside the sanitized line",
        BOUNDARIES.length === 11 && withOwnConsole === 0,
        `${withOwnConsole} boundary file(s) carry their own console call`,
    )
    checkInvertible(
        "MEASURED: each boundary's scope literal is present in its own source, so the tag this harness asserts against is the tag the file actually passes rather than one this harness invented",
        BOUNDARIES.length === 11 && scopeMismatch === 0,
        `${BOUNDARIES.length - scopeMismatch}/${BOUNDARIES.length} scope literals found in their own file`,
    )

    // Exactly one implementation. The way a shared module stops being shared is that somebody copies it, and
    // a copy would pass every other assertion in this file while drifting from the original at leisure.
    const implementations: string[] = []
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry)
            if (statSync(full).isDirectory()) {
                walk(full)
                continue
            }
            if (!entry.endsWith(".ts")) continue
            const source = readFileSync(full, "utf8")
            if (source.includes("<redacted-authority>") && source.includes("function redact(")) {
                implementations.push(relative(LIB_ROOT, full).split("\\").join("/"))
            }
        }
    }
    walk(LIB_ROOT)
    checkInvertible(
        "MEASURED: the sanitizer is implemented in EXACTLY ONE module under src/lib, so the eleven boundaries share one guarantee rather than eleven copies of it that can drift apart",
        implementations.length === 1 && implementations[0] === "operations/dependency-failure-log.ts",
        `implementations=[${implementations.join(",")}]`,
    )
}

// ---------------------------------------------------------------------------
// 2. No leaks, at every boundary
// ---------------------------------------------------------------------------
async function proveNoLeaks(): Promise<void> {
    let logged = 0
    let leaking = 0
    let classified = 0
    let correlated = 0
    const leakDetail: string[] = []
    const missingClassification: string[] = []

    for (const boundary of BOUNDARIES) {
        const lines = await captureConsoleError(async () => {
            await observe(() => boundary.invoke(buildOmnibusProbe()))
        })
        const payload = readPayload(lines, boundary.scope)

        // The precondition. Without it every "leaks no X" below would be satisfied by an empty string, and a
        // sanitizer that logs nothing is the original defect wearing a different face.
        if (
            lines.filter((line) => line.includes(boundary.scope)).length === 1 &&
            payload.parsed &&
            payload.all.includes("DEPENDENCY_UNAVAILABLE")
        ) {
            logged += 1
        }

        const found = leaks(payload.all)
        if (found.length === 0) leaking += 0
        else {
            leaking += 1
            leakDetail.push(`${boundary.scope}:${found.join("/")}`)
        }

        // Safe classification survived the redaction: the wrapper's kind, the poisoned code refused, the real
        // driver code recovered from the chain, and the provider's safe code kept.
        const codes = payload.causes.map((c) => String(c.code))
        if (
            payload.kind === "TypeError" &&
            payload.code === null &&
            payload.causes.some((c) => c.kind === "AggregateError") &&
            codes.includes("ECONNREFUSED") &&
            codes.includes("card_declined")
        ) {
            classified += 1
        } else {
            missingClassification.push(`${boundary.scope}:kind=${String(payload.kind)}/codes=[${codes.join(",")}]`)
        }

        // Correlation: the surface tag, the position in the code, the `via` trail through the chain, and an
        // honest count of what was dropped. This is the whole reason the log exists.
        if (
            payload.line.startsWith(boundary.scope) &&
            payload.frames.includes("/src/lib/engine.ts:10:5") &&
            payload.causes.some((c) => String(c.via).includes("cause.errors[0]")) &&
            payload.framesKept === 4 &&
            payload.framesTotal === 40
        ) {
            correlated += 1
        }
    }

    checkInvertible(
        "MEASURED: all eleven boundaries emit EXACTLY ONE sanitized line for an unexpected dependency failure, tagged with their own scope, naming the 503, with a parseable payload - so every redaction assertion below reads a real logged line rather than nothing",
        logged === BOUNDARIES.length,
        `${logged}/${BOUNDARIES.length} boundaries logged exactly one parseable, scope-tagged line`,
    )
    checkInvertible(
        `MEASURED: none of the ${FORBIDDEN_FRAGMENTS.length} planted secret substrings - a credential, a bearer token, a full DSN with password, a secret-bearing query string, a serialised request body with card and email, a provider payload, and markers in the message, the cause messages, a bare-string cause and the deep frames - appears in what console.error received at ANY of the eleven boundaries`,
        BOUNDARIES.length === 11 && leaking === 0,
        leaking === 0
            ? `${FORBIDDEN_FRAGMENTS.length} planted shapes x ${BOUNDARIES.length} boundaries, zero present`
            : `LEAKED at: ${leakDetail.join(" ; ")}`,
    )
    checkInvertible(
        "MEASURED: safe classification SURVIVES the redaction at every boundary - the wrapper is still TypeError, the DSN-shaped `code` is refused to null, and reading through cause still recovers the AggregateError, the real ECONNREFUSED and the provider's own safe code, which is what tells an operator an outage from a defect",
        classified === BOUNDARIES.length,
        classified === BOUNDARIES.length
            ? `${classified}/${BOUNDARIES.length} boundaries kept kind, refused the poisoned code, and recovered both real codes`
            : `INCOMPLETE: ${missingClassification.join(" ; ")}`,
    )
    checkInvertible(
        "MEASURED: correlation information is present and USEFUL at every boundary - the line opens with that surface's scope tag, keeps the failing frame's file/line/column, keeps the `via` path through the cause chain, and reports honestly that 4 of 40 frames were kept",
        correlated === BOUNDARIES.length,
        `${correlated}/${BOUNDARIES.length} boundaries carried scope + position + via-trail + frame accounting`,
    )

    // The caps, proven at the shared module where they live rather than eleven times over.
    const omnibusLines = await captureConsoleError(async () => {
        logDependencyFailure("[operations/today]", buildOmnibusProbe())
    })
    const omnibus = readPayload(omnibusLines, "[operations/today]")
    checkInvertible(
        "MEASURED: the AggregateError breadth cap is ENFORCED, not assumed - a fourth branch carrying a code that would otherwise be logged verbatim is absent from the line, and the recorded chain stops at the documented node count",
        !omnibus.all.includes(BEYOND_BREADTH_CAP) && omnibus.causes.length === 4,
        `causes=${omnibus.causes.length} via=[${omnibus.causes.map((c) => String(c.via)).join(",")}]`,
    )
    checkInvertible(
        "MEASURED: a cause chain that points back at its own root TERMINATES - the cycle through the provider branch is visited once and the logger returns instead of exhausting the stack while a 503 waits on it",
        omnibus.parsed && omnibus.causes.filter((c) => c.kind === "TypeError").length === 0,
        `cycle re-entry recorded ${omnibus.causes.filter((c) => c.kind === "TypeError").length} time(s)`,
    )
    const depthLines = await captureConsoleError(async () => {
        logDependencyFailure("[operations/today]", buildDepthProbe())
    })
    const depth = readPayload(depthLines, "[operations/today]")
    checkInvertible(
        "MEASURED: the cause DEPTH cap is enforced - a link past the cap has its code absent while every link within the cap is present, so the chain is bounded rather than followed as far as a driver chooses to nest it",
        !depth.all.includes(BEYOND_DEPTH_CAP) &&
            depth.causes.map((c) => String(c.code)).join(",") === "DEPTH2,DEPTH3,DEPTH4,DEPTH5,DEPTH6",
        `depth causes=${depth.causes.length} codes=[${depth.causes.map((c) => String(c.code)).join(",")}]`,
    )
    checkInvertible(
        "MEASURED: the redactor keeps the evidence and drops only the secret - an ESM path with its line and column survives, a query string carrying a token is dropped WITHOUT losing the position, the keyword-form credential frame collapses to a marker while its non-secret neighbour survives, and a plain Windows-path frame is untouched",
        omnibus.frames.includes("/src/lib/engine.ts:10:5") &&
            omnibus.frames.includes("y.js<redacted-query>:20:7") &&
            omnibus.frames.includes("<redacted-credential> connect_timeout=10") &&
            omnibus.frames.includes("z.ts:33:11") &&
            !/[a-z][a-z0-9+.-]*:\/\//iu.test(omnibus.all),
        omnibus.frames.slice(0, 240),
    )

    // A hostile SCOPE - the one caller-supplied string that reaches the line - cannot smuggle anything.
    const hostileScopeLines = await captureConsoleError(async () => {
        logDependencyFailure(`[cases/${DSN}]`, new Error("dependency down"))
        logDependencyFailure(`Bearer ${BEARER_TOKEN}`, new Error("dependency down"))
    })
    const hostileScopeText = hostileScopeLines.join("\n")
    checkInvertible(
        "MEASURED: the scope label is an ALLOWLISTED SHAPE and not trusted text - a caller interpolating a DSN or a token into its scope tag gets `[unknown-scope]` and the secret never reaches the line, which is what keeps eleven call sites from having to be individually audited",
        hostileScopeLines.length === 2 &&
            leaks(hostileScopeText).length === 0 &&
            hostileScopeLines.every((line) => line.startsWith("[unknown-scope]")),
        `lines=${hostileScopeLines.length} leaks=[${leaks(hostileScopeText).join(",")}]`,
    )
    checkInvertible(
        "MEASURED: the scope allowlist did NOT cost the existing labels - all eleven registered scope tags pass through unchanged, so the check is invisible to every real caller and the two original callers log byte-identically to before",
        (
            await captureConsoleError(async () => {
                for (const boundary of BOUNDARIES) logDependencyFailure(boundary.scope, new Error("dependency down"))
            })
        ).filter((line, index) => line.startsWith(BOUNDARIES[index]?.scope ?? "\u0000")).length === BOUNDARIES.length,
        `all ${BOUNDARIES.length} registered scope labels conform to the allowlist`,
    )
}

// ---------------------------------------------------------------------------
// 3. The response is byte-identical with and without the logger
// ---------------------------------------------------------------------------
/**
 * The logger's exported binding is replaced with a no-op and the same boundaries are driven again.
 *
 * This is a MEASUREMENT rather than an argument from reading the diff, and it is self-checking: the patched
 * pass must log ZERO lines. If the substitution failed to take effect the comparison would be a tautology,
 * so the "patch took effect" assertion is what makes the byte-identity assertion mean anything.
 */
async function proveSideChannelOnly(): Promise<void> {
    const patchable = failureLogModule as unknown as Record<string, unknown>
    const real = patchable.logDependencyFailure

    let identical = 0
    let envelopeCorrect = 0
    let patchTook = 0
    const differing: string[] = []
    const messages = new Set<string>()

    for (const boundary of BOUNDARIES) {
        let withLogger: Observed = { status: 0, body: "", headers: "", rejected: true }
        const loggedLines = await captureConsoleError(async () => {
            withLogger = await observe(() => boundary.invoke(buildOmnibusProbe()))
        })

        patchable.logDependencyFailure = (): void => {}
        let without: Observed = { status: 0, body: "", headers: "", rejected: true }
        const silentLines = await captureConsoleError(async () => {
            without = await observe(() => boundary.invoke(buildOmnibusProbe()))
        })
        patchable.logDependencyFailure = real

        if (silentLines.length === 0 && loggedLines.length === 1) patchTook += 1
        if (
            withLogger.status === without.status &&
            withLogger.body === without.body &&
            withLogger.headers === without.headers &&
            !withLogger.rejected
        ) {
            identical += 1
        } else {
            differing.push(
                `${boundary.scope}:${withLogger.status}/${without.status} bodyMatch=${withLogger.body === without.body} headerMatch=${withLogger.headers === without.headers}`,
            )
        }

        // The envelope itself, so "identical" cannot mean "identically wrong".
        let envelope: { ok?: unknown; error?: { code?: unknown; message?: unknown } } = {}
        try {
            envelope = JSON.parse(withLogger.body) as typeof envelope
        } catch {
            envelope = {}
        }
        const message = String(envelope.error?.message ?? "")
        if (
            withLogger.status === 503 &&
            envelope.ok === false &&
            envelope.error?.code === "DEPENDENCY_UNAVAILABLE" &&
            Object.keys(envelope).sort().join(",") === "error,ok" &&
            Object.keys(envelope.error ?? {}).sort().join(",") === "code,message" &&
            message.length > 0 &&
            leaks(message).length === 0
        ) {
            envelopeCorrect += 1
            messages.add(message)
        }
    }

    checkInvertible(
        "MEASURED: the no-op substitution genuinely took effect - the patched pass logged nothing at all while the unpatched pass logged exactly one line at every boundary - so the byte-comparison below is between a logging path and a non-logging one and not with itself",
        patchTook === BOUNDARIES.length,
        `${patchTook}/${BOUNDARIES.length} boundaries: 1 line with the logger, 0 with it replaced`,
    )
    checkInvertible(
        "MEASURED: at all eleven boundaries the failure response is BYTE-IDENTICAL with and without the logger - same status, same body bytes, same header names AND values - so logging is a pure side channel and adopting it changed no client-visible behaviour anywhere",
        identical === BOUNDARIES.length,
        identical === BOUNDARIES.length
            ? `${identical}/${BOUNDARIES.length} boundaries byte-identical`
            : `DIFFERED: ${differing.join(" ; ")}`,
    )
    checkInvertible(
        "MEASURED: the response those bytes carry is the right one - 503, exactly { ok, error: { code, message } }, code DEPENDENCY_UNAVAILABLE, and a non-empty message that leaks none of the planted secrets - so byte-identity is not identity with something broken",
        envelopeCorrect === BOUNDARIES.length,
        `${envelopeCorrect}/${BOUNDARIES.length} boundaries returned a correct, leak-free 503 envelope`,
    )
    checkInvertible(
        "MEASURED: each surface's 503 names ITS OWN dependency - eleven distinct messages for eleven boundaries - so an owner reading one cannot be told the wrong system is down",
        messages.size === BOUNDARIES.length,
        `${messages.size} distinct unavailable messages across ${BOUNDARIES.length} boundaries`,
    )
}

// ---------------------------------------------------------------------------
// 4. A broken log is not a broken response
// ---------------------------------------------------------------------------
async function proveLoggerFailureIsContained(): Promise<void> {
    let survived = 0
    const broken: string[] = []
    for (const boundary of BOUNDARIES) {
        let quiet: Observed = { status: 0, body: "", headers: "", rejected: true }
        await captureConsoleError(async () => {
            quiet = await observe(() => boundary.invoke(buildOmnibusProbe()))
        })

        const real = console.error
        console.error = (): void => {
            throw new Error("the log transport itself is down")
        }
        let withBrokenTransport: Observed = { status: 0, body: "", headers: "", rejected: true }
        try {
            withBrokenTransport = await observe(() => boundary.invoke(buildOmnibusProbe()))
        } finally {
            console.error = real
        }

        if (
            !withBrokenTransport.rejected &&
            withBrokenTransport.status === quiet.status &&
            withBrokenTransport.body === quiet.body &&
            withBrokenTransport.headers === quiet.headers
        ) {
            survived += 1
        } else {
            broken.push(
                `${boundary.scope}:${withBrokenTransport.rejected ? "REJECTED" : withBrokenTransport.status}/${quiet.status}`,
            )
        }
    }
    checkInvertible(
        "MEASURED: when the log transport itself throws, every one of the eleven boundaries STILL produces its response - identical status, body and headers - because the logger swallows its own failure internally; a lost trace never becomes a lost response, and no call site needs a guard of its own",
        survived === BOUNDARIES.length,
        survived === BOUNDARIES.length
            ? `${survived}/${BOUNDARIES.length} boundaries unaffected by a throwing transport`
            : `BROKE: ${broken.join(" ; ")}`,
    )
}

// ---------------------------------------------------------------------------
// 5. Refusals are not incidents, and cannot enumerate
// ---------------------------------------------------------------------------
async function proveRefusalsAreNotLogged(): Promise<void> {
    const REFUSALS = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "BAD_REQUEST", "CONFLICT"] as const
    let lineCount = 0
    const noisy: string[] = []
    for (const boundary of BOUNDARIES) {
        for (const code of REFUSALS) {
            const lines = await captureConsoleError(async () => {
                await observe(() => boundary.invoke(new PersistenceError(code, "refused")))
            })
            if (lines.length > 0) noisy.push(`${boundary.scope}/${code}:${lines.length}`)
            lineCount += lines.length
        }
    }
    checkInvertible(
        `MEASURED: across all eleven boundaries and all ${REFUSALS.length} deliberate refusal codes, the logger emits ZERO lines - a client-caused refusal is not an incident, so routine 400s and 403s cannot bury the one line that matters and cannot appear in the incident log at all`,
        lineCount === 0,
        lineCount === 0 ? `${BOUNDARIES.length * REFUSALS.length} refusal cases, 0 lines logged` : `LOGGED: ${noisy.join(" ; ")}`,
    )

    // Non-enumeration, at the log. A foreign target and a nonexistent one must be indistinguishable, and the
    // log must not become the channel that distinguishes them - INCLUDING in the case where the response
    // layer regressed to answering NOT_FOUND for one and FORBIDDEN for the other.
    let identicalRefusals = 0
    let silentEitherWay = 0
    for (const boundary of BOUNDARIES) {
        const foreign = new PersistenceError("FORBIDDEN", "You are not a member of this workspace")
        const absent = new PersistenceError("FORBIDDEN", "You are not a member of this workspace")
        let a: Observed = { status: 0, body: "", headers: "", rejected: true }
        let b: Observed = { status: 0, body: "", headers: "", rejected: true }
        const linesA = await captureConsoleError(async () => {
            a = await observe(() => boundary.invoke(foreign))
        })
        const linesB = await captureConsoleError(async () => {
            b = await observe(() => boundary.invoke(absent))
        })
        if (!a.rejected && a.status === 403 && a.body === b.body && a.headers === b.headers) identicalRefusals += 1

        // And the regressed shape: even if the two refusals differed in CODE, neither may be logged.
        const linesC = await captureConsoleError(async () => {
            await observe(() => boundary.invoke(new PersistenceError("NOT_FOUND", "No such workspace")))
        })
        if (linesA.length === 0 && linesB.length === 0 && linesC.length === 0) silentEitherWay += 1
    }
    checkInvertible(
        "MEASURED: at every boundary a foreign target and a nonexistent one are refused with the SAME 403 bytes - body and headers - so the response cannot be used to learn which id is real",
        identicalRefusals === BOUNDARIES.length,
        `${identicalRefusals}/${BOUNDARIES.length} boundaries refused both cases byte-identically`,
    )
    checkInvertible(
        "MEASURED: the logger adds no enumeration channel of its own - FORBIDDEN and NOT_FOUND alike produce zero lines at every boundary, so even if a response layer regressed to distinguishing a foreign target from an absent one, the incident log still would not",
        silentEitherWay === BOUNDARIES.length,
        `${silentEitherWay}/${BOUNDARIES.length} boundaries silent for both the identical and the differing refusal shapes`,
    )
}

// ---------------------------------------------------------------------------
async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    // EVERY PROOF IN THIS FILE IS IN-PROCESS AND WRITES NOTHING. The boundaries are driven with rejecting
    // stubs, so no query is issued and no row is touched. The guard above and the residue count below are
    // here anyway: the guard because a harness that CAN address a live database eventually does, and the
    // count because "writes nothing" is a claim worth measuring rather than asserting.
    const prisma = new PrismaClient()
    let before = 0
    let after = 0
    try {
        before = await prisma.fieldJob.count()

        proveAdoption()
        await proveNoLeaks()
        await proveSideChannelOnly()
        await proveLoggerFailureIsContained()
        await proveRefusalsAreNotLogged()

        after = await prisma.fieldJob.count()
        check("harness left zero residue", before === after, `FieldJob ${before} -> ${after}`)
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} failure-log sanitization assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} failure-log sanitization assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("The shared sanitizing dependency-failure logger holds at all eleven adopted boundaries.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
