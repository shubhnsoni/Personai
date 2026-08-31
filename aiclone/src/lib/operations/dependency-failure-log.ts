/**
 * THE SANITIZING DEPENDENCY-FAILURE LOGGER FOR THE PLATFORM'S HTTP BOUNDARIES.
 *
 * Extracted verbatim from `due-work-http.ts`, where it grew up, and moved here so the OTHER operations
 * boundary could share it rather than re-inventing it. Eleven surfaces now answer 503
 * DEPENDENCY_UNAVAILABLE when their dependency falls over, and every one of them needs the same thing on
 * the failure path: a server-side trace that is USEFUL to an operator and yet cannot carry a secret.
 *
 * WHY IT STILL LIVES IN `operations/`, AND WHAT CHANGED. This header used to argue for the narrow home:
 * "its only two callers are the two operations boundaries ... A top-level `http/` module would advertise a
 * platform-wide logging utility that the five other surfaces (business-os install/preview/workspace-
 * surface, field jobs, cases) ought to adopt - a broader claim than this change makes, and one that would
 * invite the next person to wire it in without the leak proofs those surfaces would each need."
 *
 * Those surfaces have now been wired in WITH the leak proofs, so the objection has been discharged rather
 * than waived - see `scripts/one-off/check-failure-log-sanitization.ts`, which proves, per boundary, that
 * the response is byte-identical with and without the logger, that no planted secret survives at any depth
 * of the cause chain, that an authorization refusal is still not logged, and that a mutation to either the
 * redaction rules or the internal swallow turns the harness red. What did NOT change is the file's path:
 * moving it would rewrite eleven import lines and every reference in this program's records for a naming
 * preference, and the module has no dependency on `operations/` (it imports `PersistenceError` and nothing
 * else), so nothing about the location constrains who may call it. The one thing eleven callers DID require
 * is that the scope label stop being a convention and become a checked shape - see `safeScope`.
 *
 * THE CALLERS, EACH A SINGLE CENTRAL FAILURE FUNNEL IN ITS BOUNDARY FILE:
 *   `[operations/today]`                  operations/http.ts
 *   `[operations/due-work]`               operations/due-work-http.ts
 *   `[fieldjobs]`                         fieldjobs/http.ts
 *   `[cases]`                             cases/http.ts
 *   `[cohorts]`                           cohorts/http.ts
 *   `[commerce]`                          commerce/http.ts
 *   `[inventory]`                         inventory/http.ts
 *   `[appointments]`                      appointments/http.ts
 *   `[business-os/install]`               business-os/install-http.ts
 *   `[business-os/preview]`               business-os/preview-http.ts
 *   `[business-os/workspace-surface]`     business-os/workspace-surface-http.ts
 *
 * Every one of those boundaries answers a non-`PersistenceError` with 503 DEPENDENCY_UNAVAILABLE, which is
 * what makes `MESSAGE_BODY` below true at all eleven call sites rather than at two. A surface that answered
 * 500, or that returned an envelope of a different shape, would need the message parameterised before it
 * could adopt this, and the route-level provider integrations that do exactly that were deliberately left
 * alone rather than made to carry a log line that misdescribes their own response.
 *
 * Nothing here reaches the client. `failure(...)` already produces the leak-free 503; this is the SERVER
 * log that sits beside it. The two halves are independent: logging is a side channel and must never
 * change the response, and must never break it either - see `logDependencyFailure`.
 *
 * -------------------------------------------------------------------------------------------------
 * THE DEFECT THIS EXISTS TO PREVENT. The first version of the caller passed the whole error object to
 * `console.error`. The client 503 was generic and leak-free - and asserted to be - but the SERVER log
 * printed whatever the driver had put in the error, and a driver that puts a connection string in an
 * error message therefore wrote a live DSN into the log: credentials, host, port, database and query
 * string, in full.
 *
 * IT IS AN ALLOWLIST, NOT A REDACTOR, AND THAT IS THE WHOLE DESIGN DECISION. The tempting fix is to keep
 * logging `error.message` and scrub secrets out of it with a pattern. That loses, and keeps losing: it
 * has to anticipate every shape every current and future driver might use, and the moment one formats a
 * DSN differently the scrubber passes it through and nobody notices, because the log is not read until an
 * incident. So the message is not logged AT ALL, and the only things logged are fields chosen for being
 * structurally incapable of carrying a payload:
 *
 *   kind    the error's constructor name, bounded to an identifier - "TypeError", "PrismaClient...".
 *   code    a driver code, and only if it is a bare short token - "ECONNREFUSED", "P1001". A DSN cannot
 *           pass that test: it contains ":", "/", "@" and "=", every one of which the pattern rejects.
 *   causes  the same two fields for each link of the `cause` chain and each branch of an
 *           AggregateError, to a bounded depth. Kind and code ONLY, through the same two functions, so a
 *           cause is subject to exactly the guarantee the top-level error is - see `causeTrail`.
 *   frames  stack lines, taken from AFTER the message. `error.stack` begins with a header of the form
 *           "Name: message", which is where the secret lives, so the text of the message is cut off by
 *           its own extent before the frame filter runs - see `safeFrames`.
 *
 * The redactor below runs over the kept frames anyway. It is defence in depth on an allowlist, not the
 * mechanism the guarantee rests on - which is the argument for making it PRECISE rather than blunt.
 *
 * STILL A USEFUL LOG, WHICH IS A REQUIREMENT AND NOT A NICETY. A sanitizer that logs nothing is not a
 * fix, it is the original defect wearing a different face - the outage would again be untraceable. `kind`
 * plus the top frames answer exactly the question this log exists to answer: a TypeError inside the pure
 * composition is a defect and retrying cannot help, a connection error at the driver boundary is an
 * outage and retrying can.
 *
 * AND THE TOP-LEVEL KIND ALONE INVERTED THAT ANSWER, WHICH IS WHY `cause` IS WALKED. Modern drivers wrap.
 * `undici` - the fetch implementation Node ships and Prisma's HTTP paths use - raises
 * `TypeError: fetch failed` and puts the real failure in `cause`, so a refused connection would arrive as
 * `kind: "TypeError", code: null`. `AggregateError` does the same differently: its own `code` is unset
 * and every real error sits in `.errors`. So the chain is followed, and NOTHING new is trusted in the
 * process: each link's kind and code go through the same two functions and patterns as the top-level
 * error, and no link's MESSAGE is read at any depth.
 */
