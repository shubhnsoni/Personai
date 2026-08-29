import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ retainerId: string; caseId: string }> }

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
    const { retainerId, caseId } = await params
    return caseApi.unlinkRetainerCase(retainerId, caseId, request)
}
