import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return commerceApi.listFulfilments(request)
}

export function POST(request: Request): Promise<Response> {
    return commerceApi.createFulfilment(request)
}
