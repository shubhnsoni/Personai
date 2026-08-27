export type BusinessEngineId =
  | "commerce"
  | "appointments"
  | "contentCohorts"
  | "venueOrders"
  | "fieldJobs"
  | "casesProjects"

export type BusinessBlueprintStatus = "draft" | "proposed" | "active" | "deprecated"

export type CapabilityMaturity = "planned" | "partial" | "available"

export type WorkflowTriggerKind = "manual" | "event" | "schedule"

export type WorkflowActionKind =
  | "createTask"
  | "sendNotification"
  | "requestApproval"
  | "recordAudit"
  | "handoffToOwner"

export type ApprovalPolicy = {
  required: boolean
  approverRole: "owner" | "manager" | "staff"
  reason: string
}

export type AuditEvent = {
  id: string
  at: string
  actor: string
  action: string
  subject: string
  metadata?: Record<string, unknown>
}

export type WorkflowTrigger = {
  kind: WorkflowTriggerKind
  event?: string
  schedule?: string
}

export type WorkflowAction = {
  id: string
  kind: WorkflowActionKind
  label: string
  approval?: ApprovalPolicy
  auditSubject?: string
}

export type WorkflowDefinition = {
  id: string
  name: string
  trigger: WorkflowTrigger
  actions: WorkflowAction[]
}

export type EngineCapability = {
  id: string
  label: string
  description: string
  maturity: CapabilityMaturity
  /** A repository code path, verification harness, or "none" when no implementation exists. */
  evidence: string
}

export type EngineDescriptor = {
  id: BusinessEngineId
  label: string
  description: string
  capabilities: EngineCapability[]
}

export type BlueprintEngineComposition = {
  engineId: BusinessEngineId
  /** Capabilities selected for the executable blueprint composition. */
  capabilities: string[]
  required: boolean
  /** Known future capabilities excluded from the executable composition. */
  plannedCapabilities?: string[]
}

export type BusinessBlueprint = {
  id: string
  version: string
  status: BusinessBlueprintStatus
  name: string
  vertical: string
  summary: string
  engines: BlueprintEngineComposition[]
  workflows: WorkflowDefinition[]
  ownerCopilotPrompts: string[]
  /** Prior immutable blueprint id retained for historical lookup. */
  supersedes?: string
}

export type ValidationIssue = {
  path: string
  message: string
}

export type ValidationResult = {
  ok: boolean
  issues: ValidationIssue[]
}
