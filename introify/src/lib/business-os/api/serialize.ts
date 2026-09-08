import { businessEngineDescriptors } from "@/lib/business-os/engines"
import type { BusinessBlueprint } from "@/lib/business-os/types"

/**
 * List projection. The full blueprint carries engine compositions, workflows, and
 * copilot prompts; a list does not need them, so the summary stays small and stable.
 */
export type BusinessBlueprintSummary = {
  id: string
  version: string
  status: BusinessBlueprint["status"]
  name: string
  vertical: string
  summary: string
  engineIds: BusinessBlueprint["engines"][number]["engineId"][]
  engineLabels: string[]
  requiredEngineCount: number
  workflowCount: number
  approvalGateCount: number
}

export function toBlueprintSummary(blueprint: BusinessBlueprint): BusinessBlueprintSummary {
  return {
    id: blueprint.id,
    version: blueprint.version,
    status: blueprint.status,
    name: blueprint.name,
    vertical: blueprint.vertical,
    summary: blueprint.summary,
    engineIds: blueprint.engines.map((engine) => engine.engineId),
    engineLabels: blueprint.engines.map((engine) => businessEngineDescriptors[engine.engineId].label),
    requiredEngineCount: blueprint.engines.filter((engine) => engine.required).length,
    workflowCount: blueprint.workflows.length,
    approvalGateCount: blueprint.workflows.reduce(
      (sum, workflow) => sum + workflow.actions.filter((action) => action.approval?.required).length,
      0,
    ),
  }
}
