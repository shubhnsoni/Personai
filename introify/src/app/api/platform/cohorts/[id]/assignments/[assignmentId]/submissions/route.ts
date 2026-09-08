import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; assignmentId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id, assignmentId } = await params
    return cohortApi.listSubmissions(id, assignmentId, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { id, assignmentId } = await params
    return cohortApi.openSubmission(id, assignmentId, request)
}
