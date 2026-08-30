/**
 * HTTP boundary for the explicitly invoked DUE-WORK PREVIEW.
 *
 * Deliberately a separate file from `./http.ts` rather than a second method on `OperationsApiService`.
 * The operations view answers "what is waiting?"; this surface answers "in what order would you deal
 * with it?" and carries a much stronger set of promises - no write, no provider, no background
 * execution, and a wording rule. Those promises are asserted against THIS file by name, and a reviewer
 * asking "what is allowed to happen when a preview is requested?" should have one small file to read.
 *
 * There is exactly ONE method and it is a GET, and that is structural rather than a policy. A POST here
 * would be the first step from "preview" to "trigger": the handler would exist, and the next change
 * would give it something to do. So no write verb is exported, and the harness asserts the absence.
 *
 * THAT ARGUMENT IS ABOUT THE ROUTE MODULE, AND THE ROUTE MODULE IS NOT THE ONLY CALLER. `dueWorkApi` is an
 * exported singleton; anything that imports it can call `.preview` from a handler of any verb, and the
 * paragraph above would still be a true statement about the route file while the guarantee had gone. So
 * `preview` also refuses a non-GET request itself, with 405 and an `Allow` header - see
 * `requireReadMethod` below.
 *
 * This file COMPOSES and does not decide. Authorization, the horizon bounds and the clock all belong to
 * `OperationsService.summary`; the ordering and its explanations all belong to `planDueWork`; the
 * boundary shape belongs to `toDueWorkPreview`. Re-deriving any of them here would duplicate a
 * judgement that already has an owner, and the copies would drift.
 */
import { failure, success } from "@/lib/fieldjobs/http"
import { PersistenceError } from "@/lib/persistence/errors"

import { planDueWork } from "./due-work-plan"
import { toDueWorkPreview, type DueWorkPreview } from "./due-work-preview-types"
import type { OperationsService } from "./engine"

function param(request: Request, name: string): string {
    const value = new URL(request.url).searchParams.get(name)
    if (typeof value !== "string" || !value.trim()) {
        throw new PersistenceError("BAD_REQUEST", `${name} is required`, { field: name })
    }
    return value.trim()
}

function optIntParam(request: Request, name: string): number | null {
    const raw = new URL(request.url).searchParams.get(name)
    if (raw === null || raw === "") return null
    if (!/^\d+$/.test(raw)) {
        throw new PersistenceError("BAD_REQUEST", `${name} must be a whole number`, { field: name })
    }
    return Number(raw)
}

/**
 * THE PERMITTED METHOD SET, in ONE place, because the refusal and the `Allow` header must not drift.
 *
 * On a 405, `Allow` is not decoration - it is the half of the answer that tells the caller what to do
 * instead. Written as its own separate string literal it could come to disagree with the check that
 * produced the refusal, and a header naming a method the surface actually refuses is worse than no
 * header: it sends the caller to a second failure. So the check below and the header both read this.
 *
 * It is exactly GET, and HEAD is deliberately absent even though HEAD would be defensible on a
 * read-only surface. The route module exports no HEAD handler and `requireReadMethod` refuses it, so
 * listing it here would be a claim this surface does not honour.
 */
const ALLOWED_METHODS: readonly string[] = Object.freeze(["GET"])
const ALLOW_HEADER_VALUE = ALLOWED_METHODS.join(", ")
const METHOD_REFUSAL_HEADERS: Readonly<Record<string, string>> = Object.freeze({ Allow: ALLOW_HEADER_VALUE })

