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

export class DueWorkApiService {
    constructor(private readonly operations: OperationsService) {}

    /**
     * Explicitly invoked. One request produces one plan and nothing else happens - no row is written,
     * not even a record that the preview was requested, because that would make this a write path.
     *
     * The 503 message names THIS surface. Reusing the envelope helper is correct; inheriting the other
     * surface's fallback text is not, because an owner reading "Operations are temporarily unavailable"
     * on a due-work request cannot tell which of the two is actually down.
     */
    preview(request: Request): Promise<Response> {
        return Promise.resolve()
            .then(async () => {
                const summary = await this.operations.summary(param(request, "workspaceId"), {
                    horizonHours: optIntParam(request, "horizonHours"),
                })
                const preview: DueWorkPreview = toDueWorkPreview(planDueWork(summary))
                return success(preview)
            })
            .catch((error: unknown) => failure(error, "The due-work plan is temporarily unavailable"))
    }
}
