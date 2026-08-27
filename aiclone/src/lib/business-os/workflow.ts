import type { AuditEvent, WorkflowAction, WorkflowDefinition } from "./types"

export type WorkflowRunStatus = "ready" | "waiting_for_approval"

export type WorkflowActionPlan = {
  action: WorkflowAction
  status: WorkflowRunStatus
}

export type WorkflowRunPlan = {
  workflowId: string
  workflowName: string
  actions: WorkflowActionPlan[]
  auditEvents: AuditEvent[]
}

export function planWorkflowRun(workflow: WorkflowDefinition, actor: string, now = new Date()): WorkflowRunPlan {
  const timestamp = now.toISOString()
  const actions = workflow.actions.map((action) => ({
    action,
    status: action.approval?.required ? "waiting_for_approval" as const : "ready" as const,
  }))

  const auditEvents = workflow.actions
    .filter((action) => action.kind === "recordAudit" || action.auditSubject)
    .map((action): AuditEvent => ({
      id: `${workflow.id}:${action.id}:${timestamp}`,
      at: timestamp,
      actor,
      action: action.kind,
      subject: action.auditSubject ?? action.label,
      metadata: { workflowId: workflow.id, actionId: action.id },
    }))

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    actions,
    auditEvents,
  }
}

export function listApprovalGates(workflows: WorkflowDefinition[]) {
  return workflows.flatMap((workflow) =>
    workflow.actions
      .filter((action) => action.approval?.required)
      .map((action) => ({ workflowId: workflow.id, actionId: action.id, approval: action.approval }))
  )
}
