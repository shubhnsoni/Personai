import { CopilotRuntimeError, resolveCopilotAction } from "@/lib/copilot/execution"
import {
  executionService,
  okResponse,
  readObjectBody,
  requireCopilotRunAccess,
  runtimeErrorResponse,
} from "../../_shared"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ runId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCopilotRunAccess()
    if (!access.ok) return access.response
    const { runId } = await context.params
    const body = await readObjectBody(request)
    const actionKey = typeof body.actionKey === "string" ? body.actionKey : ""
    const agentKey = typeof body.agentKey === "string" ? body.agentKey : ""
    const stepLabel = typeof body.stepLabel === "string" ? body.stepLabel : ""
    const toolName = typeof body.toolName === "string" ? body.toolName : ""
    const input = body.input === undefined ? {} : body.input
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new CopilotRuntimeError("BAD_REQUEST", "input must be a JSON object.")
    }
    const result = await executionService.execute(
      access.scope,
      {
        runId,
        actionKey,
        agentKey,
        stepLabel,
        toolName,
        input: input as Record<string, unknown>,
      },
      resolveCopilotAction(actionKey),
    )
    return okResponse(result)
  } catch (error) {
    return runtimeErrorResponse(error)
  }
}
