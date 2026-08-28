import {
  businessEngineDescriptors,
  getBusinessBlueprint,
  listBusinessBlueprints,
  validateBusinessBlueprint,
} from "../../src/lib/business-os"
import type { BusinessBlueprint, CapabilityMaturity } from "../../src/lib/business-os/types"

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * Inversion control. This harness previously had none, so it exited 0 whether or
 * not its assertions were meaningful. Wave A added the hook so the harness can be
 * shown to fail loudly, which is the standard every other boundary here is held to.
 *
 * It flips exactly ONE assertion: the maturity-enforcement negative test, which is
 * the property that actually guards against overclaiming a capability.
 */
const INVERT = process.env.INVERT_ASSERTION === "1"

function check(name: string, condition: unknown, detail?: string) {
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name)
}

function checkInvertible(name: string, condition: unknown, detail?: string) {
  check(name, INVERT ? !condition : condition, detail)
}

const requiredGranularCapabilities: Record<string, string[]> = {
  appointments: ["deposits", "waitlist"],
  casesProjects: ["documents"],
  commerce: ["variants", "fulfilment", "returns"],
}

for (const [engineId, capabilityIds] of Object.entries(requiredGranularCapabilities)) {
  const declared = new Set(
    businessEngineDescriptors[engineId as keyof typeof businessEngineDescriptors].capabilities.map(
      (capability) => capability.id,
    ),
  )
  for (const capabilityId of capabilityIds) {
    check(`declares granular capability ${engineId}:${capabilityId}`, declared.has(capabilityId))
  }
}

const allowedMaturity = new Set<CapabilityMaturity>(["planned", "partial", "available"])
for (const engine of Object.values(businessEngineDescriptors)) {
  const ids = new Set<string>()
  for (const capability of engine.capabilities) {
    check(`${engine.id}:${capability.id} has a unique id`, !ids.has(capability.id))
    ids.add(capability.id)
    check(`${engine.id}:${capability.id} has valid maturity`, allowedMaturity.has(capability.maturity))
    check(`${engine.id}:${capability.id} has evidence`, capability.evidence.trim().length > 0)
    check(
      `${engine.id}:${capability.id} planned capability uses none evidence`,
      capability.maturity !== "planned" || capability.evidence === "none",
    )
    check(
      `${engine.id}:${capability.id} implemented capability cites evidence`,
      capability.maturity === "planned" || capability.evidence !== "none",
    )
  }
}

const restaurantV1 = getBusinessBlueprint("restaurant-venue-v1")
const restaurantV2 = getBusinessBlueprint("restaurant-venue-v2")
check("restaurant v1 remains addressable", restaurantV1?.id === "restaurant-venue-v1")
check("restaurant v1 is historical", restaurantV1?.status === "deprecated")
check("restaurant v2 exists", restaurantV2?.version === "2.0.0")
check("restaurant v2 is active", restaurantV2?.status === "active")
check("restaurant v2 links to v1", restaurantV2?.supersedes === "restaurant-venue-v1")

function composition(engineId: "venueOrders" | "commerce") {
  return restaurantV2?.engines.find((engine) => engine.engineId === engineId)
}

check(
  "restaurant v2 venue required capabilities are exact",
  JSON.stringify(composition("venueOrders")?.capabilities) ===
    JSON.stringify(["qrOrdering", "guestTracking", "reservations"]),
)
check(
  "restaurant v2 commerce required capabilities are exact",
  JSON.stringify(composition("commerce")?.capabilities) === JSON.stringify(["catalog", "orders"]),
)
check(
  "restaurant reservations are no longer a planned backlog item",
  composition("venueOrders")?.plannedCapabilities === undefined,
)
check(
  "restaurant reservations capability is declared available with real evidence",
  (() => {
    const capability = businessEngineDescriptors.venueOrders.capabilities.find((c) => c.id === "reservations")
    return capability?.maturity === "available" && capability.evidence !== "none"
  })(),
)
check(
  "restaurant real inventory is STILL in planned backlog",
  JSON.stringify(composition("commerce")?.plannedCapabilities) === JSON.stringify(["inventory"]),
)
check(
  "commerce inventory capability is still declared planned",
  businessEngineDescriptors.commerce.capabilities.find((c) => c.id === "inventory")?.maturity === "planned",
)
check("all registry blueprints validate", listBusinessBlueprints().every((blueprint) => validateBusinessBlueprint(blueprint).ok))

// Negative test: an active blueprint may not REQUIRE a capability whose maturity is
// still planned. This deliberately targets commerce.inventory, which remains planned.
// It previously targeted venueOrders.reservations; Wave A made reservations genuinely
// available, which would have turned this assertion vacuous, so it was repointed at a
// capability that is still actually planned rather than left to pass for free.
const activeWithPlannedRequiredCapability: BusinessBlueprint = {
  id: "invalid-active-planned-capability",
  version: "1.0.0",
  status: "active",
  name: "Invalid active blueprint",
  vertical: "contract-test",
  summary: "Negative test: active blueprints cannot require planned capabilities.",
  engines: [{ engineId: "commerce", capabilities: ["inventory"], required: true }],
  workflows: [],
  ownerCopilotPrompts: [],
}
const negativeResult = validateBusinessBlueprint(activeWithPlannedRequiredCapability)
checkInvertible("active blueprint requiring planned capability is rejected", !negativeResult.ok)
check(
  "negative rejection identifies maturity enforcement",
  negativeResult.issues.some(
    (validationIssue) =>
      validationIssue.path === "engines.0.capabilities.0" &&
      validationIssue.message.includes("maturity is planned") &&
      validationIssue.message.includes("must be available"),
  ),
)

const draftWithPlannedRequiredCapability: BusinessBlueprint = {
  ...activeWithPlannedRequiredCapability,
  id: "valid-draft-planned-capability",
  status: "draft",
}
check(
  "draft blueprint may reference planned capability",
  validateBusinessBlueprint(draftWithPlannedRequiredCapability).ok,
)

report.granularCapabilities = requiredGranularCapabilities
report.restaurantBlueprint = {
  historicalId: restaurantV1?.id,
  activeId: restaurantV2?.id,
  version: restaurantV2?.version,
  required: {
    venueOrders: composition("venueOrders")?.capabilities,
    commerce: composition("commerce")?.capabilities,
  },
  planned: {
    venueOrders: composition("venueOrders")?.plannedCapabilities,
    commerce: composition("commerce")?.plannedCapabilities,
  },
}
report.negativeTest = {
  rejected: !negativeResult.ok,
  issues: negativeResult.issues,
}
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
