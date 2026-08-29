import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ changeId: string }> }

/**
 * Deciding is approving or rejecting, and nothing else. Applying an approved change is a
 * separate endpoint, because approving is not applying: the entitlement does not move until
 * apply runs.
 */
export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { changeId } = await params
    return cohortApi.decideAccessChange(changeId, request)
}
