import { platformService } from "@/lib/persistence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(): Promise<Response> {
    return platformService.workspaces()
}
