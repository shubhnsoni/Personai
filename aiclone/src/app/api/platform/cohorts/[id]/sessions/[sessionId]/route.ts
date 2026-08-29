import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; sessionId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, sessionId } = await params
    return cohortApi.transitionSession(id, sessionId, request)
}
