import { workspaceSurfaceApi } from "@/lib/business-os/workspace-surface-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ workspaceId: string }> }

/** Resolve installation-derived product surfaces for one explicitly authorized workspace. */
export async function GET(_request: Request, { params }: Params): Promise<Response> {
    const { workspaceId } = await params
    return workspaceSurfaceApi.forWorkspace(workspaceId)
}
