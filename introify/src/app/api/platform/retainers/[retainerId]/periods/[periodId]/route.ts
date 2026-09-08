import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ retainerId: string; periodId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { retainerId, periodId } = await params
    return caseApi.transitionRetainerPeriod(retainerId, periodId, request)
}
