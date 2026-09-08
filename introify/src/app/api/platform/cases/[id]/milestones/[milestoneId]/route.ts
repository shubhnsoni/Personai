import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; milestoneId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, milestoneId } = await params
    return caseApi.transitionMilestone(id, milestoneId, request)
}
