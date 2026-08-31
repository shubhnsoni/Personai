/**
 * HTTP boundary for the explicitly invoked DUE-WORK PREVIEW.
 *
 * Deliberately a separate file from `./http.ts` rather than a second method on `OperationsApiService`.
 * The operations view answers "what is waiting?"; this surface answers "in what order would you deal
 * with it?" and carries a much stronger set of promises - no write, no provider, no background
 * execution, and a wording rule. Those promises are asserted against THIS file by name, and a reviewer
 * asking "what is allowed to happen when a preview is requested?" should have one small file to read.
 *
 * There is exactly ONE handler and it is a read, and that is structural rather than a policy. A POST here
 * would be the first step from "preview" to "trigger": the handler would exist, and the next change
 * would give it something to do. So no STATE-CHANGING verb is exported, and the harness asserts the absence.
 *
 * "NO STATE-CHANGING VERB" IS NOT THE SAME CLAIM AS "GET ONLY", AND THIS FILE USED TO CONFLATE THEM.
 * RFC 9110 sorts methods into SAFE and unsafe, and GET, HEAD and OPTIONS are all safe: none of them is a
 * request to change anything. The four that are unsafe here - POST, PUT, PATCH, DELETE - are the ones
 * whose absence carries the guarantee. HEAD and OPTIONS carry no such meaning, and treating them as
 * write verbs cost this surface its RFC compliance for a whole round: HEAD was refused with 405 while
 * GET answered 200 on the same URL, which RFC 9110 section 9.1 forbids outright ("all general-purpose
 * servers MUST support the methods GET and HEAD"), and the `Allow` header advertised a method set the
 * FRAMEWORK did not agree with. See THE METHOD POLICY below for the measurement that settled it.
 *
 * THAT ARGUMENT IS ABOUT THE ROUTE MODULE, AND THE ROUTE MODULE IS NOT THE ONLY CALLER. `dueWorkApi` is an
 * exported singleton; anything that imports it can call `.preview` from a handler of any verb, and the
 * paragraph above would still be a true statement about the route file while the guarantee had gone. So
 * `preview` also refuses a state-changing request itself, with 405 and an `Allow` header - see
 * `requireAllowedMethod` below.
 *
 * This file COMPOSES and does not decide. Authorization, the horizon bounds and the clock all belong to
 * `OperationsService.summary`; the ordering and its explanations all belong to `planDueWork`; the
 * boundary shape belongs to `toDueWorkPreview`. Re-deriving any of them here would duplicate a
 * judgement that already has an owner, and the copies would drift.
 */
import { failure, success } from "@/lib/fieldjobs/http"
import { PersistenceError } from "@/lib/persistence/errors"

import { logDependencyFailure } from "./dependency-failure-log"
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
 * THE METHOD POLICY, IN ONE PLACE, BECAUSE THE REFUSAL, THE `Allow` HEADER AND THE FRAMEWORK MUST AGREE.
 *
 * On a 405, `Allow` is not decoration - it is the half of the answer that tells the caller what to do
 * instead. Written as its own separate string literal it could come to disagree with the check that
 * produced the refusal, and a header naming a method the surface actually refuses is worse than no
 * header: it sends the caller to a second failure. So the check below and the header both read this.
 *
 * WHAT WAS HERE BEFORE, AND WHY IT WAS WRONG. This was `["GET"]`, with a comment arguing that HEAD was
 * "deliberately absent" because "the route module exports no HEAD handler and the guard refuses it, so
 * listing it here would be a claim this surface does not honour". That argument is circular - HEAD was
 * not allowed because we refused it - and its premise is false. MEASURED against the installed
 * framework's own source, next@16.3.3
 * `next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js`:
 *
 *   HEAD     when a route exports GET and not HEAD, the framework assigns `methods.HEAD = handlers.GET`.
 *            The GET handler IS invoked, with `request.method === "HEAD"`, so the request reaches THIS
 *            file and this list decides the answer. The framework does not refuse it; we did.
 *   OPTIONS  when a route exports no OPTIONS, the framework answers 204 with
 *            `Allow: [...'OPTIONS', ...implemented, +HEAD if GET].sort().join(", ")`, which for this
 *            route is exactly `GET, HEAD, OPTIONS`.
 *
 * So the resource already advertised three methods over HTTP while this file advertised one and refused
 * two of them. Both statements were live at once and they contradicted each other. That is fixed by
 * honouring the safe methods rather than by narrowing the advertisement: RFC 9110 section 9.1 requires
 * GET and HEAD of any general-purpose server, so narrowing was never available.
 *
 * SORTED, NOT MERELY JOINED. The framework builds its list with `.sort()`, and the harness asserts this
 * string is BYTE-IDENTICAL to the one the framework generates for this route. Sorting here means that
 * agreement cannot be broken by someone reordering the array below.
 */
