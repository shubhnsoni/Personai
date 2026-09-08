import {
  executionService,
  okResponse,
  requireCopilotRunAccess,
  runtimeErrorResponse,
} from "../_shared"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ runId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireCopilotRunAccess()
    if (!access.ok) return access.response
    const { runId } = await context.params
    const [run, audit] = await Promise.all([
      executionService.getWorkflow(access.scope, runId),
      executionService.listAudit(access.scope, runId),
    ])
    return okResponse({ run, audit })
  } catch (error) {
    return runtimeErrorResponse(error)
  }
}
