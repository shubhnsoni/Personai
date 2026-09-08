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

type UnknownRecord = Record<string, unknown>
type Delegate = {
  findFirst<T = unknown>(args: unknown): Promise<T | null>
  findMany<T = unknown>(args: unknown): Promise<T[]>
  create<T = unknown>(args: unknown): Promise<T>
  update<T = unknown>(args: unknown): Promise<T>
  updateMany<T = { count: number }>(args: unknown): Promise<T>
  aggregate<T = unknown>(args: unknown): Promise<T>
}

type PrismaCopilotTransaction = {
  workflowRun: Delegate
  agentRun: Delegate
  workflowStep: Delegate
  toolCall: Delegate
  approval: Delegate
  copilotAuditEvent: Delegate
}

type PrismaCopilotClient = PrismaCopilotTransaction & {
  $transaction<T>(operation: (tx: PrismaCopilotTransaction) => Promise<T>): Promise<T>
}

type DbApproval = {
  id: string
  workflowRunId: string
  workflowStepId: string | null
  reason: string
  state: string
  requestedBy: string
  requestedAt: Date | string
  decidedBy: string | null
  decidedAt: Date | string | null
  decisionNote: string | null
}

type DbToolCall = {
  id: string
  workflowStepId: string
  ordinal: number
  toolName: string
  inputJson: unknown
  outputJson: unknown
  state: string
  startedAt: Date | string | null
  completedAt: Date | string | null
  errorCode: string | null
}

type DbStep = {
  id: string
  workflowRunId: string
  ordinal: number
  label: string
  state: string
  inputJson: unknown
  resultJson: unknown
  startedAt: Date | string | null
  completedAt: Date | string | null
  toolCalls: DbToolCall[]
}

type DbAgentRun = {
  id: string
  workflowRunId: string
  agentKey: string
  state: string
  attempt: number
  startedAt: Date | string | null
  completedAt: Date | string | null
  failureCode: string | null
}

type DbRun = {
  id: string
  profileId: string | null
  workflowKey: string
  workflowName: string
  state: string
  idempotencyKey: string
  createdAt: Date | string
  updatedAt: Date | string
  completedAt: Date | string | null
  failureCode: string | null
  failureDetail: string | null
  approvals: DbApproval[]
  agentRuns: DbAgentRun[]
  steps: DbStep[]
}

type DbAuditEvent = {
  id: string
  workflowRunId: string
  agentRunId: string | null
  sequence: number
  eventType: string
  actorType: string
  actorId: string | null
  occurredAt: Date | string
  payloadJson: unknown
}

const RUN_INCLUDE = {
  approvals: { orderBy: { requestedAt: "asc" } },
  agentRuns: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  steps: {
    orderBy: { ordinal: "asc" },
    include: { toolCalls: { orderBy: { ordinal: "asc" } } },
  },
} as const

function iso(value: Date | string): string
function iso(value: Date | string | null): string | null
function iso(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : Object.freeze({})
}

function json(value: unknown): unknown {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    throw new CopilotRuntimeError("BAD_REQUEST", "Action input and output must be JSON-serializable.")
  }
}

function mapApproval(row: DbApproval): ExecutionApproval {
  return {
    id: row.id,
    workflowRunId: row.workflowRunId,
    workflowStepId: row.workflowStepId,
    reason: row.reason as ExecutionApproval["reason"],
    state: row.state as ExecutionApproval["state"],
    requestedBy: row.requestedBy,
    requestedAt: iso(row.requestedAt),
    decidedBy: row.decidedBy,
    decidedAt: iso(row.decidedAt),
    decisionNote: row.decisionNote,
  }
}

function mapToolCall(row: DbToolCall): ExecutionToolCall {
  return {
    id: row.id,
    workflowStepId: row.workflowStepId,
    ordinal: row.ordinal,
    toolName: row.toolName,
    input: record(row.inputJson),
    output: row.outputJson,
    state: row.state as ExecutionToolCall["state"],
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    errorCode: row.errorCode,
  }
}

