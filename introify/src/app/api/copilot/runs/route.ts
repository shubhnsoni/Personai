import { isApprovalReason } from "@/lib/copilot/runtime"
import { CopilotRuntimeError } from "@/lib/copilot/execution"
import {
  executionService,
  okResponse,
  readObjectBody,
  requireCopilotRunAccess,
  runtimeErrorResponse,
} from "./_shared"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const access = await requireCopilotRunAccess()
    if (!access.ok) return access.response
    return okResponse({ runs: await executionService.listWorkflows(access.scope) })
  } catch (error) {
    return runtimeErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCopilotRunAccess()
    if (!access.ok) return access.response
    const body = await readObjectBody(request)
    const workflowKey = typeof body.workflowKey === "string" ? body.workflowKey : ""
    const workflowName = typeof body.workflowName === "string" ? body.workflowName : ""
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : ""
    const approvalReason = body.approvalReason
    if (approvalReason !== undefined && !isApprovalReason(approvalReason)) {
      throw new CopilotRuntimeError("BAD_REQUEST", "approvalReason is not supported.")
    }
    const result = await executionService.startWorkflow(access.scope, {
      workflowKey,
      workflowName,
      idempotencyKey,
      ...(approvalReason ? { approvalReason } : {}),
    })
    return okResponse(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    return runtimeErrorResponse(error)
  }
}