import { PersistenceError } from "@/lib/persistence/errors"

const MAX_LOGGED_FRAMES = 4
const MAX_FRAME_CHARS = 200

/**
 * A URI inside a frame, split into the three parts that have different answers.
 *
 * scheme, then the AUTHORITY (everything between "//" and the next "/", "?", "#" or whitespace - which
 * is userinfo, host and port, i.e. every part of a URI that can carry a credential), then the tail.
 */
const FRAME_URI = /([a-z][a-z0-9+.-]*):\/\/([^\s/?#\\]*)([^\s]*)/gi

/**
 * What has to survive the query rule, matched at the END of a URI's tail: an optional `:line` or
 * `:line:column`, then any closing brackets. A frame's position is the reason the frame is logged, and
 * the bracket matters too - dropping it turned `(...)` into `(...` and made the line look truncated.
 * Both groups may be empty, so this always matches and the reattachment needs no special case.
 */
const LINE_COLUMN_TAIL = /((?::\d+){0,2})([)\]]*)$/

/**
 * A credential-bearing keyword and ITS VALUE, replaced as ONE span rather than key-then-value.
 *
 * This is the keyword-form DSN rule, and it covers the two forms that use `key=value`: libpq
 * (`host=db port=5432 user=admin password=...`) and ADO.NET (`Server=x;Database=y;Password=...;`). The
 * whole pair goes, keyword included - a log line that still says `password=` has already told a reader
 * that a credential was in it.
 *
 * THE GO MYSQL FORM `user:pass@tcp(host:3306)/db` IS DELIBERATELY NOT MATCHED IN GENERAL. The pattern
 * that would catch a bare `user:pass@` userinfo outside a URI is `\S+:\S+@`, and that matches ordinary
 * frame text - it would eat a drive letter, a path and a scoped package name. The `@tcp(...)`/`@unix(...)`
 * anchor below is narrow enough to be safe and consumes the host and port with the userinfo.
 *
 * THE `=` IS REQUIRED, OR A QUOTE BEFORE A `:`. `\btoken\s*:` also matches frame text - a path segment
 * ending in one of these words followed by its line number - and collapsing that would cost the position.
 * Every keyword DSN form uses `=`; the quoted-colon branch covers a serialised `"password":"..."`.
 *
 * `authorization` WAS ADDED WHEN THE LEAK PROOFS WERE WIDENED FROM TWO BOUNDARIES TO ELEVEN, and it is
 * held to the same `=`-or-quoted-colon requirement as every other keyword, so `at authorization (file:...)`
 * is untouched and only a serialised header pair is collapsed. It buys the `"authorization":"Bearer ..."`
 * shape that a serialised provider request carries.
 */