/**
 * THE READ-ONLY GUARANTEE, ENFORCED HERE AND NOT ONLY IN THE ROUTE FILE.
 *
 * The header above argues that this surface cannot be written to because the route module exports no
 * write verb. That argument is true of ONE file. `dueWorkApi` is an exported singleton, so any future
 * module - a second route, a server action, an internal caller - can import it and call `.preview(req)`
 * from a POST handler and get a working write-verb endpoint. The structural argument would still read as
 * true in this file while the property it protects had quietly gone. So the method is checked where the
 * work happens, and the check runs BEFORE the parameter reads, so a POST is refused as a method problem
 * rather than reported as a missing workspaceId.
 *
 * 405, WHICH REPLACES A DOCUMENTED COMPROMISE. This refused with 400 and carried a comment explaining
 * that 405 was the correct answer but was unreachable: `PersistenceErrorCode` had no METHOD_NOT_ALLOWED
 * member, and the two ways to reach one from here were both bad - widen the platform-wide union from
 * inside a due-work fix, or hand-build a Response that bypassed `failure` and so bypassed the one
 * property this surface's harness asserts most often, that every refusal is the same envelope. The
 * member now exists in the file that OWNS the vocabulary, and `failure` now carries a header without
 * touching the body, so neither compromise is required and the honest status is the one returned.
 *
 * It is deliberately NOT 403 either. On this surface 403 already means "not a member of that workspace",
 * and a foreign workspace and a nonexistent one are asserted to refuse byte-identically so that the
 * status cannot be used to enumerate real ids. Putting an unrelated meaning behind that status would
 * blunt an assertion that is doing real work.
 */
function requireReadMethod(request: Request): void {
    const method = request.method.toUpperCase()
    if (!ALLOWED_METHODS.includes(method)) {
        throw new PersistenceError(
            "METHOD_NOT_ALLOWED",
            "The due-work plan is read with GET. This surface accepts no other method, because a plan is a read and nothing here acts.",
            { method, allow: ALLOW_HEADER_VALUE },
        )
    }
}

/**
 * The `Allow` header for a method refusal, and nothing else ever gets one.
 *
 * Deriving this here rather than inside `failure` is the point: `failure` is shared by every surface on
 * this platform and cannot know which methods any of them permit. It carries a header; this decides what
 * the header says. Every other failure - 400, 401, 403, 503 - returns undefined and therefore takes
 * `failure`'s unchanged no-header path.
 */
function methodRefusalHeaders(error: unknown): Readonly<Record<string, string>> | undefined {
    return error instanceof PersistenceError && error.code === "METHOD_NOT_ALLOWED" ? METHOD_REFUSAL_HEADERS : undefined
}

