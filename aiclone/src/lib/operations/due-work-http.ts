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
 *   frames  stack lines only. `error.stack` begins "Name: message", which is where the secret lives, so
 *           only lines matching a frame are kept and that header line is dropped by construction
 *
 * The redactor below runs over the kept frames anyway. It is defence in depth on an allowlist, not the
 * mechanism the guarantee rests on.
 *
 * THIS IS STILL A USEFUL LOG, WHICH IS A REQUIREMENT AND NOT A NICETY. A sanitizer that logs nothing is
 * not a fix, it is the original defect wearing a different face - the outage would again be untraceable.
 * `kind` plus the top frames answer exactly the question this log exists to answer: a TypeError inside
 * due-work-plan.ts is a defect and retrying cannot help, a connection error at the driver boundary is an
 * outage and retrying can. That was the stated purpose of the log, and the DSN never served it.
 */
const MAX_LOGGED_FRAMES = 4
const MAX_FRAME_CHARS = 200

/**
 * Defence in depth over the allowlisted fields. Any URI-shaped run of text loses everything after its
 * scheme, so credentials, host, port, path and query go together rather than one pattern per part; then
 * any surviving query string is dropped. Deliberately blunt - it runs over frame lines, where a URI has
 * no legitimate reason to appear in the first place.
 */
function redact(text: string): string {
    return text.replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, "<redacted-uri>").replace(/\?\S*/g, "<redacted-query>")
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
 */
function safeCode(error: unknown): string | null {
    const code = (error as { code?: unknown } | null | undefined)?.code
    if (typeof code === "number" && Number.isInteger(code)) return String(code)
    if (typeof code !== "string") return null
    return /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(code) ? code : null
}

/**
 * The stack's FRAME lines only. V8 puts "Name: message" on line one, so filtering to lines that match a
 * frame is what drops the message - the secret is excluded by the shape of the filter rather than by a
 * pattern that has to recognise it.
 */
function safeFrames(error: unknown): { kept: string[]; total: number } {
    const stack = (error as { stack?: unknown } | null | undefined)?.stack
    if (typeof stack !== "string") return { kept: [], total: 0 }
    const frames = stack.split("\n").filter((line) => /^\s*at\s/.test(line))
    return {
        kept: frames.slice(0, MAX_LOGGED_FRAMES).map((line) => redact(line.trim()).slice(0, MAX_FRAME_CHARS)),
        total: frames.length,
    }
}

function logUnexpectedFailure(error: unknown): void {
    if (error instanceof PersistenceError) return
    const { kept, total } = safeFrames(error)
    const messageChars = typeof (error as { message?: unknown } | null | undefined)?.message === "string"
        ? String((error as { message: string }).message).length
        : 0
    console.error(
        "[operations/due-work] preview failed and answered 503 DEPENDENCY_UNAVAILABLE; the client is told to retry, " +
            "so if this is a defect in the plan composition rather than an unavailable dependency, retrying cannot help " +
            "and this line is the only trace of it. The error MESSAGE IS WITHHELD DELIBERATELY - a driver puts connection " +
            "strings in it and this log is not the place for them; do not add it back. Kind, code and location are below.",
        JSON.stringify({
            kind: errorKind(error),
            code: safeCode(error),
            messageChars,
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
