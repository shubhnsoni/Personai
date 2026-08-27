import { platformService } from "@/lib/persistence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return platformService.activities(request)
}

export function POST(request: Request): Promise<Response> {
    return platformService.appendActivities(request)
}
