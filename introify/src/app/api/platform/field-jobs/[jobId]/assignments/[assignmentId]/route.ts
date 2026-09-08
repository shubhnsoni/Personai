import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ jobId: string; assignmentId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { jobId, assignmentId } = await params
    return fieldJobApi.transitionAssignment(jobId, assignmentId, request)
}
