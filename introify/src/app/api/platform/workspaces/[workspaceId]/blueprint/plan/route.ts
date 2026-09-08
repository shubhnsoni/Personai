import { blueprintInstallApi } from "@/lib/business-os/install-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ workspaceId: string }> }

/**
 * PREVIEW BEFORE INSTALL. What installing this blueprint would do to this workspace: the resolved
 * preview, the config that would be frozen, whether it would be an upgrade and what it would supersede,
 * and every reason it would be refused right now.
 *
 * GET only, and the service behind it has no write path from here - not even to record that the question
 * was asked. `permissionChanges` is always an empty array, because installing grants nothing.
 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { workspaceId } = await params
    const blueprintId = new URL(request.url).searchParams.get("blueprintId") ?? ""
    return blueprintInstallApi.plan(workspaceId, blueprintId)
}
