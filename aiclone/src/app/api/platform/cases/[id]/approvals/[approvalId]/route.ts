import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; approvalId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, approvalId } = await params
    return caseApi.decideApproval(id, approvalId, request)
}
