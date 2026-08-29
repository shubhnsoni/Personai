import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * The append-only commerce timeline for one subject. Requires `subjectType` and `subjectId`
 * so a caller cannot sweep another tenant's history by omitting a filter.
 */
export function GET(request: Request): Promise<Response> {
    return commerceApi.events(request)
}
