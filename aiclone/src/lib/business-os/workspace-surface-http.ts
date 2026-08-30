import { failure, str, success } from "@/lib/fieldjobs/http"

import type { WorkspaceSurfaceResolution, WorkspaceSurfaceResolverPort } from "./workspace-surface-types"

const UNAVAILABLE = "Workspace surfaces are temporarily unavailable"

/** Read-only HTTP boundary for one workspace's installation-derived product surfaces. */
export class WorkspaceSurfaceApiService {
    constructor(private readonly resolver: WorkspaceSurfaceResolverPort) {}

    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch((error: unknown) => failure(error, UNAVAILABLE))
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
    }
}
