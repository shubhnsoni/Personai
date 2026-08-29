import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ grantId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { grantId } = await params
    return cohortApi.transitionAccessGrant(grantId, request)
}
