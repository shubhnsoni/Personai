import type {
  ApprovalDecision,
  CopilotAction,
  ExecuteWorkflowInput,
  ExecuteWorkflowResult,
  RunScope,
  StartWorkflowInput,
} from "./contracts"
import { CopilotRuntimeError, requireNonEmpty } from "./contracts"
import type { CopilotExecutionRepository } from "./repository"

function failureDetail(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 1000)
  return "The action failed with a non-Error value."
}

export class CopilotExecutionService {
  constructor(private readonly repository: CopilotExecutionRepository) {}

  startWorkflow(scope: RunScope, input: StartWorkflowInput) {
    requireNonEmpty(scope.profileId, "profileId")
    requireNonEmpty(scope.actorId, "actorId")
    requireNonEmpty(input.workflowKey, "workflowKey")
    requireNonEmpty(input.workflowName, "workflowName")
    requireNonEmpty(input.idempotencyKey, "idempotencyKey")
    return this.repository.startWorkflow(scope, input)
  }

  getWorkflow(scope: RunScope, runId: string) {
    return this.repository.getWorkflow(scope, requireNonEmpty(runId, "runId"))
  }

  listWorkflows(scope: RunScope) {
    return this.repository.listWorkflows(scope)
  }

  decideApproval(scope: RunScope, runId: string, approvalId: string, decision: ApprovalDecision) {
    return this.repository.decideApproval(
      scope,
      requireNonEmpty(runId, "runId"),
      requireNonEmpty(approvalId, "approvalId"),
      decision,
    )
  }

  listAudit(scope: RunScope, runId: string) {
    return this.repository.listAudit(scope, requireNonEmpty(runId, "runId"))
  }

  async execute(
    scope: RunScope,
    input: ExecuteWorkflowInput,
    action: CopilotAction,
  ): Promise<ExecuteWorkflowResult> {
    requireNonEmpty(input.runId, "runId")
    requireNonEmpty(input.actionKey, "actionKey")
    requireNonEmpty(input.agentKey, "agentKey")
    requireNonEmpty(input.stepLabel, "stepLabel")
    requireNonEmpty(input.toolName, "toolName")

    // beginExecution performs the tenant and pending-approval checks before it
    // creates an agent, step, or tool-call lease. The action is invoked only after it succeeds.
    const begun = await this.repository.beginExecution(scope, input)
    if (begun.kind === "replayed") {
      return { replayed: true, run: begun.run, output: begun.output }
    }

    try {
      const output = await action(input.input, {
        workflowRunId: begun.lease.runId,
        agentRunId: begun.lease.agentRunId,
        stepId: begun.lease.stepId,
        idempotencyKey: begun.lease.actionIdempotencyKey,
        scope,
      })
      const run = await this.repository.completeExecution(scope, begun.lease, output)
      return { replayed: false, run, output }
    } catch (error) {
      await this.repository.interruptExecution(
        scope,
        begun.lease,
        "ACTION_FAILED",
        failureDetail(error),
      )
      if (error instanceof CopilotRuntimeError) throw error
      throw new CopilotRuntimeError("ACTION_FAILED", failureDetail(error))
    }
  }
}
