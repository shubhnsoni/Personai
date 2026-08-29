import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
    return caseApi.listRetainers(request)
}

export async function POST(request: Request): Promise<Response> {
    return caseApi.createRetainer(request)
}
