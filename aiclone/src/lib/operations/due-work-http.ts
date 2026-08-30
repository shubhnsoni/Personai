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
 * `preview` also refuses a non-GET request itself - see `requireReadMethod` below.
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
 * WHY 400 AND NOT 405. 405 is the correct HTTP answer and is deliberately not used. `PersistenceErrorCode`
 * in `@/lib/persistence/errors` has no METHOD_NOT_ALLOWED member, and that union - with its status map - is
 * shared by every surface on this platform. Reaching 405 would mean either widening that shared union from
 * this file, which is a platform-wide change smuggled in under a due-work fix, or hand-building a Response
 * that bypasses `failure`, which breaks the one property this surface's harness asserts most often: every
 * refusal here is the same envelope. A caller sent the wrong method has sent a bad request, and 400 says so
 * inside the envelope that already exists.
 *
 * It is deliberately NOT 403 either. On this surface 403 already means "not a member of that workspace", and
 * a foreign workspace and a nonexistent one are asserted to refuse byte-identically so that the status
 * cannot be used to enumerate real ids. Putting an unrelated meaning behind that status would blunt an
 * assertion that is doing real work.
 */
function requireReadMethod(request: Request): void {
    const method = request.method.toUpperCase()
    if (method !== "GET") {
        throw new PersistenceError(
            "BAD_REQUEST",
            "The due-work plan is read with GET. This surface accepts no other method, because a plan is a read and nothing here acts.",
            { method },
        )
    }
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
 * The client body is NOT touched: `failure` is called with exactly the same arguments as before, so the
 * assertion that the 503 leaks no DSN still holds. The consequence is that the detail suppressed from the
 * response is now written to the server log, which is the whole point and is where it belongs.
 */
function logUnexpectedFailure(error: unknown): void {
    if (error instanceof PersistenceError) return
    console.error(
        "[operations/due-work] preview failed and answered 503 DEPENDENCY_UNAVAILABLE; the client is told to retry, " +
            "so if this is a defect in the plan composition rather than an unavailable dependency, retrying cannot help " +
            "and this line is the only trace of it.",
        error,
    )
}

export class DueWorkApiService {
    constructor(private readonly operations: OperationsService) {}

    /**
     * Explicitly invoked. One request produces one plan and nothing else happens - no row is written,
     * not even a record that the preview was requested, because that would make this a write path.
     *
     * GET ONLY, checked here rather than inferred from the route module's exports. See
     * `requireReadMethod` for why the refusal is a 400 in the shared envelope rather than a 405.
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
                return failure(error, "The due-work plan is temporarily unavailable")
            })
    }
}
