import {
  businessEngineDescriptors,
  getBusinessBlueprint,
  listBusinessBlueprints,
  validateBusinessBlueprint,
} from "../../src/lib/business-os"
import type { BusinessBlueprint, CapabilityMaturity } from "../../src/lib/business-os/types"
import { existsSync } from "node:fs"
import { join } from "node:path"

const APP_ROOT = join(__dirname, "../..")

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * Inversion control. This harness previously had none, so it exited 0 whether or
 * not its assertions were meaningful. Wave A added the hook so the harness can be
 * shown to fail loudly, which is the standard every other boundary here is held to.
 *
 * It flips the assertions that actually guard against overclaiming:
 *   - an active blueprint may not REQUIRE a capability whose maturity is planned
 *   - nor one whose maturity is only partial
 *   - and every capability an active blueprint requires must cite an evidence path
 *     that exists on disk, so "available" cannot mean "available in a comment"
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

// ---------------------------------------------------------------------------
// Wave E — a blueprint may not be active while a capability it REQUIRES has no
// runtime. Three separate properties, because each fails in a different way:
//
//   1. maturity gate           — "available" is required, planned and partial are not
//   2. evidence-on-disk gate   — "available" must point at a file that actually exists
//   3. vertical uniqueness     — two active blueprints cannot claim the same vertical
//
// Property 2 is the one that rots silently. Before this wave, appointments:availability
// cited src/app/api/bookings/route.ts, a path that no longer existed; nothing noticed,
// because a maturity flag is just a string. Checking the path turns the flag into a
// claim that can be falsified.
// ---------------------------------------------------------------------------

const evidenceRot: string[] = []
for (const engine of Object.values(businessEngineDescriptors)) {
  for (const capability of engine.capabilities) {
    if (capability.maturity === "planned") continue
    if (!existsSync(join(APP_ROOT, capability.evidence))) {
      evidenceRot.push(`${engine.id}:${capability.id} -> ${capability.evidence}`)
    }
  }
}
checkInvertible(
  "every implemented capability cites an evidence path that exists on disk",
  evidenceRot.length === 0,
  evidenceRot.join(", "),
)

const activeBlueprints = listBusinessBlueprints().filter((blueprint) => blueprint.status === "active")
check("at least one blueprint is active", activeBlueprints.length > 0)

const unmetActiveClaims: string[] = []
const missingActiveRuntime: string[] = []
for (const blueprint of activeBlueprints) {
  for (const composition of blueprint.engines) {
    if (!composition.required) continue
    const engine = businessEngineDescriptors[composition.engineId]
    for (const capabilityId of composition.capabilities) {
      const capability = engine.capabilities.find((c) => c.id === capabilityId)
      if (!capability || capability.maturity !== "available") {
        unmetActiveClaims.push(`${blueprint.id} requires ${engine.id}:${capabilityId} (${capability?.maturity ?? "undeclared"})`)
        continue
      }
      if (!existsSync(join(APP_ROOT, capability.evidence))) {
        missingActiveRuntime.push(`${blueprint.id} -> ${engine.id}:${capabilityId} -> ${capability.evidence}`)
      }
    }
  }
}
checkInvertible(
  "no active blueprint requires a capability that is not available",
  unmetActiveClaims.length === 0,
  unmetActiveClaims.join("; "),
)
checkInvertible(
  "every capability an active blueprint requires has a runtime file on disk",
  missingActiveRuntime.length === 0,
  missingActiveRuntime.join("; "),
)

const activeVerticals = activeBlueprints.map((blueprint) => blueprint.vertical)
const duplicateActiveVerticals = activeVerticals.filter((v, i, all) => all.indexOf(v) !== i)
check(
  "no two active blueprints claim the same vertical",
  duplicateActiveVerticals.length === 0,
  [...new Set(duplicateActiveVerticals)].join(", "),
)

// A superseded contract must remain addressable but must not still be live, or two
// versions of the same vertical would both be selectable.
for (const blueprint of listBusinessBlueprints()) {
  if (!blueprint.supersedes) continue
  const previous = getBusinessBlueprint(blueprint.supersedes)
  check(`${blueprint.id} supersedes an existing blueprint`, previous !== null, blueprint.supersedes)
  check(`${blueprint.supersedes} is deprecated now that ${blueprint.id} supersedes it`, previous?.status === "deprecated", previous?.status)
}

// Second negative test: PARTIAL is not good enough either. This targets
// appointments:reminders, whose record exists but whose messaging provider is inert, so
// an active blueprint requiring it would promise a delivery that never happens.
const activeWithPartialRequiredCapability: BusinessBlueprint = {
  id: "invalid-active-partial-capability",
  version: "1.0.0",
  status: "active",
  name: "Invalid active blueprint",
  vertical: "contract-test-partial",
  summary: "Negative test: active blueprints cannot require partial capabilities.",
  engines: [{ engineId: "appointments", capabilities: ["reminders"], required: true }],
  workflows: [],
  ownerCopilotPrompts: [],
}
const partialResult = validateBusinessBlueprint(activeWithPartialRequiredCapability)
checkInvertible("active blueprint requiring partial capability is rejected", !partialResult.ok)
check(
  "partial rejection identifies maturity enforcement",
  partialResult.issues.some(
    (validationIssue) =>
      validationIssue.message.includes("maturity is partial") &&
      validationIssue.message.includes("must be available"),
  ),
)
check(
  "appointments reminders is still only partial, so the partial negative test is not vacuous",
  businessEngineDescriptors.appointments.capabilities.find((c) => c.id === "reminders")?.maturity === "partial",
)
check(
  "commerce inventory is still planned, so the planned negative test is not vacuous",
  businessEngineDescriptors.commerce.capabilities.find((c) => c.id === "inventory")?.maturity === "planned",
)

// Wave E activations, asserted individually so a silent status regression is caught.
for (const [blueprintId, expectedStatus] of [
  ["restaurant-venue-v2", "active"],
  ["coaching-studio-v1", "deprecated"],
  ["coaching-studio-v2", "active"],
  ["consulting-agency-v1", "active"],
  ["ca-practice-v1", "active"],
  ["retail-storefront-v1", "draft"],
] as Array<[string, string]>) {
  const blueprint = getBusinessBlueprint(blueprintId)
  check(`${blueprintId} exists`, blueprint !== null)
  check(`${blueprintId} status is ${expectedStatus}`, blueprint?.status === expectedStatus, blueprint?.status)
}

// Retail must stay draft precisely because inventory is planned. If someone activates it
// without building inventory, validation rejects it - proven here rather than trusted.
const retail = getBusinessBlueprint("retail-storefront-v1")
check("retail storefront requires inventory", retail?.engines[0]?.capabilities.includes("inventory") === true)
check(
  "activating retail while inventory is planned would be rejected",
  retail !== null && !validateBusinessBlueprint({ ...retail, status: "active" }).ok,
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
report.waveE = {
  activeBlueprints: activeBlueprints.map((blueprint) => ({
    id: blueprint.id,
    vertical: blueprint.vertical,
    required: blueprint.engines
      .filter((composition) => composition.required)
      .map((composition) => `${composition.engineId}:${composition.capabilities.join("+")}`),
    planned: blueprint.engines
      .flatMap((composition) => (composition.plannedCapabilities ?? []).map((c) => `${composition.engineId}:${c}`)),
  })),
  evidenceRot,
  unmetActiveClaims,
  missingActiveRuntime,
  partialNegativeTestRejected: !partialResult.ok,
}
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
