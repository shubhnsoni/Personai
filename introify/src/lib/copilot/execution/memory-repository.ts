import { isApprovalReason } from "../runtime"
import type {
  ApprovalDecision,
  BeginExecutionInput,
  BeginExecutionResult,
  ExecutionAgentRun,
  ExecutionApproval,
  ExecutionAuditEvent,
  ExecutionLease,
  ExecutionStep,
  ExecutionToolCall,
  ExecutionWorkflowRun,
  RunScope,
  StartWorkflowInput,
  StartWorkflowResult,
} from "./contracts"
import { CopilotRuntimeError } from "./contracts"
import type { CopilotExecutionRepository } from "./repository"

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }
type MutableApproval = Mutable<ExecutionApproval>
type MutableToolCall = Mutable<Omit<ExecutionToolCall, "input">> & { input: Record<string, unknown> }
type MutableStep = Mutable<Omit<ExecutionStep, "toolCalls">> & { toolCalls: MutableToolCall[] }
type MutableAgentRun = Mutable<ExecutionAgentRun>
type MutableRun = Mutable<Omit<ExecutionWorkflowRun, "approvals" | "agents" | "steps">> & {
  approvals: MutableApproval[]
  agents: MutableAgentRun[]
  steps: MutableStep[]
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function freeze<T>(value: T): Readonly<T> {
  if (Array.isArray(value)) value.forEach((entry) => freeze(entry))
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => freeze(entry))
  return Object.freeze(value)
}

function immutable<T>(value: T): Readonly<T> {
  return freeze(clone(value))
}

function publicRun(run: MutableRun): ExecutionWorkflowRun {
  return immutable(run) as ExecutionWorkflowRun
}

export class InMemoryExecutionRepository implements CopilotExecutionRepository {
  private readonly runs = new Map<string, MutableRun>()
  private readonly idempotency = new Map<string, string>()
  private readonly audit = new Map<string, ExecutionAuditEvent[]>()
  private nextRun = 1
  private nextApproval = 1
  private nextAgent = 1
  private nextStep = 1
  private nextToolCall = 1
  private nextAudit = 1

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async startWorkflow(scope: RunScope, input: StartWorkflowInput): Promise<StartWorkflowResult> {
    const idempotencyIndex = `${scope.profileId}\u0000${input.idempotencyKey}`
    const existingId = this.idempotency.get(idempotencyIndex)
    if (existingId) return { created: false, run: publicRun(this.requireRun(scope, existingId)) }
    if (input.approvalReason && !isApprovalReason(input.approvalReason)) {
      throw new CopilotRuntimeError("BAD_REQUEST", "Unsupported approval reason.")
    }

    const now = this.now()
    const run: MutableRun = {
      id: `workflow-${this.nextRun++}`,
      profileId: scope.profileId,
      workflowKey: input.workflowKey,
      workflowName: input.workflowName,
      state: "queued",
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      failureCode: null,
      failureDetail: null,
      approvals: [],
      agents: [],
      steps: [],
    }
    this.runs.set(run.id, run)
    this.idempotency.set(idempotencyIndex, run.id)
    this.append(run, "workflow.created", "user", scope.actorId, {
      workflowKey: input.workflowKey,
      workflowName: input.workflowName,
      idempotencyKey: input.idempotencyKey,
    })
    this.transitionRun(run, "planning", scope.actorId)

    if (input.approvalReason) {
      const approval: MutableApproval = {
        id: `approval-${this.nextApproval++}`,
        workflowRunId: run.id,
        workflowStepId: null,
        reason: input.approvalReason,
        state: "pending",
        requestedBy: scope.actorId,
        requestedAt: this.now(),
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
      }
      run.approvals.push(approval)
      this.append(run, "approval.requested", "user", scope.actorId, {
        approvalId: approval.id,
        reason: approval.reason,
        requestedBy: approval.requestedBy,
      })
      this.transitionRun(run, "awaiting_approval", scope.actorId)
    }

    return { created: true, run: publicRun(run) }
  }

  async getWorkflow(scope: RunScope, runId: string): Promise<ExecutionWorkflowRun> {
    return publicRun(this.requireRun(scope, runId))
  }