function mapStep(row: DbStep): ExecutionStep {
  return {
    id: row.id,
    workflowRunId: row.workflowRunId,
    ordinal: row.ordinal,
    label: row.label,
    state: row.state as ExecutionStep["state"],
    input: row.inputJson,
    result: row.resultJson,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    toolCalls: row.toolCalls.map(mapToolCall),
  }
}

function mapAgent(row: DbAgentRun): ExecutionAgentRun {
  return {
    id: row.id,
    workflowRunId: row.workflowRunId,
    agentKey: row.agentKey,
    state: row.state as ExecutionAgentRun["state"],
    attempt: row.attempt,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    failureCode: row.failureCode,
  }
}

function mapRun(row: DbRun): ExecutionWorkflowRun {
  if (!row.profileId) throw new CopilotRuntimeError("NOT_FOUND", "Workflow has no tenant owner.")
  return {
    id: row.id,
    profileId: row.profileId,
    workflowKey: row.workflowKey,
    workflowName: row.workflowName,
    state: row.state as ExecutionWorkflowRun["state"],
    idempotencyKey: row.idempotencyKey,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    completedAt: iso(row.completedAt),
    failureCode: row.failureCode,
    failureDetail: row.failureDetail,
    approvals: row.approvals.map(mapApproval),
    agents: row.agentRuns.map(mapAgent),
    steps: row.steps.map(mapStep),
  }
}

function mapAudit(row: DbAuditEvent): ExecutionAuditEvent {
  const actorType = row.actorType === "user" || row.actorType === "agent" ? row.actorType : "runtime"
  return {
    id: row.id,
    workflowRunId: row.workflowRunId,
    agentRunId: row.agentRunId,
    sequence: row.sequence,
    eventType: row.eventType,
    actorType,
    actorId: row.actorId,
    occurredAt: iso(row.occurredAt),
    payload: record(row.payloadJson),
  }
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002")
}

export class PrismaCopilotExecutionRepository implements CopilotExecutionRepository {
  private readonly client: PrismaCopilotClient

  constructor(client: object) {
    // This structural cast intentionally avoids requiring `prisma generate` in worker
    // worktrees. The committed schema is validated separately and supplies these delegates
    // in the integration-generated client.
    this.client = client as PrismaCopilotClient
  }

  async startWorkflow(scope: RunScope, input: StartWorkflowInput): Promise<StartWorkflowResult> {
    try {
      return await this.client.$transaction(async (tx) => {
        const existing = await this.findByIdempotency(tx, scope, input.idempotencyKey)
        if (existing) return { created: false, run: mapRun(existing) }

        const created = await tx.workflowRun.create<{ id: string }>({
          data: {
            profileId: scope.profileId,
            workflowKey: input.workflowKey,
            workflowName: input.workflowName,
            state: "queued",
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true },
        })
        await this.append(tx, created.id, "workflow.created", "user", scope.actorId, {
          workflowKey: input.workflowKey,
          workflowName: input.workflowName,
          idempotencyKey: input.idempotencyKey,
        })
        await tx.workflowRun.update({ where: { id: created.id }, data: { state: "planning" } })
        await this.append(tx, created.id, "workflow.state_changed", "runtime", scope.actorId, {
          from: "queued",
          to: "planning",
        })

        if (input.approvalReason) {
          const approval = await tx.approval.create<{ id: string }>({
            data: {
              workflowRunId: created.id,
              reason: input.approvalReason,
              state: "pending",
              requestedBy: scope.actorId,
            },
            select: { id: true },
          })
          await this.append(tx, created.id, "approval.requested", "user", scope.actorId, {
            approvalId: approval.id,
            reason: input.approvalReason,
            requestedBy: scope.actorId,
          })
          await tx.workflowRun.update({ where: { id: created.id }, data: { state: "awaiting_approval" } })
          await this.append(tx, created.id, "workflow.state_changed", "runtime", scope.actorId, {
            from: "planning",
            to: "awaiting_approval",
          })
        }

        return { created: true, run: mapRun(await this.requireRun(tx, scope, created.id)) }
      })
    } catch (error) {
      if (!isUniqueConflict(error)) throw error
      const existing = await this.findByIdempotency(this.client, scope, input.idempotencyKey)
      if (!existing) throw error
      return { created: false, run: mapRun(existing) }
    }
  }

