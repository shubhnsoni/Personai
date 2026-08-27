import { platformService } from "@/lib/persistence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function POST(request: Request): Promise<Response> {
    return platformService.enqueueTask(request)
}
