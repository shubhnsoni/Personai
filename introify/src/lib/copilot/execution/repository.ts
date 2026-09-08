import type {
  ApprovalDecision,
  BeginExecutionInput,
  BeginExecutionResult,
  ExecutionAuditEvent,
  ExecutionLease,
  ExecutionWorkflowRun,
  RunScope,
  StartWorkflowInput,
  StartWorkflowResult,
} from "./contracts"

export interface CopilotExecutionRepository {
  startWorkflow(scope: RunScope, input: StartWorkflowInput): Promise<StartWorkflowResult>
  getWorkflow(scope: RunScope, runId: string): Promise<ExecutionWorkflowRun>
  listWorkflows(scope: RunScope): Promise<readonly ExecutionWorkflowRun[]>
  decideApproval(
    scope: RunScope,
    runId: string,
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<ExecutionWorkflowRun>
  beginExecution(scope: RunScope, input: BeginExecutionInput): Promise<BeginExecutionResult>
  completeExecution(scope: RunScope, lease: ExecutionLease, output: unknown): Promise<ExecutionWorkflowRun>
  interruptExecution(
    scope: RunScope,
    lease: ExecutionLease,
    failureCode: string,
    failureDetail: string,
  ): Promise<ExecutionWorkflowRun>
  listAudit(scope: RunScope, runId: string): Promise<readonly ExecutionAuditEvent[]>
}
