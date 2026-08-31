/**
 * HTTP boundary for the operations view.
 *
 * Reuses the fieldJobs envelope helpers rather than restating them, for the reason the access-level
 * package established earlier in this program: two copies of an envelope drift the first time one of
 * them gains a status. The status map, the { ok, data } / { ok, error } shape and the 503 fallback are
 * all imported.
 *
 * THERE IS ONE HANDLER AND IT READS. That used to be argued from the route module's export list, and this
 * file's header used to say so: "No POST, PATCH or DELETE exists on this surface, because the engine
 * behind it has no write path - so the absence is structural rather than a policy somebody has to
 * remember." Every clause of that was true and the conclusion did not follow.
 *
 * WHAT WAS MEASURED. `operationsApi` is an exported singleton (see ./runtime.ts), and `today` never read
 * `request.method`. So a direct caller - a second route, a server action, any internal module that
 * imports the singleton - got 200 and the full workspace summary for POST, for OPTIONS, and for every
 * other verb. Nothing was exposed over HTTP, because the route module exports only GET and next@16.3.3
 * refuses the rest itself; and no write occurred, because the engine has no write path. But the
 * read-only guarantee rested entirely on one file's export list, which is a guarantee about a FILE and
 * not about the service. The route file is one edit away from not being the only caller.
 *
 * So the method is now checked where the work happens, exactly as `due-work-http.ts` does it - see THE
 * METHOD POLICY below. This is the same defect that file already fixed for the same reason, and the two
 * surfaces are deliberately kept in the same shape rather than each inventing a policy.
 */
import { failure, serialise, success } from "@/lib/fieldjobs/http"
import { PersistenceError } from "@/lib/persistence/errors"

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
 * instead. Written as its own separate literal it could come to disagree with the check that produced the
 * refusal, and a header naming a method the surface actually refuses is worse than no header: it sends the
 * caller to a second failure. So the check below and the header both read this.
 *
 * THE SET IS THE THREE SAFE METHODS, AND THAT IS NOT A RELAXATION. RFC 9110 section 9.2.1 sorts methods
 * into safe and unsafe; GET, HEAD and OPTIONS are all safe, and none of them is a request to change
 * anything. Under RFC 9110 section 9.1 a general-purpose server MUST support GET and HEAD, so refusing
 * HEAD was never an option available to this surface - and MEASURED against the installed framework's own
 * `next/dist/server/route-modules/app-route/helpers/auto-implement-methods`, a route that exports GET and
 * not HEAD has `methods.HEAD = handlers.GET` assigned, so a HEAD request reaches THIS file with
 * `request.method === "HEAD"` and this list decides the answer. The framework already advertises
 * `GET, HEAD, OPTIONS` on this route via its auto-implemented OPTIONS; a narrower list here would have
 * contradicted the resource's own advertisement.
 *
 * Sorted rather than merely joined, because the framework builds its own list with `.sort()` - so
 * agreement with it cannot be broken by someone reordering the array.
 */
const OPERATIONS_READ_METHODS: readonly string[] = Object.freeze(["GET", "HEAD"])
const ALLOWED_METHODS: readonly string[] = Object.freeze([...OPERATIONS_READ_METHODS, "OPTIONS"])
const ALLOW_HEADER_VALUE = [...ALLOWED_METHODS].sort().join(", ")
const METHOD_REFUSAL_HEADERS: Readonly<Record<string, string>> = Object.freeze({ Allow: ALLOW_HEADER_VALUE })

/**
 * THE NO-WRITE GUARANTEE, ENFORCED HERE AND NOT ONLY IN THE ROUTE FILE.
 *
 * Checked BEFORE the parameter reads and before the engine is touched, and the order is the load-bearing
 * part rather than a tidiness preference. Two consequences:
 *
 *   A POST is refused as a METHOD problem rather than reported as a missing workspaceId, which is the
 *   honest answer to the request that was actually made.
 *
 *   THE REFUSAL CANNOT ENUMERATE. Because nothing has been read yet, a POST naming a workspace the caller
 *   owns, a workspace belonging to somebody else, a workspace id that does not exist, and no workspace at
 *   all all produce the SAME bytes. Had the guard run after `param`, the difference between a 400 and a
 *   405 would have leaked whether a workspaceId was well-formed, and had it run after the engine call the
 *   difference between 403 and 405 would have leaked whether the caller was a member. This surface already
 *   goes to some trouble to make a foreign workspace and a nonexistent one indistinguishable; a guard
 *   placed later would have handed that back through a new door.
 *
 * 405 and deliberately NOT 403. On this surface 403 already means "not a member of that workspace", and a
 * foreign workspace and a nonexistent one refuse byte-identically precisely so the status cannot be used
 * to enumerate real ids. Putting a second, unrelated meaning behind that status would blunt an assertion
 * that is doing real work.
 */
