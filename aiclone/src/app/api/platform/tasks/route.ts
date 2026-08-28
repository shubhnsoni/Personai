import { platformService } from "@/lib/persistence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return platformService.tasks(request)
}

export function POST(request: Request): Promise<Response> {
    return platformService.enqueueTask(request)
}
