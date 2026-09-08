import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return caseApi.list(request)
}

export function POST(request: Request): Promise<Response> {
    return caseApi.create(request)
}
