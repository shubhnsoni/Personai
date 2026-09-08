import { businessEngineDescriptors } from "./engines"
import type { BusinessBlueprint, EngineDescriptor, ValidationIssue, ValidationResult } from "./types"

function issue(path: string, message: string): ValidationIssue {
  return { path, message }
}

export function validateBusinessBlueprint(
  blueprint: BusinessBlueprint,
  registry: Readonly<Record<string, EngineDescriptor>> = businessEngineDescriptors,
): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!blueprint.id.trim()) issues.push(issue("id", "Blueprint id is required."))
  if (!blueprint.version.trim()) issues.push(issue("version", "Blueprint version is required."))
  if (!blueprint.name.trim()) issues.push(issue("name", "Blueprint name is required."))
  if (!blueprint.vertical.trim()) issues.push(issue("vertical", "Blueprint vertical is required."))
  if (!blueprint.summary.trim()) issues.push(issue("summary", "Blueprint summary is required."))
  if (!blueprint.engines.length) issues.push(issue("engines", "At least one operating engine is required."))

  const workflowIds = new Set<string>()
  blueprint.workflows.forEach((workflow, workflowIndex) => {
    const workflowPath = `workflows.${workflowIndex}`
    if (!workflow.id.trim()) issues.push(issue(`${workflowPath}.id`, "Workflow id is required."))
    if (workflowIds.has(workflow.id)) issues.push(issue(`${workflowPath}.id`, "Workflow id must be unique."))
    workflowIds.add(workflow.id)
    if (!workflow.name.trim()) issues.push(issue(`${workflowPath}.name`, "Workflow name is required."))
    if (!workflow.actions.length) issues.push(issue(`${workflowPath}.actions`, "Workflow needs at least one action."))
    if (workflow.trigger.kind === "event" && !workflow.trigger.event?.trim()) {
      issues.push(issue(`${workflowPath}.trigger.event`, "An event trigger must name its event."))
    }
    if (workflow.trigger.kind === "schedule" && !workflow.trigger.schedule?.trim()) {
      issues.push(issue(`${workflowPath}.trigger.schedule`, "A schedule trigger must carry a schedule."))
    }
    workflow.actions.forEach((action, actionIndex) => {
      const actionPath = `${workflowPath}.actions.${actionIndex}`
      if (!action.id.trim()) issues.push(issue(`${actionPath}.id`, "Action id is required."))
      // The contract requires a human-readable reason, because the approver is shown it.
      if (action.approval?.required && !action.approval.reason.trim()) {
        issues.push(issue(`${actionPath}.approval.reason`, "A required approval must state a reason."))
      }
    })
  })

  blueprint.engines.forEach((composition, engineIndex) => {
    const engine = registry[composition.engineId]
    const enginePath = `engines.${engineIndex}`
    if (!engine) {
      issues.push(issue(`${enginePath}.engineId`, "Unknown engine id."))
      return
    }

    const capabilitiesById = new Map(engine.capabilities.map((capability) => [capability.id, capability]))
    composition.capabilities.forEach((capabilityId, capabilityIndex) => {
      const capabilityPath = `${enginePath}.capabilities.${capabilityIndex}`
      const capability = capabilitiesById.get(capabilityId)
      if (!capability) {
        issues.push(issue(capabilityPath, `Capability is not declared on ${engine.id}.`))
        return
      }
      if (blueprint.status === "active" && composition.required && capability.maturity !== "available") {
        issues.push(
          issue(
            capabilityPath,
            `Active blueprint requires ${engine.id}:${capability.id}, but its maturity is ${capability.maturity}; required capabilities must be available.`,
          ),
        )
      }
    })

    const selectedCapabilities = new Set(composition.capabilities)
    composition.plannedCapabilities?.forEach((capabilityId, capabilityIndex) => {
      const capabilityPath = `${enginePath}.plannedCapabilities.${capabilityIndex}`
      if (!capabilitiesById.has(capabilityId)) {
        issues.push(issue(capabilityPath, `Planned capability is not declared on ${engine.id}.`))
      }
      if (selectedCapabilities.has(capabilityId)) {
        issues.push(issue(capabilityPath, "A capability cannot be both selected and in the planned backlog."))
      }
    })
  })

  return { ok: issues.length === 0, issues }
}

export function assertValidBusinessBlueprint(
  blueprint: BusinessBlueprint,
  registry: Readonly<Record<string, EngineDescriptor>> = businessEngineDescriptors,
) {
  const result = validateBusinessBlueprint(blueprint, registry)
  if (!result.ok) {
    throw new Error(result.issues.map((item) => `${item.path}: ${item.message}`).join("\n"))
  }
  return blueprint
}
