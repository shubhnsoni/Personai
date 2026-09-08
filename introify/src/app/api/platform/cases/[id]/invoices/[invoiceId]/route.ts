import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; invoiceId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, invoiceId } = await params
    return caseApi.transitionInvoice(id, invoiceId, request)
}
