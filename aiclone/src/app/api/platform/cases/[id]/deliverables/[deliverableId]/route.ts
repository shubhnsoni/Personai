import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; deliverableId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, deliverableId } = await params
    return caseApi.transitionDeliverable(id, deliverableId, request)
}