  async listWorkflows(scope: RunScope): Promise<readonly ExecutionWorkflowRun[]> {
    return immutable(
      [...this.runs.values()]
        .filter((run) => run.profileId === scope.profileId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(publicRun),
    ) as readonly ExecutionWorkflowRun[]
  }

  async decideApproval(
    scope: RunScope,
    runId: string,
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<ExecutionWorkflowRun> {
    const run = this.requireRun(scope, runId)
    const approval = run.approvals.find((candidate) => candidate.id === approvalId)
    if (!approval) throw new CopilotRuntimeError("NOT_FOUND", "Approval was not found in this tenant.")
    if (approval.state !== "pending") throw new CopilotRuntimeError("CONFLICT", "Approval is no longer pending.")

    approval.state = decision.decision === "grant" ? "granted" : "rejected"
    approval.decidedAt = this.now()
    approval.decidedBy = scope.actorId
    approval.decisionNote = decision.note?.trim() || null
    this.append(run, `approval.${decision.decision === "grant" ? "granted" : "rejected"}`, "user", scope.actorId, {
      approvalId,
      decisionNote: approval.decisionNote,
    })
    if (decision.decision === "reject") this.transitionRun(run, "cancelled", scope.actorId)
    return publicRun(run)
  }

  async beginExecution(scope: RunScope, input: BeginExecutionInput): Promise<BeginExecutionResult> {
    const run = this.requireRun(scope, input.runId)
    if (run.state === "completed") {
      const completedStep = run.steps.find((step) => {
        const metadata = step.input as { actionKey?: unknown } | null
        return step.state === "completed" && metadata?.actionKey === input.actionKey
      })
      if (!completedStep) throw new CopilotRuntimeError("CONFLICT", "The completed run used a different action.")
      return { kind: "replayed", run: publicRun(run), output: completedStep.result }
    }
    if (run.state === "failed" || run.state === "cancelled") {
      throw new CopilotRuntimeError("CONFLICT", `A ${run.state} workflow cannot execute.`)
    }
    if (run.state === "executing") throw new CopilotRuntimeError("CONFLICT", "The workflow is already executing.")
    if (run.approvals.some((approval) => approval.state === "pending")) {
      throw new CopilotRuntimeError("APPROVAL_REQUIRED", "Every requested approval must be granted before execution.")
    }
    if (run.approvals.some((approval) => approval.state === "rejected")) {
      throw new CopilotRuntimeError("CONFLICT", "A rejected workflow cannot execute.")
    }

    if (run.state === "queued") this.transitionRun(run, "planning", scope.actorId)
    this.transitionRun(run, "executing", scope.actorId)

    const attempt = Math.max(0, ...run.agents.filter((agent) => agent.agentKey === input.agentKey).map((agent) => agent.attempt)) + 1
    const agent: MutableAgentRun = {
      id: `agent-${this.nextAgent++}`,
      workflowRunId: run.id,
      agentKey: input.agentKey,
      state: "queued",
      attempt,
      startedAt: null,
      completedAt: null,
      failureCode: null,
    }
    run.agents.push(agent)
    this.append(run, "agent.created", "runtime", scope.actorId, {
      agentRunId: agent.id,
      agentKey: agent.agentKey,
      attempt,
    }, agent.id)
    agent.state = "running"
    agent.startedAt = this.now()
    this.append(run, "agent.state_changed", "runtime", scope.actorId, {
      agentRunId: agent.id,
      from: "queued",
      to: "running",
    }, agent.id)

    const step: MutableStep = {
      id: `step-${this.nextStep++}`,
      workflowRunId: run.id,
      ordinal: run.steps.length + 1,
      label: input.stepLabel,
      state: "pending",
      input: { actionKey: input.actionKey, input: clone(input.input) },
      result: null,
      startedAt: null,
      completedAt: null,
      toolCalls: [],
    }
    run.steps.push(step)
    this.append(run, "step.recorded", "runtime", scope.actorId, {
      stepId: step.id,
      ordinal: step.ordinal,
      label: step.label,
    }, agent.id)
    step.state = "running"
    step.startedAt = this.now()
    this.append(run, "step.state_changed", "runtime", scope.actorId, {
      stepId: step.id,
      from: "pending",
      to: "running",
    }, agent.id)

    const toolCall: MutableToolCall = {
      id: `tool-call-${this.nextToolCall++}`,
      workflowStepId: step.id,
      ordinal: 1,
      toolName: input.toolName,
      input: clone(input.input),
      output: null,
      state: "running",
      startedAt: this.now(),
      completedAt: null,
      errorCode: null,
    }
    step.toolCalls.push(toolCall)
    this.append(run, "tool_call.started", "agent", agent.id, {
      stepId: step.id,
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      actionKey: input.actionKey,
    }, agent.id)

    return {
      kind: "ready",
      lease: {
        runId: run.id,
        agentRunId: agent.id,
        stepId: step.id,
        toolCallId: toolCall.id,
        actionIdempotencyKey: `${run.id}:${input.actionKey}`,
      },
      run: publicRun(run),
    }
  }

  async completeExecution(scope: RunScope, lease: ExecutionLease, output: unknown): Promise<ExecutionWorkflowRun> {
    const { run, agent, step, toolCall } = this.requireLease(scope, lease)
    const now = this.now()
    toolCall.state = "completed"
    toolCall.output = clone(output)
    toolCall.completedAt = now
    step.state = "completed"
    step.result = clone(output)
    step.completedAt = now
    agent.state = "completed"
    agent.completedAt = now
    run.state = "completed"
    run.completedAt = now
    run.failureCode = null
    run.failureDetail = null
    run.updatedAt = now
    this.append(run, "tool_call.completed", "agent", agent.id, { stepId: step.id, toolCallId: toolCall.id }, agent.id)
    this.append(run, "step.state_changed", "runtime", scope.actorId, { stepId: step.id, from: "running", to: "completed" }, agent.id)
    this.append(run, "agent.state_changed", "runtime", scope.actorId, { agentRunId: agent.id, from: "running", to: "completed" }, agent.id)
    this.append(run, "workflow.state_changed", "runtime", scope.actorId, { from: "executing", to: "completed" })
    return publicRun(run)
  }

  async interruptExecution(
    scope: RunScope,
    lease: ExecutionLease,
    failureCode: string,
    failureDetail: string,
  ): Promise<ExecutionWorkflowRun> {
    const { run, agent, step, toolCall } = this.requireLease(scope, lease)
    const now = this.now()
    toolCall.state = "failed"
    toolCall.completedAt = now
    toolCall.errorCode = failureCode
    step.state = "failed"
    step.completedAt = now
    agent.state = "failed"
    agent.completedAt = now
    agent.failureCode = failureCode
    run.state = "interrupted"
    run.failureCode = failureCode
    run.failureDetail = failureDetail
    run.updatedAt = now
    this.append(run, "tool_call.failed", "agent", agent.id, { stepId: step.id, toolCallId: toolCall.id, failureCode }, agent.id)
    this.append(run, "step.state_changed", "runtime", scope.actorId, { stepId: step.id, from: "running", to: "failed" }, agent.id)
    this.append(run, "agent.state_changed", "runtime", scope.actorId, { agentRunId: agent.id, from: "running", to: "failed", failureCode }, agent.id)
    this.append(run, "workflow.state_changed", "runtime", scope.actorId, { from: "executing", to: "interrupted", failureCode })
    return publicRun(run)
  }

  async listAudit(scope: RunScope, runId: string): Promise<readonly ExecutionAuditEvent[]> {
    this.requireRun(scope, runId)
    return immutable(this.audit.get(runId) ?? []) as readonly ExecutionAuditEvent[]
  }

  private requireRun(scope: RunScope, runId: string): MutableRun {
    const run = this.runs.get(runId)
    if (!run || run.profileId !== scope.profileId) {
      throw new CopilotRuntimeError("NOT_FOUND", "Workflow run was not found in this tenant.")
    }
    return run
  }

  private requireLease(scope: RunScope, lease: ExecutionLease) {
    const run = this.requireRun(scope, lease.runId)
    const agent = run.agents.find((candidate) => candidate.id === lease.agentRunId)
    const step = run.steps.find((candidate) => candidate.id === lease.stepId)
    const toolCall = step?.toolCalls.find((candidate) => candidate.id === lease.toolCallId)
    if (!agent || !step || !toolCall || run.state !== "executing" || agent.state !== "running" || step.state !== "running" || toolCall.state !== "running") {
      throw new CopilotRuntimeError("CONFLICT", "Execution lease is stale or invalid.")
    }
    return { run, agent, step, toolCall }
  }

  private transitionRun(run: MutableRun, to: MutableRun["state"], actorId: string) {
    const from = run.state
    run.state = to
    run.updatedAt = this.now()
    this.append(run, "workflow.state_changed", "runtime", actorId, { from, to })
  }

  private append(
    run: MutableRun,
    eventType: string,
    actorType: ExecutionAuditEvent["actorType"],
    actorId: string | null,
    payload: Record<string, unknown>,
    agentRunId: string | null = null,
  ) {
    const events = this.audit.get(run.id) ?? []
    const event = immutable({
      id: `audit-${this.nextAudit++}`,
      workflowRunId: run.id,
      agentRunId,
      sequence: events.length + 1,
      eventType,
      actorType,
      actorId,
      occurredAt: this.now(),
      payload,
    }) as ExecutionAuditEvent
    events.push(event)
    this.audit.set(run.id, events)
  }

  private now() {
    return this.clock().toISOString()
  }
}