const PLAN_READ_METHODS: readonly string[] = Object.freeze(["GET", "HEAD"])
const ALLOWED_METHODS: readonly string[] = Object.freeze([...PLAN_READ_METHODS, "OPTIONS"])
const ALLOW_HEADER_VALUE = [...ALLOWED_METHODS].sort().join(", ")
const METHOD_REFUSAL_HEADERS: Readonly<Record<string, string>> = Object.freeze({ Allow: ALLOW_HEADER_VALUE })

/**
 * THE NO-WRITE GUARANTEE, ENFORCED HERE AND NOT ONLY IN THE ROUTE FILE.
 *
 * The header above argues that this surface cannot be written to because the route module exports no
 * state-changing verb. That argument is true of ONE file. `dueWorkApi` is an exported singleton, so any
 * future module - a second route, a server action, an internal caller - can import it and call
 * `.preview(req)` from a POST handler and get a working write-verb endpoint. The structural argument would
 * still read as true in this file while the property it protects had quietly gone. So the method is
 * checked where the work happens, and the check runs BEFORE the parameter reads, so a POST is refused as
 * a method problem rather than reported as a missing workspaceId.
 *
 * WHAT IT REFUSES IS NOW EXACTLY THE UNSAFE SET. POST, PUT, PATCH and DELETE are refused; GET, HEAD and
 * OPTIONS are answered. That is not a relaxation of the guarantee - nothing here writes on any of the
 * three, `planDueWork` and `toDueWorkPreview` are pure, and OPTIONS does not reach the engine at all -
 * it is the guarantee stated about the methods it was always actually about.
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
function requireAllowedMethod(method: string): void {
    if (!ALLOWED_METHODS.includes(method)) {
        throw new PersistenceError(
            "METHOD_NOT_ALLOWED",
            "The due-work plan is read with GET (or HEAD). This surface changes nothing, so it accepts no state-changing method.",
            { method, allow: ALLOW_HEADER_VALUE },
        )
    }
}

/**
 * OPTIONS: the method set, and nothing else. 204 with `Allow`, which is what the framework already
 * answers on this route and is therefore the only answer that does not contradict it.
 *
 * IT DOES NOT REACH THE ENGINE AND IT DOES NOT AUTHENTICATE, AND THAT IS NOT A POLICY CHANGE. The
 * framework's auto-implemented OPTIONS is installed ahead of every handler, so this route has always
 * answered OPTIONS over HTTP without authenticating, with exactly this status and exactly this header.
 * Matching it here changes what a DIRECT caller of the singleton sees (405 + Allow, previously) and
 * changes nothing at all about what an HTTP caller sees. What is disclosed is the method list - a fact
 * about the route module, already public in the 405's own `Allow` header, and not workspace data.
 *
 * HEAD is the opposite case and is deliberately NOT handled here: it runs the whole GET path, including
 * authorization, and answers 401 and 403 exactly as GET does. Short-circuiting it would have turned an
 * unauthenticated HEAD into a 200 and made this surface a membership oracle.
 */
function methodDirectory(): Response {
    return new Response(null, { status: 204, headers: { ...METHOD_REFUSAL_HEADERS } })
}

