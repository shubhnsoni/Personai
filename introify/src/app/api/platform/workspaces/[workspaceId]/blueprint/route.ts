import { blueprintInstallApi } from "@/lib/business-os/install-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ workspaceId: string }> }

/**
 * The installed blueprint for this workspace, plus every installation it has ever had.
 *
 * Read path: needs only `profile.read`, the same permission preview asks for, so an onboarding surface
 * can show current state before anybody holds an elevated role.
 */
export async function GET(_request: Request, { params }: Params): Promise<Response> {
    const { workspaceId } = await params
    return blueprintInstallApi.forWorkspace(workspaceId)
}

/**
 * Install or upgrade. Requires `workspace.update`, which is OWNER and ADMIN only - deliberately not
 * `profile.update`, which MANAGER also holds, because installing re-terms the whole workspace.
 *
 * Idempotent on `(workspaceId, idempotencyKey)`: a repeat returns the original installation with
 * `outcome: "replayed"` and writes no second row anywhere.
 */
export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { workspaceId } = await params
    return blueprintInstallApi.install(workspaceId, request)
}

/**
 * Remove the active installation. NOT a delete: the row moves to REMOVED and its append-only history is
 * retained, because the question "what did this workspace run, and when" must stay answerable.
 */
export async function DELETE(request: Request, { params }: Params): Promise<Response> {
    const { workspaceId } = await params
    return blueprintInstallApi.remove(workspaceId, request)
}
