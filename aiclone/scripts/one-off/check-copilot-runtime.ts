import {
  ApprovalRequiredError,
  IllegalStateTransitionError,
  InMemoryCopilotRuntime,
  LedgerImmutableError,
} from "@/lib/copilot/runtime"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function expectThrow(action: () => unknown, ErrorType: new (...args: never[]) => Error, message: string) {
  let caught: unknown
  try {
    action()
  } catch (error) {
    caught = error
  }
  assert(caught instanceof ErrorType, message)
}

const runtime = new InMemoryCopilotRuntime(() => new Date("2026-08-27T12:00:00.000Z"))

const idempotentFirst = runtime.createWorkflowRun({
  idempotencyKey: "same-command",
  workflowName: "Update owner briefing",
})
const idempotentReplay = runtime.createWorkflowRun({
  idempotencyKey: "same-command",
  workflowName: "This must not create another run",
})
assert(idempotentFirst === idempotentReplay, "Idempotency replay did not return the original outcome.")
assert(runtime.listWorkflowRuns().length === 1, "Idempotency replay created a duplicate workflow run.")
expectThrow(
  () => runtime.transitionWorkflow(idempotentFirst.run.id, "executing"),
  IllegalStateTransitionError,
  "An illegal workflow state transition was accepted.",
)

const approved = runtime.createWorkflowRun({
  idempotencyKey: "approval-command",
  workflowName: "Send a customer update",
  approvalReason: "external_communication",
})
runtime.transitionWorkflow(approved.run.id, "planning")
expectThrow(
  () => runtime.transitionWorkflow(approved.run.id, "executing"),
  ApprovalRequiredError,
  "An approval-gated workflow advanced without an approval.",
)
runtime.transitionWorkflow(approved.run.id, "awaiting_approval")
const approval = runtime.getWorkflowRun(approved.run.id).approvals[0]
assert(approval, "The approval gate was not persisted as a distinct record.")
runtime.grantApproval(approved.run.id, approval.id, "owner-1")
runtime.transitionWorkflow(approved.run.id, "executing")

const agent = runtime.createAgentRun(approved.run.id, "communications-agent")
expectThrow(
  () => runtime.transitionAgent(agent.id, "completed"),
  IllegalStateTransitionError,
  "An illegal agent state transition was accepted.",
)
runtime.transitionAgent(agent.id, "running")
runtime.transitionAgent(agent.id, "completed")

const firstStep = runtime.recordStep(approved.run.id, "Draft the update")
runtime.transitionStep(approved.run.id, firstStep.id, "running")
const firstToolCall = runtime.recordToolCall(approved.run.id, firstStep.id, "draftMessage", { audience: "customers" })
const secondToolCall = runtime.recordToolCall(approved.run.id, firstStep.id, "reviewTone", { style: "clear" })
assert(firstToolCall.order === 1 && secondToolCall.order === 2, "Tool-call ordering is not stable.")

const entry = runtime.listAuditEvents()[0]
let assignmentThrew = false
try {
  ;(entry.payload as Record<string, unknown>).workflowName = "tampered"
} catch {
  assignmentThrew = true
}
assert(assignmentThrew, "Ledger event payload mutation was not refused.")
expectThrow(
  () => runtime.mutateAuditEntry(),
  LedgerImmutableError,
  "Ledger mutation API was not refused.",
)
expectThrow(
  () => runtime.deleteAuditEntry(),
  LedgerImmutableError,
  "Ledger deletion API was not refused.",
)
assert(runtime.getWorkflowRun(idempotentFirst.run.id).workflowName === "Update owner briefing", "Ledger mutation altered state.")

const recovered = InMemoryCopilotRuntime.fromLedger(runtime.listAuditEvents(), () => new Date("2026-08-27T12:01:00.000Z"))
const interrupted = recovered.getWorkflowRun(approved.run.id)
assert(interrupted.state === "interrupted", "A workflow interrupted during a running step did not recover as interrupted.")
assert(interrupted.steps[0]?.state === "running", "Recovery did not reconstruct the interrupted step from the ledger.")
recovered.resumeRecoveredWorkflow(approved.run.id)
assert(recovered.getWorkflowRun(approved.run.id).state === "executing", "Recovered workflow could not resume legally.")

console.log("copilot runtime contract checks passed")
