import { failure, str, success } from "@/lib/fieldjobs/http"
import { logDependencyFailure } from "@/lib/operations/dependency-failure-log"

import type { WorkspaceSurfaceResolution, WorkspaceSurfaceResolverPort } from "./workspace-surface-types"

const UNAVAILABLE = "Workspace surfaces are temporarily unavailable"

/**
 * The surface tag for the shared sanitizing failure logger. A fixed literal, never derived from a request;
 * `logDependencyFailure` now checks that shape rather than trusting it - see `safeScope` there.
 */
const FAILURE_LOG_SCOPE = "[business-os/workspace-surface]"

/** Read-only HTTP boundary for one workspace's installation-derived product surfaces. */
export class WorkspaceSurfaceApiService {
    constructor(private readonly resolver: WorkspaceSurfaceResolverPort) {}

    /**
     * THE ONE FAILURE FUNNEL FOR THIS SURFACE, AND NOW THE ONE PLACE IT IS TRACED. The `.catch` arrow and
     * its `failure(error, UNAVAILABLE)` call are unchanged, so status, body and headers are byte-identical.
     * The logger is a side channel that swallows its own failures, and it skips `PersistenceError`, so the
     * 400 raised by `str` and the resolver's own refusals stay out of the incident log.
     */
    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch((error: unknown) => {
            logDependencyFailure(FAILURE_LOG_SCOPE, error)
            return failure(error, UNAVAILABLE)
        })
    }

    forWorkspace(workspaceId: string): Promise<Response> {
        return this.run(async () => {
            const resolution = await this.resolver.forWorkspace(str(workspaceId, "workspaceId"))
            return success({ resolution: serialiseResolution(resolution) })
        })
    }
}

function serialiseResolution(resolution: WorkspaceSurfaceResolution): Record<string, unknown> {
    return {
        workspaceId: resolution.workspaceId,
        installationId: resolution.installationId,
        blueprintId: resolution.blueprintId,
        source: resolution.source,
        surfaces: [...resolution.surfaces],
        unknownSurfaces: [...resolution.unknownSurfaces],
        // Recognised but non-installable values, reported separately so a caller is never told that
        // wrong-now configuration data is merely an outdated config. See workspace-surface-types.ts.
        notInstallableSurfaces: [...resolution.notInstallableSurfaces],
    }
}
