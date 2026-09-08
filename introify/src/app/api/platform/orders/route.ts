import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** The owner's orders, so a console can pick one to ship or accept a return against. */
export function GET(request: Request): Promise<Response> {
    return commerceApi.listOrders(request)
}
