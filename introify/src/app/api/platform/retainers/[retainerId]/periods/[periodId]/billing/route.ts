import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ retainerId: string; periodId: string }> }

/**
 * Billing STATE only. This route records where an invoice got to and may reference a CaseInvoice
 * row. It executes no payment, and there is no route anywhere on this surface that does.
 */
export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { retainerId, periodId } = await params
    return caseApi.setRetainerBilling(retainerId, periodId, request)
}