const SECRET_KEYWORD_PAIR =
    /\b(?:password|passwd|pwd|pgpassword|secret|token|apikey|api_key|accesskey|access_key|auth_token|authorization|credential)(?:\s*["']?\s*=|["']\s*:)\s*["']?[^\s"',;&)}\]]*/gi
const DRIVER_USERINFO = /[^\s:@/(),;'"]+:[^\s:@/(),;'"]+@(?:tcp|unix)\([^)\s]*\)/gi

/**
 * THE RFC 6750 BEARER FORM, which is the one credential shape that had no keyword to hang off.
 *
 * MEASURED against the rules above before it was added: `Bearer sk_live_abc123...` inside a frame matched
 * NONE of them. It is not a URI, so the authority rule does not see it; there is no `=` and no quoted `:`,
 * so the keyword rule does not see it either - `authorization` in `Authorization: Bearer x` is followed by a
 * BARE colon, which that rule deliberately refuses because a bare `keyword:` is also what a path segment
 * followed by a line number looks like. So a token in that form would have been logged verbatim. It is the
 * shape an SDK most often puts in front of a credential, and it is now its own rule.
 *
 * NARROW ON PURPOSE, so it cannot eat a function name. The token must be 8+ characters drawn from the
 * base64url/JWT alphabet and must follow the literal word with whitespace, so `at bearer (file:...)` does
 * not match - `(` is outside the class and the quantifier needs eight characters - and neither does
 * `at bearerToken (...)`, which has no whitespace. A frame's `(file:line:col)` sits after the match either
 * way, so the position this log exists to report survives.
 */
const BEARER_CREDENTIAL = /\bbearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi

/**
 * Defence in depth over the allowlisted fields, NARROWED so that it stops destroying the evidence.
 *
 * For a matched URI: the authority - userinfo, host and port together, which is every part that can carry
 * a credential - becomes one marker; the path tail is KEPT; the query is dropped, and only the query OF
 * THAT URI, with any trailing `:line:col` reattached. "//" is not written back, so a frame can no longer
 * contain a complete URI even in redacted form, and the harnesses can go on asserting that no `scheme://`
 * appears in the log at all.
 *
 * This is a defence-in-depth pass over fields an allowlist has already made safe: a blunt rule here buys
 * nothing the allowlist has not already bought, and pays for it in the only evidence the log has.
 */
function redact(text: string): string {
    // Every pattern here is module-level and global, and every use of one is `String.prototype.replace`,
    // which starts at 0 and resets `lastIndex` when it finishes. `LINE_COLUMN_TAIL` is the one read with
    // `exec` and it deliberately carries no `g` flag, so it holds no position between calls. This
    // repository has already lost a gate driver to an `exec` loop over a shared global regex that
    // `replace` kept rewinding; the same mistake is available here and is avoided by construction.
    return text
        .replace(FRAME_URI, (_match, scheme: string, authority: string, tail: string) => {
            const head = `${scheme}:${authority === "" ? "" : "<redacted-authority>"}`
            const query = tail.indexOf("?")
            if (query < 0) return `${head}${tail}`
            const position = LINE_COLUMN_TAIL.exec(tail.slice(query))
            return `${head}${tail.slice(0, query)}<redacted-query>${position === null ? "" : `${position[1]}${position[2]}`}`
        })
        .replace(DRIVER_USERINFO, "<redacted-authority>")
        .replace(SECRET_KEYWORD_PAIR, "<redacted-credential>")
        .replace(BEARER_CREDENTIAL, "<redacted-credential>")
}

/**
 * THE SCOPE LABEL, NOW A CHECKED SHAPE RATHER THAN A CONVENTION - because there are eleven callers.
 *
 * `scope` is the only caller-supplied text that reaches the log, and with two call sites the argument for
 * trusting it was inspection: both were fixed literals, neither was derived from a request, and both were
 * in the same directory as this file. That argument does not scale. Eleven call sites across seven
 * directories is a rule nobody enforces, and the failure mode is silent and specific: the FIRST caller to
 * write `logDependencyFailure(\`[cases/${caseId}]\`, error)` - which reads like an improvement, because a
 * per-case tag would be more useful to grep - reopens the exact defect the rest of this module exists to
 * close, and reopens it in the one field that is printed outside the JSON payload where no `frames` clip
 * or redactor pass applies to it.
 *
 * So the shape is checked, and it is checked the same way everything else here is: an ALLOWLIST of what a
 * surface tag can look like, not a scan for what a secret looks like. Bracketed, lowercase, segmented by
 * `/` or `-`, length-capped. Every character class that could carry a payload is absent by construction -
 * no `:`, `@`, `=`, `?`, `.`, `%`, quote, brace or whitespace - so a DSN, a URL, a token, a key=value pair,
 * an interpolated id and a JSON fragment are all structurally unable to pass, and a caller cannot smuggle
 * one through by formatting it differently.
 *
 * A NON-CONFORMING SCOPE BECOMES `[unknown-scope]` RATHER THAN BEING DROPPED. Dropping it would produce a
 * line whose surface cannot be identified, which is a log an operator cannot act on; substituting a fixed
 * marker keeps the line greppable and makes the mistake visible in the place most likely to be read.
 *
 * `.test` on a non-global pattern, so it holds no `lastIndex` between calls - the same care the redactor's
 * comment records, for the same reason.
 */
const SAFE_SCOPE = /^\[[a-z][a-z0-9]*(?:[/-][a-z0-9]+)*\]$/
const MAX_SCOPE_CHARS = 48
const UNKNOWN_SCOPE = "[unknown-scope]"

function safeScope(scope: unknown): string {
    if (typeof scope !== "string" || scope.length > MAX_SCOPE_CHARS) return UNKNOWN_SCOPE
    return SAFE_SCOPE.test(scope) ? scope : UNKNOWN_SCOPE
}

/** The constructor name, bounded to an identifier so a hostile or exotic name cannot become the log line. */
function errorKind(error: unknown): string {
    if (error === null) return "null"
    if (typeof error !== "object") return typeof error
    const name = (error as { constructor?: { name?: unknown } }).constructor?.name
    return typeof name === "string" && /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(name) ? name : "object"
}

/**
 * A driver code, and only when it is a bare short token. This is the one field that carries text the
 * driver chose, so the pattern is the guarantee: no ":", "/", "@", "=", whitespace or "." can pass, and
 * the length is capped at 32, so no connection string, URL or key=value pair can survive it.
 *
 * Every link of the cause chain is read through this same function, so the question "can a cause smuggle
 * something out?" has the same answer as for the top-level error.
 */
function safeCode(error: unknown): string | null {
    const code = (error as { code?: unknown } | null | undefined)?.code
    if (typeof code === "number" && Number.isInteger(code)) return String(code)
    if (typeof code !== "string") return null
    return /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(code) ? code : null
}

/**
 * THE CAUSE CHAIN, WHICH IS WHERE THE REAL FAILURE USUALLY IS.
 *
 * Walked to a bounded depth, breadth-bounded across an `AggregateError`'s `.errors`, and node-bounded in
 * total, because the shape of the chain is the driver's choice and not ours. Each link contributes
 * exactly two facts, `kind` and `code`, obtained from the same `errorKind` and `safeCode` as the
 * top-level error. NO LINK'S MESSAGE IS READ AT ANY DEPTH - not truncated, not scanned, not counted.
 *
 * A NON-OBJECT CAUSE reads nothing off the primitive: `cause` may be a bare string - what
 * `new Error(m, { cause: connectionString })` produces - and `errorKind` answers "string" (its own
 * `typeof`, never its content) while `safeCode` answers null, so the value itself has no path into the log.
 *
 * CYCLES ARE REAL. `e.cause = e` is legal, as is a diamond through `AggregateError.errors`. Every object
 * visited is remembered, so a cycle terminates instead of exhausting the stack while answering a 503.
 */
const MAX_CAUSE_DEPTH = 4
const MAX_CAUSE_NODES = 6
const MAX_AGGREGATE_BRANCHES = 3

type LoggedCause = Readonly<{ via: string; kind: string; code: string | null }>

function recordCause(node: unknown, via: string, depth: number, seen: Set<object>, out: LoggedCause[]): void {
    if (node === null || node === undefined || out.length >= MAX_CAUSE_NODES) return
    if (typeof node === "object") {
        if (seen.has(node)) return
        seen.add(node)
    }
    out.push(Object.freeze({ via, kind: errorKind(node), code: safeCode(node) }))
    expandCauses(node, `${via}.`, depth + 1, seen, out)
}

function expandCauses(node: unknown, via: string, depth: number, seen: Set<object>, out: LoggedCause[]): void {
    if (depth > MAX_CAUSE_DEPTH || out.length >= MAX_CAUSE_NODES || node === null || typeof node !== "object") return
    const bag = node as { cause?: unknown; errors?: unknown }
    // AggregateError first: `Promise.any` and a multi-address connect both report every attempt here,
    // and the top-level AggregateError's own code is unset, so this array IS the diagnosis.
    const branches: unknown = bag.errors
    if (Array.isArray(branches)) {
        for (const [position, branch] of branches.slice(0, MAX_AGGREGATE_BRANCHES).entries()) {
            recordCause(branch, `${via}errors[${position}]`, depth, seen, out)
        }
    }
    recordCause(bag.cause, `${via}cause`, depth, seen, out)
}

function causeTrail(error: unknown): LoggedCause[] {
    const out: LoggedCause[] = []
    const seen = new Set<object>()
    if (error !== null && typeof error === "object") seen.add(error)
    expandCauses(error, "", 0, seen, out)
    return out
}

/**
 * The stack's FRAME lines, taken from after the message.
 *
 * V8's header is `${name}: ${message}`, and a message may contain newlines, so a multi-line message
 * occupies lines 1..k; a `/^\s*at\s/` filter on its own would drop only line one, and a continuation line
 * that happens to begin with "at " would be RETAINED as though it were a frame. So the header is cut by
 * the MESSAGE'S OWN EXTENT before the filter runs: the message is located in the stack and everything up
 * to the end of it is discarded, which removes every line the message occupies rather than the first one.
 *
 * When the message cannot be located in the stack - a driver that rewrote `stack`, an engine that formats
 * it differently - this falls back to the shape filter alone, and in THAT case the `at `-continuation
 * line is retained. The fallback is the old behaviour and the old limitation, and the redactor and the
 * 200-character clip are what stand behind it.
 */
const MAX_MESSAGE_HEADER_CHARS = 512

function safeFrames(error: unknown): { kept: string[]; total: number; headerCut: boolean } {
    const stack = (error as { stack?: unknown } | null | undefined)?.stack
    if (typeof stack !== "string") return { kept: [], total: 0, headerCut: false }
    const message = (error as { message?: unknown } | null | undefined)?.message
    let body = stack
    let headerCut = false
    if (typeof message === "string" && message.length > 0) {
        const at = stack.indexOf(message)
        if (at >= 0 && at <= MAX_MESSAGE_HEADER_CHARS) {
            body = stack.slice(at + message.length)
            headerCut = true
        }
    }
    const frames = body.split("\n").filter((line) => /^\s*at\s/.test(line))
    return {
        kept: frames.slice(0, MAX_LOGGED_FRAMES).map((line) => redact(line.trim()).slice(0, MAX_FRAME_CHARS)),
        total: frames.length,
        headerCut,
    }
}

/**
 * The body of the log line, shared by every scope. Scope-neutral on purpose: it read "preview failed ...
 * plan composition" when this lived in `due-work-http.ts`, and those two words were the only thing tying
 * it to that one surface. The operations view is not a preview and composes no plan, so they are dropped;
 * every substring the harnesses pin - the scope tag supplied by the caller, and "DEPENDENCY_UNAVAILABLE"
 * - and the entire JSON payload are unchanged.
 */
const MESSAGE_BODY =
    "dependency call failed and answered 503 DEPENDENCY_UNAVAILABLE; the client is told to retry, so if this " +
    "is a defect in composition rather than an unavailable dependency, retrying cannot help and this line is " +
    "the only trace of it. READ `causes` BEFORE JUDGING `kind`: a wrapped driver failure arrives as TypeError " +
    "with the real ECONNREFUSED one link down, so a bare TypeError here is not by itself a defect. The error " +
    "MESSAGE IS WITHHELD DELIBERATELY, at every depth - a driver puts connection strings in it and this log is " +
    "not the place for them; do not add it back. Kind, code, the cause chain and location are below."

/**
 * Log ONE safe line for an operations dependency failure, then let the caller answer 503.
 *
 * `scope` is the surface tag an operator greps for - `[operations/today]`, `[fieldjobs]`, `[cases]`. It is
 * the ONLY caller-supplied text that reaches the log, and it is passed through `safeScope` rather than
 * trusted: eleven call sites is too many for "it is a fixed literal at each one" to be a guarantee, so the
 * shape is checked and a non-conforming label becomes `[unknown-scope]`. All eleven current labels conform,
 * so the check is invisible to every existing caller and changes not one byte of what they log.
 *
 * ONLY THE UNEXPECTED PATH IS LOGGED. A `PersistenceError` is a deliberate, client-caused refusal - a
 * missing workspaceId, a bad horizon, a wrong method, a failed authorization - and logging those as
 * incidents would bury the one line that matters in routine 400s. It is also what keeps the log
 * NON-ENUMERATING: a foreign workspace and a nonexistent one both refuse with the same 403 PersistenceError,
 * so neither is logged and the log cannot be used to tell which id is real.
 *
 * LOGGING IS A SIDE CHANNEL AND MUST NEVER BREAK THE RESPONSE. The whole body is wrapped: if building the
 * line throws (a pathological error object) or the transport `console.error` throws, it is swallowed here
 * so a failure to LOG can never turn into a failure to RESPOND. Callers therefore need no guard of their
 * own - the guarantee lives in one place and cannot be forgotten at a call site.
 */
export function logDependencyFailure(scope: string, error: unknown): void {
    if (error instanceof PersistenceError) return
    try {
        const { kept, total, headerCut } = safeFrames(error)
        const messageChars =
            typeof (error as { message?: unknown } | null | undefined)?.message === "string"
                ? String((error as { message: string }).message).length
                : 0
        console.error(
            `${safeScope(scope)} ${MESSAGE_BODY}`,
            JSON.stringify({
                kind: errorKind(error),
                code: safeCode(error),
                causes: causeTrail(error),
                messageChars,
                messageHeaderCut: headerCut,
                framesKept: kept.length,
                framesTotal: total,
                frames: kept,
            }),
        )
    } catch {
        // A logging side channel must never break the response it annotates. If the line cannot be built
        // or emitted, the caller still answers 503; a lost trace is strictly better than a lost response.
    }
}