/**
 * SERVER-SIDE TRACE FOR THE FAILURE PATH. Nothing here reaches the client.
 *
 * Before this, every error was swallowed into `failure` with no trace at all, which is wrong in two
 * separate ways. A real dependency outage left nothing on the server to find it by. And a defect in the
 * pure `planDueWork` or `toDueWorkPreview` - a thrown TypeError, say - is indistinguishable from an outage
 * once it has been mapped to 503 DEPENDENCY_UNAVAILABLE, so the client is told to retry something that
 * will never succeed and nobody is told why.
 *
 * Only the UNEXPECTED path is logged. A `PersistenceError` is a deliberate, client-caused refusal - a
 * missing workspaceId, a bad horizon, a wrong method, a failed authorization - and logging those as
 * incidents would bury the one line that matters in routine 400s.
 *
 * THE DEFECT THIS NOW FIXES. The first version passed the whole error object to `console.error`. The
 * client 503 was generic and leak-free, and asserted to be - but the SERVER log printed whatever the
 * driver had put in the error, and a driver that puts a connection string in an error message therefore
 * wrote a live DSN into the log. That was not hypothetical: the harness injects a fake DSN and observed
 * it printed in full, credentials, host, port, database and query string.
 *
 * IT IS AN ALLOWLIST, NOT A REDACTOR, AND THAT IS THE WHOLE DESIGN DECISION. The tempting fix is to keep
 * logging `error.message` and scrub secrets out of it with a pattern. That loses, and keeps losing: it
 * has to anticipate every shape every current and future driver might use, and the moment one formats a
 * DSN differently - or names a secret in prose the way the harness's own `SECRET_DETAIL` token does - the
 * scrubber passes it through and nobody notices, because the log is not read until an incident. So the
 * message is not logged AT ALL, and the only things logged are fields chosen here for being structurally
 * incapable of carrying a payload:
 *
 *   kind    the error's constructor name, bounded to an identifier - "TypeError", "PrismaClient..."
 *   code    a driver code, and only if it is a bare short token - "ECONNREFUSED", "P1001". A DSN cannot
 *           pass that test: it contains ":", "/", "@" and "=", every one of which the pattern rejects
 *   causes  the same two fields for each link of the `cause` chain and each branch of an
 *           AggregateError, to a bounded depth. Kind and code ONLY, through the same two functions, so
 *           a cause is subject to exactly the guarantee the top-level error is - see `causeTrail`
 *   frames  stack lines, taken from AFTER the message. `error.stack` begins with a header of the form
 *           "Name: message", which is where the secret lives, so the text of the message is cut off by
 *           its own extent before the frame filter runs. See `safeFrames` for what that does and does
 *           not guarantee - the sentence "the filter drops the message" was overstated and is corrected
 *           there
 *
 * The redactor below runs over the kept frames anyway. It is defence in depth on an allowlist, not the
 * mechanism the guarantee rests on - which is the argument for making it PRECISE rather than blunt, and
 * the reason it no longer collapses a whole frame on sight of a URI.
 *
 * WHAT THE REDACTOR DOES NOT COVER, stated because a reader would otherwise assume it did. A
 * keyword-style DSN in the libpq form `host=... port=... user=... password=...`, the ADO.NET form
 * `Server=...;Database=...;Password=...;`, or the Go MySQL form `user:pass@tcp(host:3306)/db` contains
 * no "://" and, in the first two forms, no "?" either. The URI rule cannot see any of them. The
 * credential keywords in the first two forms ARE matched by a separate keyword rule below, whole pair
 * at a time; the Go form's bare `user:pass@` userinfo is NOT matched in general, and why not is written
 * at `SECRET_KEYWORD_PAIR`. None of this is what makes the log safe: the message is not logged at all,
 * which is the only reason a DSN in a driver's prose cannot reach it.
 *
 * THIS IS STILL A USEFUL LOG, WHICH IS A REQUIREMENT AND NOT A NICETY. A sanitizer that logs nothing is
 * not a fix, it is the original defect wearing a different face - the outage would again be untraceable.
 * `kind` plus the top frames answer exactly the question this log exists to answer: a TypeError inside
 * due-work-plan.ts is a defect and retrying cannot help, a connection error at the driver boundary is an
 * outage and retrying can. That was the stated purpose of the log, and the DSN never served it.
 *
 * AND THE TOP-LEVEL KIND ALONE INVERTED THAT ANSWER, WHICH IS WHY `cause` IS NOW WALKED. Modern drivers
 * wrap. `undici` - the fetch implementation Node ships and Prisma's HTTP paths use - raises
 * `TypeError: fetch failed` and puts the real failure in `cause`, so a refused connection arrived here
 * as `kind: "TypeError", code: null`, and the prose above then told the reader that a TypeError is a
 * defect in the plan composition and that retrying cannot help. The one line written to make an outage
 * traceable was presenting the outage as a bug, with confidence. `AggregateError` did the same thing
 * differently: its own `code` is unset and every real error sits in `.errors`, which nothing read.
 *
 * So the chain is followed, and NOTHING new is trusted in the process: each link's kind and code go
 * through `errorKind` and `safeCode`, the same two functions and the same two patterns as the top-level
 * error, and no link's MESSAGE is read at any depth. A cause is a strictly better place for a driver to
 * have put a DSN than the top-level message was, so widening the allowlist to accommodate it would have
 * handed back the whole guarantee; the allowlist is unchanged.
 */
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
 * whole pair goes, keyword included - not `password=<redacted>` - because a log line that still says
 * `password=` has already told a reader that a credential was in it, and this repository asserts the
 * absence of the keyword itself, not merely of its value.
 *
 * THE GO MYSQL FORM `user:pass@tcp(host:3306)/db` IS DELIBERATELY NOT MATCHED IN GENERAL. The pattern
 * that would catch a bare `user:pass@` userinfo outside a URI is `\S+:\S+@`, and that matches ordinary
 * frame text: `at f (C:/app/node_modules/@babel/core/lib/x.js:10:5)` contains a colon, then non-space,
 * then "@", so the rule would eat the drive letter, the path and the scoped package name - destroying
 * exactly the evidence the previous blunt rule destroyed. The `@tcp(...)`/`@unix(...)` anchor below is
 * narrow enough to be safe, and it consumes the host and port with the userinfo so that form loses its
 * authority and keeps its path, like the URI rule. A userinfo with no such marker is left alone and is
 * covered by the allowlist instead, which never logs a message in the first place.
 *
 * THE `=` IS REQUIRED, OR A QUOTE BEFORE A `:`, AND THAT IS NOT FUSSINESS. `\btoken\s*:` also matches
 * frame text - a path segment ending in one of these words followed by its line number, `at f
 * (/app/token:10:5)` - and collapsing that would cost the position again. Every keyword DSN form uses
 * `=`; the quoted-colon branch covers a serialised `"password":"..."`. The residual: an unquoted
 * `password: value` written in prose is not matched here. It is not reachable through this file, because
 * the only text this runs over is stack frames and a message is never logged.
 */