/**
 * HEAD: the GET response with its content removed, per RFC 9110 section 9.3.2 - "identical to GET except
 * that the server MUST NOT send content in the response".
 *
 * DONE HERE RATHER THAN LEFT TO THE TRANSPORT, and that is the whole point of the file. Node's HTTP layer
 * does suppress the body of a response to a HEAD request, so over HTTP the bytes would not have gone out
 * either way. But `preview` is reached by a caller of the exported singleton as well as by the route, and
 * such a caller gets the `Response` object itself - so a body left attached is a body that caller reads.
 * This file's whole design premise is that a guarantee which only holds on the route path is not a
 * guarantee, and "no content on HEAD" is a guarantee.
 *
 * THE STATUS AND EVERY HEADER ARE PRESERVED, including on the failure paths: a HEAD with no workspaceId
 * is 400 with no content, a HEAD from a non-member is 403 with no content. `Content-Length` is set to the
 * byte length the GET content WOULD have had, which RFC 9110 section 8.6 permits and which is the one
 * fact a HEAD caller usually wants. It is a byte count taken with TextEncoder, not `String.length`, so a
 * non-ASCII label cannot make it a lie.
 */
async function withoutContentForHead(method: string, response: Response): Promise<Response> {
    if (method !== "HEAD") return response
    const content = await response.text()
    const headers = new Headers(response.headers)
    headers.set("Content-Length", String(new TextEncoder().encode(content).length))
    return new Response(null, { status: response.status, statusText: response.statusText, headers })
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
 * THE SANITIZING FAILURE-PATH TRACE NOW LIVES IN `./dependency-failure-log.ts`, SHARED WITH `./http.ts`.
 *
 * It was defined here in full - a `redact` that strips URI authorities and credential keyword pairs,
 * `errorKind`/`safeCode` that classify without leaking, a bounded cause-chain walk and a frame-capping
 * stack reader, ending in ONE `console.error` that is useful to an operator and carries no secret. The
 * operations view (`./http.ts`) answers 503 DEPENDENCY_UNAVAILABLE on its own failure path and needs
 * exactly the same trace, so the logger was EXTRACTED verbatim rather than copied. `preview` below calls
 * it with this surface's scope tag; every field it logs, and every guarantee about what it does NOT log,
 * is unchanged - see the shared module, and `check-due-work-preview-api.ts`, which still exercises the
 * whole behaviour through this surface.
 */

export class DueWorkApiService {
    constructor(private readonly operations: OperationsService) {}

    /**
     * Explicitly invoked. One request produces one plan and nothing else happens - no row is written,
     * not even a record that the preview was requested, because that would make this a write path.
     *
     * THE THREE SAFE METHODS, checked here rather than inferred from the route module's exports. GET
     * answers the plan; HEAD answers the same status and headers with no content; OPTIONS answers the
     * method set. POST, PUT, PATCH and DELETE are refused with 405 and `Allow` - see
     * `requireAllowedMethod` for why that is the honest line to draw, and for the framework measurement
     * that made the previous GET-only line untenable.
     *
     * `method` is read ONCE, before the chain, because the HEAD content-stripping step at the end has to
     * apply to the failure path too and re-reading it inside two closures is how those two drift.
     *
     * The 503 message names THIS surface. Reusing the envelope helper is correct; inheriting the other
     * surface's fallback text is not, because an owner reading "Operations are temporarily unavailable"
     * on a due-work request cannot tell which of the two is actually down.
     */
    preview(request: Request): Promise<Response> {
        const method = request.method.toUpperCase()
        return Promise.resolve()
            .then(async () => {
                requireAllowedMethod(method)
                if (method === "OPTIONS") return methodDirectory()
                const summary = await this.operations.summary(param(request, "workspaceId"), {
                    horizonHours: optIntParam(request, "horizonHours"),
                })
                const preview: DueWorkPreview = toDueWorkPreview(planDueWork(summary))
                return success(preview)
            })
            .catch((error: unknown) => {
                logDependencyFailure("[operations/due-work]", error)
                return failure(error, "The due-work plan is temporarily unavailable", methodRefusalHeaders(error))
            })
            .then((response) => withoutContentForHead(method, response))
    }
}
