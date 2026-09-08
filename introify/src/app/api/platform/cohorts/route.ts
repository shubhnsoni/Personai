import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return cohortApi.list(request)
}

export function POST(request: Request): Promise<Response> {
    return cohortApi.create(request)
}
