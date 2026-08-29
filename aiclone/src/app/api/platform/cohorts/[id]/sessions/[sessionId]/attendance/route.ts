import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; sessionId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id, sessionId } = await params
    return cohortApi.listAttendance(id, sessionId, request)
}

export async function PUT(request: Request, { params }: Params): Promise<Response> {
    const { id, sessionId } = await params
    return cohortApi.recordAttendance(id, sessionId, request)
}
