import { operationsApi } from "@/lib/operations/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET only. The operations view has no write path, so no other method is exported here - a caller
 * attempting one gets Next.js's own 405 rather than reaching a handler that would have to refuse.
 */
export async function GET(request: Request): Promise<Response> {
    return operationsApi.today(request)
}
