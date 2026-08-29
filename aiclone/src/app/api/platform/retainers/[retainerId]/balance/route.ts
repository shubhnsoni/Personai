import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ retainerId: string }> }

/**
 * Recomputed on every call. There is no stored remaining or overage figure, because a stored
 * derived number is a second number that has to agree with the ledger.
 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { retainerId } = await params
    return caseApi.retainerBalance(retainerId, request)
}