function requireAllowedMethod(method: string): void {
    if (!ALLOWED_METHODS.includes(method)) {
        throw new PersistenceError(
            "METHOD_NOT_ALLOWED",
            "The operations view is read with GET (or HEAD). This surface changes nothing, so it accepts no state-changing method.",
            { method, allow: ALLOW_HEADER_VALUE },
        )
    }
}

/**
 * OPTIONS: the method set, and nothing else. 204 with `Allow`.
 *
 * IT DOES NOT REACH THE ENGINE AND IT DOES NOT AUTHENTICATE, AND THAT IS NOT A POLICY CHANGE. The
 * framework's auto-implemented OPTIONS is installed ahead of every handler, so this route has always
 * answered OPTIONS over HTTP without authenticating, with exactly this status and exactly this header.
 * Matching it here changes only what a DIRECT caller of the singleton sees - which was previously 200 and
 * a full workspace summary, the defect this file exists to close - and changes nothing at all about what
 * an HTTP caller sees. What is disclosed is the method list: a fact about the route module, already public
 * in the 405's own `Allow` header, and not workspace data.
 *
 * HEAD is the opposite case and is deliberately NOT short-circuited here: it runs the whole GET path,
 * including authorization, and answers 401 and 403 exactly as GET does. Short-circuiting it would have
 * turned an unauthenticated HEAD into a 200 and made this surface a membership oracle.
 */
function methodDirectory(): Response {
    return new Response(null, { status: 204, headers: { ...METHOD_REFUSAL_HEADERS } })
}

/**
 * HEAD: the GET response with its content removed, per RFC 9110 section 9.3.2 - "identical to GET except
 * that the server MUST NOT send content in the response".
 *
 * DONE HERE RATHER THAN LEFT TO THE TRANSPORT, for this file's whole premise. Node's HTTP layer does
 * suppress the body of a response to a HEAD request, so over HTTP the bytes would not go out either way.
 * But a caller of the exported singleton receives the `Response` object itself, so a body left attached is
 * a body that caller reads - and a guarantee that only holds on the route path is not a guarantee.
 *
 * THE STATUS AND EVERY HEADER ARE PRESERVED, including on the failure paths: a HEAD with no workspaceId is
 * 400 with no content, a HEAD from a non-member is 403 with no content. `Content-Length` is set to the byte
 * length the GET content WOULD have had, which RFC 9110 section 8.6 permits and which is the one fact a
 * HEAD caller usually wants. It is a byte count taken with TextEncoder, not `String.length`, so a
 * non-ASCII workspace name cannot make it a lie.
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
 * `failure`'s unchanged no-header path, which is what keeps this change invisible to the five other
 * surfaces that import the same helper.
 */
function methodRefusalHeaders(error: unknown): Readonly<Record<string, string>> | undefined {
    return error instanceof PersistenceError && error.code === "METHOD_NOT_ALLOWED" ? METHOD_REFUSAL_HEADERS : undefined
}

export class OperationsApiService {
    constructor(private readonly operations: OperationsService) {}

    /**
     * THE THREE SAFE METHODS, checked here rather than inferred from the route module's exports. GET
     * answers the summary; HEAD answers the same status and headers with no content; OPTIONS answers the
     * method set. POST, PUT, PATCH and DELETE are refused with 405 and `Allow`.
     *
     * `method` is read ONCE, before the chain, because the HEAD content-stripping step at the end has to
     * apply to the failure path too, and re-reading it inside two closures is how those two drift.
     */
    today(request: Request): Promise<Response> {
        const method = request.method.toUpperCase()
        return Promise.resolve()
            .then(async () => {
                requireAllowedMethod(method)
                if (method === "OPTIONS") return methodDirectory()
                const summary = await this.operations.summary(param(request, "workspaceId"), {
                    horizonHours: optIntParam(request, "horizonHours"),
                })
                return success({
                    asOf: summary.asOf.toISOString(),
                    horizonHours: summary.horizonHours,
                    total: summary.total,
                    totalOverdue: summary.totalOverdue,
                    domains: summary.domains.map((domain) => ({ ...domain })),
                    items: summary.items.map((item) => serialise({ ...item })),
                    covers: [...summary.covers],
                    doesNotCover: summary.doesNotCover,
                    mixedScope: summary.mixedScope,
                })
            })
            .catch((error: unknown) => failure(error, "Operations are temporarily unavailable", methodRefusalHeaders(error)))
            .then((response) => withoutContentForHead(method, response))
    }
}
