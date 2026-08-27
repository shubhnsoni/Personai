import { businessEngineDescriptors } from "./engines"
import type { BusinessBlueprint, ValidationIssue, ValidationResult } from "./types"

function issue(path: string, message: string): ValidationIssue {
  return { path, message }
}

export function validateBusinessBlueprint(blueprint: BusinessBlueprint): ValidationResult {
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
  })

  blueprint.engines.forEach((composition, engineIndex) => {
    const engine = businessEngineDescriptors[composition.engineId]
    const enginePath = `engines.${engineIndex}`
    if (!engine) {
      issues.push(issue(`${enginePath}.engineId`, "Unknown engine id."))
      return
    }

    const availableCapabilities = new Set(engine.capabilities.map((capability) => capability.id))
    composition.capabilities.forEach((capability, capabilityIndex) => {
      if (!availableCapabilities.has(capability)) {
        issues.push(issue(`${enginePath}.capabilities.${capabilityIndex}`, `Capability is not available on ${engine.id}.`))
      }
    })
  })

  return { ok: issues.length === 0, issues }
}

export function assertValidBusinessBlueprint(blueprint: BusinessBlueprint) {
  const result = validateBusinessBlueprint(blueprint)
  if (!result.ok) {
    throw new Error(result.issues.map((item) => `${item.path}: ${item.message}`).join("\n"))
  }
  return blueprint
}
