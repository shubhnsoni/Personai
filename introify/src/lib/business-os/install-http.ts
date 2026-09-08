/**
 * HTTP boundary for blueprint installation.
 *
 * Reuses the platform envelope helpers rather than restating them - one status map and one
 * { ok, data } / { ok, error } shape. The 503 message is passed explicitly, because the shared helper's
 * default names field jobs and an accurate envelope carrying an inaccurate sentence is still wrong.
 *
 * 403 IS FOR WORKSPACES, 404 IS FOR BLUEPRINTS, AND THE DISTINCTION IS NOT A STYLE CHOICE. A workspace id
 * is private, so a foreign one and a nonexistent one produce byte-identical FORBIDDEN refusals and this
 * endpoint cannot be used to enumerate workspaces. A blueprint id is a PUBLIC STATIC registry key,
 * identical for every tenant and readable in the source, so an unknown one is a 404 - refusing to confirm
 * it protects nothing and makes a typo indistinguishable from a permissions problem.
 *
 * Authorisation is evaluated BEFORE the registry lookup in every method, so 404 cannot act as a registry
 * oracle for a caller with no access to the workspace.
 */
import { body, failure, str, success } from "@/lib/fieldjobs/http"
import { logDependencyFailure } from "@/lib/operations/dependency-failure-log"

import type { BlueprintInstallService } from "./install"
import type { InstallPlanView, InstalledBlueprintView, WorkspaceInstallationView } from "./install-types"

const UNAVAILABLE = "Blueprint installation is temporarily unavailable"

/**
 * The surface tag for the shared sanitizing failure logger. A fixed literal, never derived from a request;
 * `logDependencyFailure` now checks that shape rather than trusting it - see `safeScope` there.
 */
const FAILURE_LOG_SCOPE = "[business-os/install]"

export class BlueprintInstallApiService {
    constructor(private readonly installs: BlueprintInstallService) {}

    /**
     * THE ONE FAILURE FUNNEL FOR THIS SURFACE, AND NOW THE ONE PLACE IT IS TRACED. The `.catch` arrow and
     * its `failure(error, UNAVAILABLE)` call are unchanged, so status, body and headers are byte-identical -
     * including the 503's surface-accurate message. The logger is a side channel that swallows its own
     * failures, and it skips `PersistenceError`, which is what keeps the FORBIDDEN refusals this file goes
     * to some trouble to make byte-identical from becoming distinguishable through the log instead.
     */
    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch((error: unknown) => {
            logDependencyFailure(FAILURE_LOG_SCOPE, error)
            return failure(error, UNAVAILABLE)
        })
    }

    /** GET - what is installed here. */
    forWorkspace(workspaceId: string): Promise<Response> {
        return this.run(async () => {
            const view = await this.installs.forWorkspace(workspaceId)
            return success({ workspace: serialiseWorkspace(view) })
        })
    }

    /** GET - what installing WOULD do. Writes nothing, including nothing to record being asked. */
    plan(workspaceId: string, blueprintId: string): Promise<Response> {
        return this.run(async () => {
            const view = await this.installs.plan(workspaceId, blueprintId)
            return success({ plan: serialisePlan(view) })
        })
    }

    /** POST - install or upgrade. */
    install(workspaceId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const payload = await body(request)
            const result = await this.installs.install({
                workspaceId,
                blueprintId: str(payload.blueprintId, "blueprintId"),
                idempotencyKey: str(payload.idempotencyKey, "idempotencyKey"),
                actor: str(payload.actor, "actor"),
            })
            return success({
                outcome: result.outcome,
                installation: serialiseInstallation(result.installation),
            })
        })
    }

    /** DELETE - move the active installation to REMOVED. The row and its history are retained. */
    remove(workspaceId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const payload = await body(request)
            const view = await this.installs.remove({
                workspaceId,
                idempotencyKey: str(payload.idempotencyKey, "idempotencyKey"),
                actor: str(payload.actor, "actor"),
            })
            return success({ installation: serialiseInstallation(view) })
        })
    }
}

/**
 * Deep-copies the frozen views into plain JSON.
 *
 * Every date on these views is ALREADY an ISO string, set in the runtime rather than here, so this
 * function contains no Date handling at all - and the route harness asserts the emitted values are
 * strings, because "it happened to serialise" is not the same as "it cannot emit a Date".
 */
function serialiseInstallation(view: InstalledBlueprintView): Record<string, unknown> {
    return {
        id: view.id,
        workspaceId: view.workspaceId,
        blueprintId: view.blueprintId,
        blueprintVersion: view.blueprintVersion,
        state: view.state,
        config: serialiseConfig(view.config),
        supersedesInstallationId: view.supersedesInstallationId,
        installedAt: view.installedAt,
        removedAt: view.removedAt,
        driftedFromRegistry: view.driftedFromRegistry,
        currentBlockers: [...view.currentBlockers],
        history: view.history.map((event) => ({ ...event })),
    }
}

function serialiseConfig(config: InstalledBlueprintView["config"]): Record<string, unknown> {
    return {
        role: config.role,
        surfaces: [...config.surfaces],
        fieldPacks: [...config.fieldPacks],
        terminology: { ...config.terminology },
        engineIds: [...config.engineIds],
        businessOsExcluded: config.businessOsExcluded,
    }
}

function serialiseWorkspace(view: WorkspaceInstallationView): Record<string, unknown> {
    return {
        workspaceId: view.workspaceId,
        installed: view.installed ? serialiseInstallation(view.installed) : null,
        all: view.all.map(serialiseInstallation),
        limitations: [...view.limitations],
    }
}

function serialisePlan(view: InstallPlanView): Record<string, unknown> {
    return {
        preview: {
            ...view.preview,
            versioning: { ...view.preview.versioning, supersededBy: [...view.preview.versioning.supersededBy] },
            engines: view.preview.engines.map((engine) => ({
                ...engine,
                capabilities: engine.capabilities.map((capability) => ({ ...capability })),
                plannedCapabilities: [...engine.plannedCapabilities],
            })),
            workflows: view.preview.workflows.map((workflow) => ({
                ...workflow,
                approvals: workflow.approvals.map((approval) => ({ ...approval })),
            })),
            ownerCopilotPrompts: [...view.preview.ownerCopilotPrompts],
            presentation: {
                ...view.preview.presentation,
                surfaces: [...view.preview.presentation.surfaces],
                fieldPacks: [...view.preview.presentation.fieldPacks],
                terminology: { ...view.preview.presentation.terminology },
            },
            blockedBy: [...view.preview.blockedBy],
            limitations: [...view.preview.limitations],
            installed: null,
        },
        config: serialiseConfig(view.config),
        isUpgrade: view.isUpgrade,
        supersedes: view.supersedes ? { ...view.supersedes } : null,
        refused: view.refused,
        refusals: [...view.refusals],
        // Always an empty array. Present so a caller can see the question was asked and answered.
        permissionChanges: [],
    }
}
