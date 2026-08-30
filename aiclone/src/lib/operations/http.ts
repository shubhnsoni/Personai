/**
 * HTTP boundary for the operations view.
 *
 * Reuses the fieldJobs envelope helpers rather than restating them, for the reason the access-level
 * package established earlier in this program: two copies of an envelope drift the first time one of
 * them gains a status. The status map, the { ok, data } / { ok, error } shape and the 503 fallback are
 * all imported.
 *
 * There is exactly ONE method and it is a GET. No POST, PATCH or DELETE exists on this surface,
 * because the engine behind it has no write path - so the absence is structural rather than a policy
 * somebody has to remember.
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

export class OperationsApiService {
    constructor(private readonly operations: OperationsService) {}

    today(request: Request): Promise<Response> {
        return Promise.resolve()
            .then(async () => {
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
            .catch((error: unknown) => failure(error, "Operations are temporarily unavailable"))
    }
}