  async getWorkflow(scope: RunScope, runId: string): Promise<ExecutionWorkflowRun> {
    return mapRun(await this.requireRun(this.client, scope, runId))
  }

  async listWorkflows(scope: RunScope): Promise<readonly ExecutionWorkflowRun[]> {
    const rows = await this.client.workflowRun.findMany<DbRun>({
      where: { profileId: scope.profileId },
      include: RUN_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
    return rows.map(mapRun)
  }

  async decideApproval(
    scope: RunScope,
    runId: string,
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<ExecutionWorkflowRun> {
    return this.client.$transaction(async (tx) => {
      const run = await this.requireRun(tx, scope, runId)
      const approval = await tx.approval.findFirst<DbApproval>({ where: { id: approvalId, workflowRunId: run.id } })
      if (!approval) throw new CopilotRuntimeError("NOT_FOUND", "Approval was not found in this tenant.")
      const state = decision.decision === "grant" ? "granted" : "rejected"
      const changed = await tx.approval.updateMany<{ count: number }>({
        where: { id: approvalId, workflowRunId: run.id, state: "pending" },
        data: {
          state,
          decidedBy: scope.actorId,
          decidedAt: new Date(),
          decisionNote: decision.note?.trim() || null,
        },
      })
      if (changed.count !== 1) throw new CopilotRuntimeError("CONFLICT", "Approval is no longer pending.")
      await this.append(tx, run.id, `approval.${state}`, "user", scope.actorId, {
        approvalId,
        decisionNote: decision.note?.trim() || null,
      })
      if (state === "rejected") {
        await tx.workflowRun.update({ where: { id: run.id }, data: { state: "cancelled", completedAt: new Date() } })
        await this.append(tx, run.id, "workflow.state_changed", "runtime", scope.actorId, {
          from: run.state,
          to: "cancelled",
        })
      }
      return mapRun(await this.requireRun(tx, scope, run.id))
    })
  }

  async beginExecution(scope: RunScope, input: BeginExecutionInput): Promise<BeginExecutionResult> {
    return this.client.$transaction(async (tx) => {
      const run = await this.requireRun(tx, scope, input.runId)
      if (run.state === "completed") {
        const mapped = mapRun(run)
        const completed = mapped.steps.find((step) => {
          const metadata = record(step.input)
          return step.state === "completed" && metadata.actionKey === input.actionKey
        })
        if (!completed) throw new CopilotRuntimeError("CONFLICT", "The completed run used a different action.")
        return { kind: "replayed", run: mapped, output: completed.result }
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

      const allowedStates = ["queued", "planning", "awaiting_approval", "interrupted"]
      const claimed = await tx.workflowRun.updateMany<{ count: number }>({
        where: { id: run.id, profileId: scope.profileId, state: { in: allowedStates } },
        data: { state: "executing", failureCode: null, failureDetail: null },
      })
      if (claimed.count !== 1) throw new CopilotRuntimeError("CONFLICT", "The workflow was claimed by another executor.")
      await this.append(tx, run.id, "workflow.state_changed", "runtime", scope.actorId, {
        from: run.state,
        to: "executing",
      })

      const agentMax = await tx.agentRun.aggregate<{ _max: { attempt: number | null } }>({
        where: { workflowRunId: run.id, agentKey: input.agentKey },
        _max: { attempt: true },
      })
      const agent = await tx.agentRun.create<{ id: string; attempt: number }>({
        data: {
          workflowRunId: run.id,
          agentKey: input.agentKey,
          state: "queued",
          attempt: (agentMax._max.attempt ?? 0) + 1,
        },
        select: { id: true, attempt: true },
      })
      await this.append(tx, run.id, "agent.created", "runtime", scope.actorId, {
        agentRunId: agent.id,
        agentKey: input.agentKey,
        attempt: agent.attempt,
      }, agent.id)
      await tx.agentRun.update({ where: { id: agent.id }, data: { state: "running", startedAt: new Date() } })
      await this.append(tx, run.id, "agent.state_changed", "runtime", scope.actorId, {
        agentRunId: agent.id,
        from: "queued",
        to: "running",
      }, agent.id)

      const stepMax = await tx.workflowStep.aggregate<{ _max: { ordinal: number | null } }>({
        where: { workflowRunId: run.id },
        _max: { ordinal: true },
      })
      const step = await tx.workflowStep.create<{ id: string; ordinal: number }>({
        data: {
          workflowRunId: run.id,
          ordinal: (stepMax._max.ordinal ?? 0) + 1,
          label: input.stepLabel,
          state: "pending",
          inputJson: json({ actionKey: input.actionKey, input: input.input }),
        },
        select: { id: true, ordinal: true },
      })
      await this.append(tx, run.id, "step.recorded", "runtime", scope.actorId, {
        stepId: step.id,
        ordinal: step.ordinal,
        label: input.stepLabel,
      }, agent.id)
      await tx.workflowStep.update({ where: { id: step.id }, data: { state: "running", startedAt: new Date() } })
      await this.append(tx, run.id, "step.state_changed", "runtime", scope.actorId, {
        stepId: step.id,
        from: "pending",
        to: "running",
      }, agent.id)

      const toolCall = await tx.toolCall.create<{ id: string }>({
        data: {
          workflowStepId: step.id,
          ordinal: 1,
          toolName: input.toolName,
          inputJson: json(input.input),
          state: "running",
          startedAt: new Date(),
        },
        select: { id: true },
      })
      await this.append(tx, run.id, "tool_call.started", "agent", agent.id, {
        stepId: step.id,
        toolCallId: toolCall.id,
        toolName: input.toolName,
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
        run: mapRun(await this.requireRun(tx, scope, run.id)),
      }
    })
  }

  async completeExecution(scope: RunScope, lease: ExecutionLease, output: unknown): Promise<ExecutionWorkflowRun> {
    return this.client.$transaction(async (tx) => {
      await this.requireLease(tx, scope, lease)
      const now = new Date()
      const toolClaim = await tx.toolCall.updateMany<{ count: number }>({
        where: { id: lease.toolCallId, workflowStepId: lease.stepId, state: "running" },
        data: { state: "completed", outputJson: json(output), completedAt: now, errorCode: null },
      })
      if (toolClaim.count !== 1) throw new CopilotRuntimeError("CONFLICT", "Execution lease is stale or already completed.")
      await tx.workflowStep.update({ where: { id: lease.stepId }, data: { state: "completed", resultJson: json(output), completedAt: now } })
      await tx.agentRun.update({ where: { id: lease.agentRunId }, data: { state: "completed", completedAt: now, failureCode: null } })
      await tx.workflowRun.update({ where: { id: lease.runId }, data: { state: "completed", completedAt: now, failureCode: null, failureDetail: null } })
      await this.append(tx, lease.runId, "tool_call.completed", "agent", lease.agentRunId, { stepId: lease.stepId, toolCallId: lease.toolCallId }, lease.agentRunId)
      await this.append(tx, lease.runId, "step.state_changed", "runtime", scope.actorId, { stepId: lease.stepId, from: "running", to: "completed" }, lease.agentRunId)
      await this.append(tx, lease.runId, "agent.state_changed", "runtime", scope.actorId, { agentRunId: lease.agentRunId, from: "running", to: "completed" }, lease.agentRunId)
      await this.append(tx, lease.runId, "workflow.state_changed", "runtime", scope.actorId, { from: "executing", to: "completed" })
      return mapRun(await this.requireRun(tx, scope, lease.runId))
    })
  }

  async interruptExecution(
    scope: RunScope,
    lease: ExecutionLease,
    failureCode: string,
    failureDetail: string,
  ): Promise<ExecutionWorkflowRun> {
    return this.client.$transaction(async (tx) => {
      await this.requireLease(tx, scope, lease)
      const now = new Date()
      const toolClaim = await tx.toolCall.updateMany<{ count: number }>({
        where: { id: lease.toolCallId, workflowStepId: lease.stepId, state: "running" },
        data: { state: "failed", completedAt: now, errorCode: failureCode },
      })
      if (toolClaim.count !== 1) throw new CopilotRuntimeError("CONFLICT", "Execution lease is stale or already completed.")
      await tx.workflowStep.update({ where: { id: lease.stepId }, data: { state: "failed", completedAt: now } })
      await tx.agentRun.update({ where: { id: lease.agentRunId }, data: { state: "failed", completedAt: now, failureCode } })
      await tx.workflowRun.update({ where: { id: lease.runId }, data: { state: "interrupted", failureCode, failureDetail } })
      await this.append(tx, lease.runId, "tool_call.failed", "agent", lease.agentRunId, { stepId: lease.stepId, toolCallId: lease.toolCallId, failureCode }, lease.agentRunId)
      await this.append(tx, lease.runId, "step.state_changed", "runtime", scope.actorId, { stepId: lease.stepId, from: "running", to: "failed" }, lease.agentRunId)
      await this.append(tx, lease.runId, "agent.state_changed", "runtime", scope.actorId, { agentRunId: lease.agentRunId, from: "running", to: "failed", failureCode }, lease.agentRunId)
      await this.append(tx, lease.runId, "workflow.state_changed", "runtime", scope.actorId, { from: "executing", to: "interrupted", failureCode })
      return mapRun(await this.requireRun(tx, scope, lease.runId))
    })
  }

  async listAudit(scope: RunScope, runId: string): Promise<readonly ExecutionAuditEvent[]> {
    await this.requireRun(this.client, scope, runId)
    const rows = await this.client.copilotAuditEvent.findMany<DbAuditEvent>({
      where: { workflowRunId: runId },
      orderBy: { sequence: "asc" },
    })
    return rows.map(mapAudit)
  }

  private async findByIdempotency(
    tx: PrismaCopilotTransaction,
    scope: RunScope,
    idempotencyKey: string,
  ): Promise<DbRun | null> {
    return tx.workflowRun.findFirst<DbRun>({
      where: { profileId: scope.profileId, idempotencyKey },
      include: RUN_INCLUDE,
    })
  }

  private async requireRun(tx: PrismaCopilotTransaction, scope: RunScope, runId: string): Promise<DbRun> {
    const run = await tx.workflowRun.findFirst<DbRun>({
      where: { id: runId, profileId: scope.profileId },
      include: RUN_INCLUDE,
    })
    if (!run) throw new CopilotRuntimeError("NOT_FOUND", "Workflow run was not found in this tenant.")
    return run
  }

  private async requireLease(tx: PrismaCopilotTransaction, scope: RunScope, lease: ExecutionLease) {
    const run = await this.requireRun(tx, scope, lease.runId)
    if (run.state !== "executing") throw new CopilotRuntimeError("CONFLICT", "Execution lease is stale or invalid.")
    const agent = run.agentRuns.find((candidate) => candidate.id === lease.agentRunId)
    const step = run.steps.find((candidate) => candidate.id === lease.stepId)
    const tool = step?.toolCalls.find((candidate) => candidate.id === lease.toolCallId)
    if (!agent || !step || !tool || agent.state !== "running" || step.state !== "running" || tool.state !== "running") {
      throw new CopilotRuntimeError("CONFLICT", "Execution lease is stale or invalid.")
    }
  }

  private async append(
    tx: PrismaCopilotTransaction,
    workflowRunId: string,
    eventType: string,
    actorType: "user" | "runtime" | "agent",
    actorId: string | null,
    payload: UnknownRecord,
    agentRunId: string | null = null,
  ) {
    const aggregate = await tx.copilotAuditEvent.aggregate<{ _max: { sequence: number | null } }>({
      where: { workflowRunId },
      _max: { sequence: true },
    })
    await tx.copilotAuditEvent.create({
      data: {
        workflowRunId,
        agentRunId,
        sequence: (aggregate._max.sequence ?? 0) + 1,
        eventType,
        actorType,
        actorId,
        payloadJson: json(payload),
      },
    })
  }
}
