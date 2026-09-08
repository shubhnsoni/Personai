import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return cohortApi.listSessions(id, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return cohortApi.addSession(id, request)
}
