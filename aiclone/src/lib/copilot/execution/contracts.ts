import type { ApprovalReason, AgentRunState, ApprovalState, StepState, WorkflowRunState } from "../runtime"

export type RunScope = Readonly<{
  profileId: string
  actorId: string
}>

export type ExecutionApproval = Readonly<{
  id: string
  workflowRunId: string
  workflowStepId: string | null
  reason: ApprovalReason
  state: ApprovalState
  requestedBy: string
  requestedAt: string
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
}>

export type ExecutionToolCall = Readonly<{
  id: string
  workflowStepId: string
  ordinal: number
  toolName: string
  input: Readonly<Record<string, unknown>>
  output: unknown
  state: "running" | "completed" | "failed"
  startedAt: string | null
  completedAt: string | null
  errorCode: string | null
}>

export type ExecutionStep = Readonly<{
  id: string
  workflowRunId: string
  ordinal: number
  label: string
  state: StepState
  input: unknown
  result: unknown
  startedAt: string | null
  completedAt: string | null
  toolCalls: readonly ExecutionToolCall[]
}>

export type ExecutionAgentRun = Readonly<{
  id: string
  workflowRunId: string
  agentKey: string
  state: AgentRunState
  attempt: number
  startedAt: string | null
  completedAt: string | null
  failureCode: string | null
}>

export type ExecutionWorkflowRun = Readonly<{
  id: string
  profileId: string
  workflowKey: string
  workflowName: string
  state: WorkflowRunState
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  failureCode: string | null
  failureDetail: string | null
  approvals: readonly ExecutionApproval[]
  agents: readonly ExecutionAgentRun[]
  steps: readonly ExecutionStep[]
}>

export type ExecutionAuditEvent = Readonly<{
  id: string
  workflowRunId: string
  agentRunId: string | null
  sequence: number
  eventType: string
  actorType: "user" | "runtime" | "agent"
  actorId: string | null
  occurredAt: string
  payload: Readonly<Record<string, unknown>>
}>

export type StartWorkflowInput = Readonly<{
  workflowKey: string
  workflowName: string
  idempotencyKey: string
  approvalReason?: ApprovalReason
}>

export type StartWorkflowResult = Readonly<{
  created: boolean
  run: ExecutionWorkflowRun
}>

export type ApprovalDecision = Readonly<{
  decision: "grant" | "reject"
  note?: string
}>

export type BeginExecutionInput = Readonly<{
  runId: string
  actionKey: string
  agentKey: string
  stepLabel: string
  toolName: string
  input: Readonly<Record<string, unknown>>
}>

export type ExecutionLease = Readonly<{
  runId: string
  agentRunId: string
  stepId: string
  toolCallId: string
  actionIdempotencyKey: string
}>

export type BeginExecutionResult =
  | Readonly<{ kind: "ready"; lease: ExecutionLease; run: ExecutionWorkflowRun }>
  | Readonly<{ kind: "replayed"; run: ExecutionWorkflowRun; output: unknown }>

export type ExecuteWorkflowInput = BeginExecutionInput

export type ExecuteWorkflowResult = Readonly<{
  replayed: boolean
  run: ExecutionWorkflowRun
  output: unknown
}>

export type CopilotActionContext = Readonly<{
  workflowRunId: string
  agentRunId: string
  stepId: string
  idempotencyKey: string
  scope: RunScope
}>

export type CopilotAction = (
  input: Readonly<Record<string, unknown>>,
  context: CopilotActionContext,
) => Promise<unknown>

export class CopilotRuntimeError extends Error {
  constructor(
    readonly code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "APPROVAL_REQUIRED" | "ACTION_FAILED",
    message: string,
  ) {
    super(message)
    this.name = "CopilotRuntimeError"
  }
}

export function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new CopilotRuntimeError("BAD_REQUEST", `${field} is required.`)
  return normalized
}
