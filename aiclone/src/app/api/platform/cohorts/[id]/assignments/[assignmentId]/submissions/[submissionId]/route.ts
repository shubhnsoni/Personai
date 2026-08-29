import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; assignmentId: string; submissionId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, assignmentId, submissionId } = await params
    return cohortApi.transitionSubmission(id, assignmentId, submissionId, request)
}