const SECRET_KEYWORD_PAIR =
    /\b(?:password|passwd|pwd|pgpassword|secret|token|apikey|api_key|accesskey|access_key|auth_token|credential)(?:\s*["']?\s*=|["']\s*:)\s*["']?[^\s"',;&)}\]]*/gi
const DRIVER_USERINFO = /[^\s:@/(),;'"]+:[^\s:@/(),;'"]+@(?:tcp|unix)\([^)\s]*\)/gi

/**
 * Defence in depth over the allowlisted fields, NARROWED so that it stops destroying the evidence.
 *
 * WHAT IT USED TO DO, AND WHY THAT INVERTED ITS PURPOSE. Rule one matched a scheme, then "://", then
 * `\S` repeated to the next whitespace, and replaced the whole span with one marker. Rule two matched a
 * "?" and, again, everything to the next whitespace.
 * A frame in an ESM build is `at foo (file:///C:/app/src/lib/x.js:10:5)`, and a run of non-whitespace
 * reaches the end of the frame, so rule one replaced `file:///C:/app/src/lib/x.js:10:5)` - the file, the
 * line and the column, which are the three things this log exists to carry - with that marker. Rule two
 * did the same to any line containing a "?" at all: a bundler cache-buster `x.js?v=123:10:5` cost the
 * position too. The log kept its shape and lost its content, and it would have done that on every frame
 * of every ESM-loaded stack.
 *
 * WHAT IT DOES NOW. For a matched URI: the authority - userinfo, host and port together, which is every
 * part that can carry a credential - becomes one marker; the path tail is KEPT; the query is dropped,
 * and only the query OF THAT URI, with any trailing `:line:col` reattached. "//" is not written back, so
 * a frame can no longer contain a complete URI even in redacted form, and this file's own harness can go
 * on asserting that no `scheme://` appears in the log at all.
 *
 * This is a defence-in-depth pass over fields an allowlist has already made safe, which is the argument
 * for precision rather than bluntness: a blunt rule here buys nothing the allowlist has not already
 * bought, and pays for it in the only evidence the log has.
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
 * UNCHANGED BY THE CAUSE WORK, ON PURPOSE. Every link of the chain is read through this same function,
 * so the question "can a cause smuggle something out?" has the same answer as for the top-level error.
 * Loosening it to accommodate some driver's richer cause code would have given away the guarantee at the
 * one place a reviewer has already probed twice.
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
 * That is what makes this safe to add: a driver that puts a DSN in `cause.message` is in exactly the
 * position it was in for `error.message`, which is to say the log never sees it.
 *
 * A NON-OBJECT CAUSE IS THE INTERESTING CASE, and it is why the code below reads nothing off a
 * primitive. `cause` may be a bare string - and a driver that throws `{ cause: "<the whole DSN>" }` is
 * not a hypothetical shape, it is what a `throw new Error(msg, { cause: connectionString })` produces.
 * `errorKind` answers "string" for that (its own `typeof`, never its content) and `safeCode` answers
 * null (a string primitive has no `code` property), so the value itself has no path into the log.
 *
 * CYCLES ARE REAL. `e.cause = e` is legal, and so is a diamond through `AggregateError.errors`. Every
 * object visited is remembered, so a cycle terminates instead of exhausting the stack while answering a
 * 503.
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
 * TWO SENTENCES HERE USED TO OVERSTATE THIS, and the corrected version is the following. The
 * `/^\s*at\s/` filter on its own drops LINE ONE of the stack - it does not drop "the message". V8's
 * header is `${name}: ${message}`, and a message may contain newlines, so a multi-line message occupies
 * lines 1..k; lines 2..k are then put to the same `/^\s*at\s/` test as everything else, and a
 * continuation line that happens to begin with "at " is RETAINED as though it were a frame. Message text
 * could therefore reach the log through a message the driver wrote across several lines.
 *
 * So the header is now cut by the MESSAGE'S OWN EXTENT before the filter runs: the message is located in
 * the stack and everything up to the end of it is discarded, which removes every line the message
 * occupies rather than the first one. `indexOf` finds the header occurrence because the header is where
 * the message first appears, and the search is bounded so a message that is not in the stack at all
 * cannot cause a wild cut.
 *
 * WHAT IS STILL NOT GUARANTEED, stated rather than glossed: when the message cannot be located in the
 * stack - a driver that rewrote `stack`, an engine that formats it differently - this falls back to the
 * shape filter alone, and in THAT case the `at `-continuation line described above is retained. The
 * fallback is the old behaviour and the old limitation, no worse and no better, and the redactor and the
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

function logUnexpectedFailure(error: unknown): void {
    if (error instanceof PersistenceError) return
    const { kept, total, headerCut } = safeFrames(error)
    const messageChars = typeof (error as { message?: unknown } | null | undefined)?.message === "string"
        ? String((error as { message: string }).message).length
        : 0
    console.error(
        "[operations/due-work] preview failed and answered 503 DEPENDENCY_UNAVAILABLE; the client is told to retry, " +
            "so if this is a defect in the plan composition rather than an unavailable dependency, retrying cannot help " +
            "and this line is the only trace of it. READ `causes` BEFORE JUDGING `kind`: a wrapped driver failure arrives " +
            "as TypeError with the real ECONNREFUSED one link down, so a bare TypeError here is not by itself a defect. " +
            "The error MESSAGE IS WITHHELD DELIBERATELY, at every depth - a driver puts connection strings in it and this " +
            "log is not the place for them; do not add it back. Kind, code, the cause chain and location are below.",
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
}

export class DueWorkApiService {
    constructor(private readonly operations: OperationsService) {}

    /**
     * Explicitly invoked. One request produces one plan and nothing else happens - no row is written,
     * not even a record that the preview was requested, because that would make this a write path.
     *
     * GET ONLY, checked here rather than inferred from the route module's exports. See
     * `requireReadMethod` for why the refusal is a 405 carrying `Allow`, in the shared envelope.
     *
     * The 503 message names THIS surface. Reusing the envelope helper is correct; inheriting the other
     * surface's fallback text is not, because an owner reading "Operations are temporarily unavailable"
     * on a due-work request cannot tell which of the two is actually down.
     */
    preview(request: Request): Promise<Response> {
        return Promise.resolve()
            .then(async () => {
                requireReadMethod(request)
                const summary = await this.operations.summary(param(request, "workspaceId"), {
                    horizonHours: optIntParam(request, "horizonHours"),
                })
                const preview: DueWorkPreview = toDueWorkPreview(planDueWork(summary))
                return success(preview)
            })
            .catch((error: unknown) => {
                logUnexpectedFailure(error)
                return failure(error, "The due-work plan is temporarily unavailable", methodRefusalHeaders(error))
            })
    }
}
