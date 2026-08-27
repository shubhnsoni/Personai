import { platformService } from "@/lib/persistence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
    request: Request,
    context: { params: Promise<{ taskId: string }> },
): Promise<Response> {
    return platformService.completeTask((await context.params).taskId, request)
}
