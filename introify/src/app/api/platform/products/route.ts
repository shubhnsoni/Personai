import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** The owner's products, so a console can offer a real choice instead of inventing one. */
export function GET(request: Request): Promise<Response> {
    return commerceApi.listProducts(request)
}
