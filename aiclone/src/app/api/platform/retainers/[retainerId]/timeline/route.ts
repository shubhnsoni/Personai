import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ retainerId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { retainerId } = await params
    return caseApi.retainerTimeline(retainerId, request)
}
