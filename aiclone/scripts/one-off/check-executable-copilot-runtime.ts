import {
  CopilotExecutionService,
  CopilotRuntimeError,
  InMemoryExecutionRepository,
  type CopilotAction,
} from "@/lib/copilot/execution"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function expectRuntimeError(
  action: () => Promise<unknown>,
  code: CopilotRuntimeError["code"],
  message: string,
) {
  let caught: unknown
  try {
    await action()
  } catch (error) {
    caught = error
  }
  assert(caught instanceof CopilotRuntimeError && caught.code === code, message)
}

async function main() {
  let tick = 0
  const repository = new InMemoryExecutionRepository(
    () => new Date(Date.UTC(2026, 7, 28, 0, 0, tick++)),
  )
  const service = new CopilotExecutionService(repository)
  const tenantA = { profileId: "profile-a", actorId: "owner-a" }
  const tenantB = { profileId: "profile-b", actorId: "owner-b" }

  const gated = await service.startWorkflow(tenantA, {
    workflowKey: "customer-update",
    workflowName: "Send customer update",
    idempotencyKey: "customer-update-001",
    approvalReason: "external_communication",
  })
  const auditBeforeRetry = await service.listAudit(tenantA, gated.run.id)
  const retriedStart = await service.startWorkflow(tenantA, {
    workflowKey: "changed-key-must-not-win",
    workflowName: "Changed name must not create a run",
    idempotencyKey: "customer-update-001",
  })
  assert(!retriedStart.created, "An idempotent start retry was reported as new.")
  assert(retriedStart.run.id === gated.run.id, "An idempotent start retry created another run.")
  assert((await service.listAudit(tenantA, gated.run.id)).length === auditBeforeRetry.length, "An idempotent start retry appended audit entries.")

  let protectedActionCalls = 0
  const protectedAction: CopilotAction = async () => {
    protectedActionCalls += 1
    return { sent: true }
  }
  const gatedExecution = {
    runId: gated.run.id,
    actionKey: "send-customer-update",
    agentKey: "communications-agent",
    stepLabel: "Send the approved update",
    toolName: "sendMessage",
    input: { audience: "customer-42" },
  }
  const auditBeforeBlockedExecution = await service.listAudit(tenantA, gated.run.id)
  await expectRuntimeError(
    () => service.execute(tenantA, gatedExecution, protectedAction),
    "APPROVAL_REQUIRED",
    "A pending approval did not block execution.",
  )
  assert(protectedActionCalls === 0, "The protected action ran before approval.")
  assert((await service.listAudit(tenantA, gated.run.id)).length === auditBeforeBlockedExecution.length, "A blocked action created execution records before approval.")

  const approval = gated.run.approvals[0]
  assert(approval, "The requested approval was not persisted.")
  await service.decideApproval(tenantA, gated.run.id, approval.id, { decision: "grant", note: "Owner approved." })
  const executed = await service.execute(tenantA, gatedExecution, protectedAction)
  assert(!executed.replayed, "The first approved execution was incorrectly reported as a replay.")
  assert(Number(protectedActionCalls) === 1, "The approved action did not execute exactly once.")
  assert(executed.run.state === "completed", "The approved workflow did not complete.")
  const completedAudit = await service.listAudit(tenantA, gated.run.id)
  assert(completedAudit.some((event) => event.eventType === "approval.granted"), "Approval grant did not append an audit event.")
  assert(completedAudit.some((event) => event.eventType === "tool_call.completed"), "Action completion did not append an audit event.")
  // The contiguity claim below is an `every`, and `[].every(...)` is true, so without a length
  // pinned first it would pass on an audit trail the repository never wrote - the exact failure
  // that assertion exists to catch. 15 is the number of events one gated run appends: workflow
  // created, the approval gate's state changes, approval requested and granted, the agent, step
  // and tool-call records, and the completing state changes. A trail that shrinks or grows now
  // fails here instead of being silently accepted as "contiguous".
  assert(completedAudit.length === 15, `A gated run appended ${completedAudit.length} audit events, expected 15.`)
  assert(completedAudit.length > 0 && completedAudit.every((event, index) => event.sequence === index + 1), "Audit sequence is not contiguous and monotonic per run.")

  const replayedExecution = await service.execute(tenantA, gatedExecution, protectedAction)
  assert(replayedExecution.replayed, "A completed action retry was not replayed.")
  assert(Number(protectedActionCalls) === 1, "A completed action retry invoked the action again.")

  const immutableEvent = completedAudit[0]
  let auditMutationRefused = false
  try {
    ;(immutableEvent.payload as Record<string, unknown>).tampered = true
  } catch {
    auditMutationRefused = true
  }
  assert(auditMutationRefused, "An append-only audit payload could be mutated through the repository result.")
  assert(!("tampered" in (await service.listAudit(tenantA, gated.run.id))[0].payload), "Audit mutation leaked into stored state.")

  const recoverable = await service.startWorkflow(tenantA, {
    workflowKey: "recoverable-job",
    workflowName: "Recover a failed agent attempt",
    idempotencyKey: "recoverable-job-001",
  })
  const recoveryExecution = {
    runId: recoverable.run.id,
    actionKey: "recoverable-action",
    agentKey: "recovery-agent",
    stepLabel: "Run recoverable action",
    toolName: "recoverableTool",
    input: { item: "safe-test-value" },
  }
  let actionAttempts = 0
  let sideEffects = 0
  const flakyAction: CopilotAction = async (_input, context) => {
    actionAttempts += 1
    assert(context.idempotencyKey === `${recoverable.run.id}:recoverable-action`, "Action retry idempotency key changed across attempts.")
    if (actionAttempts === 1) throw new Error("synthetic pre-side-effect failure")
    sideEffects += 1
    return { recovered: true }
  }
  await expectRuntimeError(
    () => service.execute(tenantA, recoveryExecution, flakyAction),
    "ACTION_FAILED",
    "A failed action did not surface ACTION_FAILED.",
  )
  const interrupted = await service.getWorkflow(tenantA, recoverable.run.id)
  assert(interrupted.state === "interrupted", "A failed agent attempt did not leave a recoverable interrupted run.")
  assert(interrupted.agents[0]?.state === "failed" && interrupted.steps[0]?.state === "failed", "Failed attempt state was not persisted.")
  const recovered = await service.execute(tenantA, recoveryExecution, flakyAction)
  assert(recovered.run.state === "completed", "An interrupted workflow did not recover on retry.")
  assert(Number(actionAttempts) === 2 && Number(sideEffects) === 1, "Failed-run recovery did not preserve retry idempotency evidence.")
  assert(recovered.run.agents.length === 2, "Recovery did not create a distinct AgentRun attempt.")
  assert(recovered.run.agents[0]?.attempt === 1 && recovered.run.agents[1]?.attempt === 2, "AgentRun attempts are not monotonic.")
  assert(recovered.run.steps[0]?.state === "failed" && recovered.run.steps[1]?.state === "completed", "Recovery overwrote failed attempt evidence.")

  let crossTenantActionCalls = 0
  await expectRuntimeError(
    () => service.getWorkflow(tenantB, gated.run.id),
    "NOT_FOUND",
    "A cross-tenant run read was not refused.",
  )
  await expectRuntimeError(
    () => service.execute(tenantB, gatedExecution, async () => {
      crossTenantActionCalls += 1
      return null
    }),
    "NOT_FOUND",
    "A cross-tenant run execution was not refused.",
  )
  assert(Number(crossTenantActionCalls) === 0, "A cross-tenant action was invoked.")
  assert((await service.listWorkflows(tenantB)).length === 0, "Tenant list leaked foreign runs.")

  assert(process.env.INVERT_ASSERTION !== "1", "intentional falsifiability probe")
  console.log("executable copilot runtime checks passed")
  console.log("evidence: approval-before-action, append-only audit, retry idempotency, failed-run recovery, tenant isolation, falsifiability hook")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "executable runtime harness failed")
  process.exitCode = 1
})
