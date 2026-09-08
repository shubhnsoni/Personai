import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; requestId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, requestId } = await params
    return caseApi.transitionDocumentRequest(id, requestId, request)
}
