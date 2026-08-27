import { CopilotRuntimeError } from "@/lib/copilot/execution"
import {
  executionService,
  okResponse,
  readObjectBody,
  requireCopilotRunAccess,
  runtimeErrorResponse,
} from "../../../_shared"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ runId: string; approvalId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCopilotRunAccess()
    if (!access.ok) return access.response
    const { runId, approvalId } = await context.params
    const body = await readObjectBody(request)
    if (body.decision !== "grant" && body.decision !== "reject") {
      throw new CopilotRuntimeError("BAD_REQUEST", "decision must be grant or reject.")
    }
    const note = typeof body.note === "string" ? body.note : undefined
    const run = await executionService.decideApproval(access.scope, runId, approvalId, {
      decision: body.decision,
      ...(note ? { note } : {}),
    })
    return okResponse({ run })
  } catch (error) {
    return runtimeErrorResponse(error)
  }
}
