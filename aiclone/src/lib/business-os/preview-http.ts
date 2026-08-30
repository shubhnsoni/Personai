/**
 * HTTP boundary for blueprint preview.
 *
 * Reuses the platform envelope helpers from the fieldJobs surface rather than restating them - one
 * status map and one { ok, data } / { ok, error } shape, for the reason the access-level package
 * established: two copies of an envelope drift the first time one of them gains a status. The 503
 * message is passed explicitly, because that helper's default names field jobs and an accurate envelope
 * carrying an inaccurate sentence is still wrong.
 *
 * TWO GET METHODS AND NOTHING ELSE. The service behind this has no write path, so the absence of a
 * write verb here is structural rather than a policy somebody has to remember.
 *
 * WHY THIS SURFACE HAS A 404 WHEN THE RECORD SURFACES DO NOT
 *
 * Everywhere else in this platform a foreign row and a missing row both return 403, because a 404 would
 * let a caller discover which ids exist. A blueprint id is different in kind: it is a PUBLIC, STATIC
 * registry key - the same six ids for every tenant, present in the source - so telling a caller that
 * `nonsense-v9` is not a blueprint reveals nothing they could not read in the repository. Returning 403
 * there would be security theatre that also makes a typo indistinguishable from a permissions problem.
 *
 * The workspace check is unaffected: 403 still means the workspace is not yours, and it is evaluated
 * BEFORE the blueprint lookup so an unauthorised caller cannot use this endpoint to probe the registry.
 */
import { failure, param, serialise, success } from "@/lib/fieldjobs/http"
import { PersistenceError } from "@/lib/persistence/errors"

import type { BlueprintPreviewService } from "./preview"
import type { PreviewContext } from "./preview-shared"

const UNAVAILABLE = "Blueprint preview is temporarily unavailable"

export class BlueprintPreviewApiService {
    constructor(
        private readonly ctx: PreviewContext,
        private readonly previews: BlueprintPreviewService,
    ) {}

    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch((error: unknown) => failure(error, UNAVAILABLE))
    }

    list(request: Request): Promise<Response> {
        return this.run(async () => {
            // Authorisation first, and deliberately before any registry read: this endpoint must not be
            // usable as a registry oracle by somebody with no access to the workspace.
            await this.ctx.requireWorkspace(param(request, "workspaceId"))
            const blueprints = this.previews.list()
            return success({
                blueprints: blueprints.map((blueprint) => ({
                    ...blueprint,
                    engineIds: [...blueprint.engineIds],
                    blockedBy: [...blueprint.blockedBy],
                })),
            })
        })
    }

    preview(blueprintId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            await this.ctx.requireWorkspace(param(request, "workspaceId"))
            const resolved = this.previews.preview(blueprintId)
            if (resolved === null) {
                throw new PersistenceError("NOT_FOUND", `No blueprint is registered with id ${blueprintId}`, {
                    blueprintId,
                })
            }
            return success({ preview: serialisePreview(resolved) })
        })
    }
}

/**
 * Deep-copies the frozen view into plain JSON. `serialise` handles Date and BigInt at the top level;
 * this view is nested and contains no Date at all, so the arrays and records are spread explicitly
 * rather than relying on a shallow helper to have done it.
 */
function serialisePreview(view: ReturnType<BlueprintPreviewService["preview"]> & object): Record<string, unknown> {
    return {
        ...serialise({ ...view }),
        versioning: { ...view.versioning, supersededBy: [...view.versioning.supersededBy] },
        engines: view.engines.map((engine) => ({
            ...engine,
            capabilities: engine.capabilities.map((capability) => ({ ...capability })),
            plannedCapabilities: [...engine.plannedCapabilities],
        })),
        workflows: view.workflows.map((workflow) => ({
            ...workflow,
            approvals: workflow.approvals.map((approval) => ({ ...approval })),
        })),
        ownerCopilotPrompts: [...view.ownerCopilotPrompts],
        presentation: {
            ...view.presentation,
            surfaces: [...view.presentation.surfaces],
            fieldPacks: [...view.presentation.fieldPacks],
            terminology: { ...view.presentation.terminology },
        },
        blockedBy: [...view.blockedBy],
        limitations: [...view.limitations],
        installed: null,
    }
}
