import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return caseApi.listIntakes(request)
}

export function POST(request: Request): Promise<Response> {
    return caseApi.createIntake(request)
}
