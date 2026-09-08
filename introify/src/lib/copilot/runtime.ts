export const APPROVAL_REASONS = [
  "financial_commitment",
  "external_communication",
  "publish_change",
  "sensitive_data",
  "bulk_change",
] as const

export type ApprovalReason = (typeof APPROVAL_REASONS)[number]
export type WorkflowRunState = "queued" | "planning" | "awaiting_approval" | "executing" | "interrupted" | "completed" | "failed" | "cancelled"
export type AgentRunState = "queued" | "running" | "waiting_for_approval" | "completed" | "failed" | "cancelled"
export type StepState = "pending" | "running" | "completed" | "failed"
export type ApprovalState = "pending" | "granted" | "rejected"

export const WORKFLOW_TRANSITIONS: Readonly<Record<WorkflowRunState, readonly WorkflowRunState[]>> = {
  queued: ["planning", "cancelled"],
  planning: ["awaiting_approval", "executing", "failed", "cancelled"],
  awaiting_approval: ["executing", "failed", "cancelled"],
  executing: ["interrupted", "completed", "failed", "cancelled"],
  interrupted: ["executing", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
}

export const AGENT_TRANSITIONS: Readonly<Record<AgentRunState, readonly AgentRunState[]>> = {
  queued: ["running", "cancelled"],
  running: ["waiting_for_approval", "completed", "failed", "cancelled"],
  waiting_for_approval: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
}

export type AuditEventType =
  | "workflow.created"
  | "workflow.state_changed"
  | "agent.created"
  | "agent.state_changed"
  | "step.recorded"
  | "step.state_changed"
  | "tool_call.recorded"
  | "approval.requested"
  | "approval.granted"
  | "approval.rejected"

export type AuditEvent = Readonly<{
  id: string
  sequence: number
  at: string
  workflowRunId: string
  agentRunId?: string
  type: AuditEventType
  payload: Readonly<Record<string, unknown>>
}>

export type Approval = Readonly<{
  id: string
  workflowRunId: string
  reason: ApprovalReason
  state: ApprovalState
  requestedAt: string
  decidedAt?: string
  decidedBy?: string
}>

export type ToolCallRecord = Readonly<{
  id: string
  order: number
  name: string
  input: Readonly<Record<string, unknown>>
  recordedAt: string
}>

export type WorkflowStep = Readonly<{
  id: string
  order: number
  label: string
  state: StepState
  toolCalls: readonly ToolCallRecord[]
}>

export type AgentRun = Readonly<{
  id: string
  workflowRunId: string
  name: string
  state: AgentRunState
}>

export type WorkflowRun = Readonly<{
  id: string
  workflowName: string
  state: WorkflowRunState
  createdAt: string
  steps: readonly WorkflowStep[]
  approvals: readonly Approval[]
  agents: readonly AgentRun[]
}>

export type CreateWorkflowRunInput = {
  idempotencyKey: string
  workflowName: string
  approvalReason?: string | null
}

export type WorkflowStartOutcome = Readonly<{
  created: true
  run: WorkflowRun
}>

type MutableApproval = {
  id: string
  workflowRunId: string
  reason: ApprovalReason
  state: ApprovalState
  requestedAt: string
  decidedAt?: string
  decidedBy?: string
}

type MutableToolCall = {
  id: string
  order: number
  name: string
  input: Record<string, unknown>
  recordedAt: string
}

type MutableStep = {
  id: string
  order: number
  label: string
  state: StepState
  toolCalls: MutableToolCall[]
}

type MutableAgentRun = {
  id: string
  workflowRunId: string
  name: string
  state: AgentRunState
}

type MutableWorkflowRun = {
  id: string
  workflowName: string
  state: WorkflowRunState
  createdAt: string
  steps: Map<string, MutableStep>
  approvals: Map<string, MutableApproval>
  agents: Map<string, MutableAgentRun>
}

export class IllegalStateTransitionError extends Error {
  constructor(entity: "workflow" | "agent", from: string, to: string) {
    super(`Illegal ${entity} transition: ${from} -> ${to}`)
    this.name = "IllegalStateTransitionError"
  }
}

export class ApprovalRequiredError extends Error {
  constructor(workflowRunId: string) {
    super(`Workflow run ${workflowRunId} cannot execute until every requested approval is granted.`)
    this.name = "ApprovalRequiredError"
  }
}

export class InvalidApprovalReasonError extends Error {
  constructor(reason: unknown) {
    super(`Unsupported approval reason: ${String(reason)}`)
    this.name = "InvalidApprovalReasonError"
  }
}

export class LedgerImmutableError extends Error {
  constructor(operation: "mutate" | "delete") {
    super(`Audit ledger entries are append-only and cannot be ${operation}d.`)
    this.name = "LedgerImmutableError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T
  if (isRecord(value)) {
    const copied: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) copied[key] = clone(entry)
    return copied as T
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) value.forEach((entry) => deepFreeze(entry))
  else if (isRecord(value)) Object.values(value).forEach((entry) => deepFreeze(entry))
  if (value && typeof value === "object") Object.freeze(value)
  return value
}

function immutable<T>(value: T): Readonly<T> {
  return deepFreeze(clone(value)) as Readonly<T>
}

function stringPayload(event: AuditEvent, key: string): string {
  const value = event.payload[key]
  if (typeof value !== "string") throw new Error(`Ledger event ${event.id} is missing string payload.${key}.`)
  return value
}

function assertTransition<T extends string>(
  entity: "workflow" | "agent",
  transitions: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
) {
  if (!transitions[from].includes(to)) throw new IllegalStateTransitionError(entity, from, to)
}

export function isApprovalReason(value: unknown): value is ApprovalReason {
  return typeof value === "string" && (APPROVAL_REASONS as readonly string[]).includes(value)
}

/**
 * Pure reference runtime for the owner copilot. It deliberately owns no database connection;
 * its append-only ledger is both the audit contract and the source for recovery tests.
 */
export class InMemoryCopilotRuntime {
  private readonly workflows = new Map<string, MutableWorkflowRun>()
  private readonly idempotency = new Map<string, WorkflowStartOutcome>()
  private readonly events: AuditEvent[] = []
  private nextWorkflowNumber = 1
  private nextAgentNumber = 1
  private nextStepNumber = 1
  private nextToolCallNumber = 1
  private nextApprovalNumber = 1

  constructor(private readonly clock: () => Date = () => new Date()) {}

  static fromLedger(events: readonly AuditEvent[], clock: () => Date = () => new Date()) {
    const runtime = new InMemoryCopilotRuntime(clock)
    let previousSequence = 0
    for (const source of events) {
      if (source.sequence <= previousSequence) throw new Error("Ledger sequence must be strictly increasing.")
      previousSequence = source.sequence
      const event = immutable(source) as AuditEvent
      runtime.events.push(event)
      runtime.applyEvent(event)
    }
    runtime.nextWorkflowNumber = runtime.workflows.size + 1
    runtime.nextAgentNumber = runtime.events.filter((event) => event.type === "agent.created").length + 1
    runtime.nextStepNumber = runtime.events.filter((event) => event.type === "step.recorded").length + 1
    runtime.nextToolCallNumber = runtime.events.filter((event) => event.type === "tool_call.recorded").length + 1
    runtime.nextApprovalNumber = runtime.events.filter((event) => event.type === "approval.requested").length + 1
    for (const workflow of runtime.workflows.values()) {
      if ([...workflow.steps.values()].some((step) => step.state === "running") && workflow.state === "executing") {
        workflow.state = "interrupted"
      }
    }
    return runtime
  }

  createWorkflowRun(input: CreateWorkflowRunInput): WorkflowStartOutcome {
    const existing = this.idempotency.get(input.idempotencyKey)
    if (existing) return existing
    if (!input.idempotencyKey.trim()) throw new Error("An idempotency key is required.")
    if (!input.workflowName.trim()) throw new Error("A workflow name is required.")
    if (input.approvalReason !== undefined && input.approvalReason !== null && !isApprovalReason(input.approvalReason)) {
      throw new InvalidApprovalReasonError(input.approvalReason)
    }

    const id = `workflow-${this.nextWorkflowNumber++}`
    const createdAt = this.now()
    const workflow: MutableWorkflowRun = {
      id,
      workflowName: input.workflowName,
      state: "queued",
      createdAt,
      steps: new Map(),
      approvals: new Map(),
      agents: new Map(),
    }
    this.workflows.set(id, workflow)
    this.append(id, "workflow.created", { workflowName: input.workflowName, idempotencyKey: input.idempotencyKey })
    if (input.approvalReason) this.requestApproval(id, input.approvalReason)

    const outcome = immutable({ created: true as const, run: this.snapshot(workflow) }) as WorkflowStartOutcome
    this.idempotency.set(input.idempotencyKey, outcome)
    return outcome
  }

  transitionWorkflow(workflowRunId: string, to: WorkflowRunState): WorkflowRun {
    const workflow = this.readWorkflow(workflowRunId)
    if (to === "executing" && this.hasPendingApproval(workflow)) throw new ApprovalRequiredError(workflowRunId)
    assertTransition("workflow", WORKFLOW_TRANSITIONS, workflow.state, to)
    const from = workflow.state
    workflow.state = to
    this.append(workflowRunId, "workflow.state_changed", { from, to })
    return this.snapshot(workflow)
  }

  resumeRecoveredWorkflow(workflowRunId: string): WorkflowRun {
    return this.transitionWorkflow(workflowRunId, "executing")
  }

  createAgentRun(workflowRunId: string, name: string): AgentRun {
    const workflow = this.readWorkflow(workflowRunId)
    if (!name.trim()) throw new Error("An agent name is required.")
    const agent: MutableAgentRun = {
      id: `agent-${this.nextAgentNumber++}`,
      workflowRunId,
      name,
      state: "queued",
    }
    workflow.agents.set(agent.id, agent)
    this.append(workflowRunId, "agent.created", { agentRunId: agent.id, name }, agent.id)
    return this.snapshotAgent(agent)
  }

  transitionAgent(agentRunId: string, to: AgentRunState): AgentRun {
    const { workflow, agent } = this.readAgent(agentRunId)
    assertTransition("agent", AGENT_TRANSITIONS, agent.state, to)
    const from = agent.state
    agent.state = to
    this.append(workflow.id, "agent.state_changed", { from, to }, agent.id)
    return this.snapshotAgent(agent)
  }

  recordStep(workflowRunId: string, label: string): WorkflowStep {
    const workflow = this.readWorkflow(workflowRunId)
    if (workflow.state !== "planning" && workflow.state !== "executing") {
      throw new Error("Steps may only be recorded while a workflow is planning or executing.")
    }
    if (!label.trim()) throw new Error("A step label is required.")
    const step: MutableStep = {
      id: `step-${this.nextStepNumber++}`,
      order: workflow.steps.size + 1,
      label,
      state: "pending",
      toolCalls: [],
    }
    workflow.steps.set(step.id, step)
    this.append(workflowRunId, "step.recorded", { stepId: step.id, order: step.order, label })
    return this.snapshotStep(step)
  }

  transitionStep(workflowRunId: string, stepId: string, to: StepState): WorkflowStep {
    const workflow = this.readWorkflow(workflowRunId)
    const step = workflow.steps.get(stepId)
    if (!step) throw new Error(`Unknown step ${stepId}.`)
    const legal: Readonly<Record<StepState, readonly StepState[]>> = {
      pending: ["running"],
      running: ["completed", "failed"],
      completed: [],
      failed: [],
    }
    if (!legal[step.state].includes(to)) throw new IllegalStateTransitionError("workflow", `step:${step.state}`, `step:${to}`)
    const from = step.state
    step.state = to
    this.append(workflowRunId, "step.state_changed", { stepId, from, to })
    return this.snapshotStep(step)
  }

  recordToolCall(workflowRunId: string, stepId: string, name: string, input: Record<string, unknown>): ToolCallRecord {
    const workflow = this.readWorkflow(workflowRunId)
    if (workflow.state !== "executing") throw new Error("Tool calls require an executing workflow.")
    const step = workflow.steps.get(stepId)
    if (!step || step.state !== "running") throw new Error("Tool calls require a running step.")
    if (!name.trim()) throw new Error("A tool name is required.")
    const toolCall: MutableToolCall = {
      id: `tool-call-${this.nextToolCallNumber++}`,
      order: step.toolCalls.length + 1,
      name,
      input: clone(input),
      recordedAt: this.now(),
    }
    step.toolCalls.push(toolCall)
    this.append(workflowRunId, "tool_call.recorded", {
      stepId,
      toolCallId: toolCall.id,
      order: toolCall.order,
      name,
      input: toolCall.input,
      recordedAt: toolCall.recordedAt,
    })
    return this.snapshotToolCall(toolCall)
  }

  grantApproval(workflowRunId: string, approvalId: string, actor: string): Approval {
    const workflow = this.readWorkflow(workflowRunId)
    const approval = workflow.approvals.get(approvalId)
    if (!approval || approval.state !== "pending") throw new Error(`Approval ${approvalId} is not pending.`)
    if (!actor.trim()) throw new Error("An approval actor is required.")
    approval.state = "granted"
    approval.decidedAt = this.now()
    approval.decidedBy = actor
    this.append(workflowRunId, "approval.granted", { approvalId, actor, decidedAt: approval.decidedAt })
    return this.snapshotApproval(approval)
  }

  rejectApproval(workflowRunId: string, approvalId: string, actor: string): Approval {
    const workflow = this.readWorkflow(workflowRunId)
    const approval = workflow.approvals.get(approvalId)
    if (!approval || approval.state !== "pending") throw new Error(`Approval ${approvalId} is not pending.`)
    if (!actor.trim()) throw new Error("An approval actor is required.")
    approval.state = "rejected"
    approval.decidedAt = this.now()
    approval.decidedBy = actor
    this.append(workflowRunId, "approval.rejected", { approvalId, actor, decidedAt: approval.decidedAt })
    return this.snapshotApproval(approval)
  }

  getWorkflowRun(workflowRunId: string): WorkflowRun {
    return this.snapshot(this.readWorkflow(workflowRunId))
  }

  listWorkflowRuns(): readonly WorkflowRun[] {
    return immutable([...this.workflows.values()].map((workflow) => this.snapshot(workflow))) as readonly WorkflowRun[]
  }

  listAuditEvents(): readonly AuditEvent[] {
    return immutable(this.events) as readonly AuditEvent[]
  }

  mutateAuditEntry(): never {
    throw new LedgerImmutableError("mutate")
  }

  deleteAuditEntry(): never {
    throw new LedgerImmutableError("delete")
  }

  private requestApproval(workflowRunId: string, reason: ApprovalReason) {
    if (!isApprovalReason(reason)) throw new InvalidApprovalReasonError(reason)
    const workflow = this.readWorkflow(workflowRunId)
    const approval: MutableApproval = {
      id: `approval-${this.nextApprovalNumber++}`,
      workflowRunId,
      reason,
      state: "pending",
      requestedAt: this.now(),
    }
    workflow.approvals.set(approval.id, approval)
    this.append(workflowRunId, "approval.requested", {
      approvalId: approval.id,
      reason,
      requestedAt: approval.requestedAt,
    })
  }

  private hasPendingApproval(workflow: MutableWorkflowRun) {
    return [...workflow.approvals.values()].some((approval) => approval.state === "pending")
  }

  private readWorkflow(workflowRunId: string): MutableWorkflowRun {
    const workflow = this.workflows.get(workflowRunId)
    if (!workflow) throw new Error(`Unknown workflow run ${workflowRunId}.`)
    return workflow
  }

  private readAgent(agentRunId: string): { workflow: MutableWorkflowRun; agent: MutableAgentRun } {
    for (const workflow of this.workflows.values()) {
      const agent = workflow.agents.get(agentRunId)
      if (agent) return { workflow, agent }
    }
    throw new Error(`Unknown agent run ${agentRunId}.`)
  }

  private append(workflowRunId: string, type: AuditEventType, payload: Record<string, unknown>, agentRunId?: string) {
    const event: AuditEvent = immutable({
      id: `event-${this.events.length + 1}`,
      sequence: this.events.length + 1,
      at: this.now(),
      workflowRunId,
      ...(agentRunId ? { agentRunId } : {}),
      type,
      payload,
    }) as AuditEvent
    this.events.push(event)
  }

  private applyEvent(event: AuditEvent) {
    if (event.type === "workflow.created") {
      this.workflows.set(event.workflowRunId, {
        id: event.workflowRunId,
        workflowName: stringPayload(event, "workflowName"),
        state: "queued",
        createdAt: event.at,
        steps: new Map(),
        approvals: new Map(),
        agents: new Map(),
      })
      const key = stringPayload(event, "idempotencyKey")
      this.idempotency.set(key, immutable({ created: true as const, run: this.snapshot(this.readWorkflow(event.workflowRunId)) }) as WorkflowStartOutcome)
      return
    }

    const workflow = this.readWorkflow(event.workflowRunId)
    if (event.type === "workflow.state_changed") {
      workflow.state = stringPayload(event, "to") as WorkflowRunState
      return
    }
    if (event.type === "approval.requested") {
      const reason = stringPayload(event, "reason")
      if (!isApprovalReason(reason)) throw new InvalidApprovalReasonError(reason)
      const approval: MutableApproval = {
        id: stringPayload(event, "approvalId"),
        workflowRunId: workflow.id,
        reason,
        state: "pending",
        requestedAt: stringPayload(event, "requestedAt"),
      }
      workflow.approvals.set(approval.id, approval)
      return
    }
    if (event.type === "approval.granted" || event.type === "approval.rejected") {
      const approval = workflow.approvals.get(stringPayload(event, "approvalId"))
      if (!approval) throw new Error(`Ledger approval decision references an unknown approval.`)
      approval.state = event.type === "approval.granted" ? "granted" : "rejected"
      approval.decidedAt = stringPayload(event, "decidedAt")
      approval.decidedBy = stringPayload(event, "actor")
      return
    }
    if (event.type === "agent.created") {
      const id = stringPayload(event, "agentRunId")
      workflow.agents.set(id, { id, workflowRunId: workflow.id, name: stringPayload(event, "name"), state: "queued" })
      return
    }
    if (event.type === "agent.state_changed") {
      if (!event.agentRunId) throw new Error(`Ledger agent state event ${event.id} has no agent id.`)
      const agent = workflow.agents.get(event.agentRunId)
      if (!agent) throw new Error(`Ledger agent state event ${event.id} references an unknown agent.`)
      agent.state = stringPayload(event, "to") as AgentRunState
      return
    }
    if (event.type === "step.recorded") {
      const id = stringPayload(event, "stepId")
      const order = event.payload.order
      if (typeof order !== "number") throw new Error(`Ledger event ${event.id} has no numeric step order.`)
      workflow.steps.set(id, { id, order, label: stringPayload(event, "label"), state: "pending", toolCalls: [] })
      return
    }
    if (event.type === "step.state_changed") {
      const step = workflow.steps.get(stringPayload(event, "stepId"))
      if (!step) throw new Error(`Ledger step state event ${event.id} references an unknown step.`)
      step.state = stringPayload(event, "to") as StepState
      return
    }
    if (event.type === "tool_call.recorded") {
      const step = workflow.steps.get(stringPayload(event, "stepId"))
      if (!step) throw new Error(`Ledger tool call event ${event.id} references an unknown step.`)
      const order = event.payload.order
      const input = event.payload.input
      if (typeof order !== "number" || !isRecord(input)) throw new Error(`Ledger tool call event ${event.id} is malformed.`)
      step.toolCalls.push({
        id: stringPayload(event, "toolCallId"),
        order,
        name: stringPayload(event, "name"),
        input: clone(input),
        recordedAt: stringPayload(event, "recordedAt"),
      })
    }
  }

  private now() {
    return this.clock().toISOString()
  }

  private snapshot(workflow: MutableWorkflowRun): WorkflowRun {
    return immutable({
      id: workflow.id,
      workflowName: workflow.workflowName,
      state: workflow.state,
      createdAt: workflow.createdAt,
      steps: [...workflow.steps.values()].sort((a, b) => a.order - b.order).map((step) => this.snapshotStep(step)),
      approvals: [...workflow.approvals.values()].map((approval) => this.snapshotApproval(approval)),
      agents: [...workflow.agents.values()].map((agent) => this.snapshotAgent(agent)),
    }) as WorkflowRun
  }

  private snapshotStep(step: MutableStep): WorkflowStep {
    return immutable({
      id: step.id,
      order: step.order,
      label: step.label,
      state: step.state,
      toolCalls: step.toolCalls.sort((a, b) => a.order - b.order).map((call) => this.snapshotToolCall(call)),
    }) as WorkflowStep
  }

  private snapshotToolCall(call: MutableToolCall): ToolCallRecord {
    return immutable(call) as ToolCallRecord
  }

  private snapshotApproval(approval: MutableApproval): Approval {
    return immutable(approval) as Approval
  }

  private snapshotAgent(agent: MutableAgentRun): AgentRun {
    return immutable(agent) as AgentRun
  }
}
