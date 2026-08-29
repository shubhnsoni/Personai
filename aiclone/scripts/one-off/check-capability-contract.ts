import {
  businessEngineDescriptors,
  getBusinessBlueprint,
  listBusinessBlueprints,
  validateBusinessBlueprint,
} from "../../src/lib/business-os"
import type { BusinessBlueprint, CapabilityMaturity, EngineDescriptor } from "../../src/lib/business-os/types"
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
const restaurantV3 = getBusinessBlueprint("restaurant-venue-v3")
check("restaurant v1 remains addressable", restaurantV1?.id === "restaurant-venue-v1")
check("restaurant v1 is historical", restaurantV1?.status === "deprecated")
check("restaurant v2 remains addressable", restaurantV2?.version === "2.0.0")
check("restaurant v2 is historical now that v3 exists", restaurantV2?.status === "deprecated")
check("restaurant v3 exists", restaurantV3?.version === "3.0.0")
check("restaurant v3 is active", restaurantV3?.status === "active")
check("restaurant v3 links to v2", restaurantV3?.supersedes === "restaurant-venue-v2")

function composition(engineId: "venueOrders" | "commerce") {
    return restaurantV3?.engines.find((engine) => engine.engineId === engineId)
}

check(
  "restaurant v3 venue required capabilities are exact",
  JSON.stringify(composition("venueOrders")?.capabilities) ===
    JSON.stringify(["qrOrdering", "guestTracking", "reservations"]),
)
check(
  "restaurant v3 commerce required capabilities now include inventory",
  JSON.stringify(composition("commerce")?.capabilities) === JSON.stringify(["catalog", "orders", "inventory"]),
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
  "restaurant inventory is no longer a planned backlog item either",
  composition("commerce")?.plannedCapabilities === undefined,
)
check(
  "commerce inventory capability is now declared available with real evidence",
  (() => {
    const capability = businessEngineDescriptors.commerce.capabilities.find((c) => c.id === "inventory")
    return capability?.maturity === "available" && capability.evidence !== "none"
  })(),
)
check("all registry blueprints validate", listBusinessBlueprints().every((blueprint) => validateBusinessBlueprint(blueprint).ok))

// Negative test: an active blueprint may not REQUIRE a capability whose maturity is
// planned. The descriptor is synthetic by construction so this remains meaningful after
// the real registry has no planned capabilities.
const syntheticFieldJobsDescriptor: EngineDescriptor = {
  id: "fieldJobs",
  label: "Synthetic contract-test engine",
  description: "Test-only descriptor for capability maturity validation.",
  capabilities: [
    {
      id: "__contractTestPlanned",
      label: "Synthetic planned capability",
      description: "A capability that remains planned by test construction.",
      maturity: "planned",
      evidence: "none",
    },
    {
      id: "__contractTestAvailable",
      label: "Synthetic available capability",
      description: "A capability that is available by test construction.",
      maturity: "available",
      evidence: "scripts/one-off/check-capability-contract.ts",
    },
  ],
}
const syntheticRegistry: Readonly<Record<string, EngineDescriptor>> = {
  ...businessEngineDescriptors,
  fieldJobs: syntheticFieldJobsDescriptor,
}
const activeWithPlannedRequiredCapability: BusinessBlueprint = {
  id: "invalid-active-planned-capability",
  version: "1.0.0",
  status: "active",
  name: "Invalid active blueprint",
  vertical: "contract-test",
  summary: "Negative test: active blueprints cannot require planned capabilities.",
  engines: [{ engineId: "fieldJobs", capabilities: ["__contractTestPlanned"], required: true }],
  workflows: [],
  ownerCopilotPrompts: [],
}
const negativeResult = validateBusinessBlueprint(activeWithPlannedRequiredCapability, syntheticRegistry)
checkInvertible("active blueprint requiring synthetic planned capability is rejected", !negativeResult.ok)
check(
  "synthetic planned rejection identifies maturity enforcement",
  negativeResult.issues.some(
    (validationIssue) =>
      validationIssue.path === "engines.0.capabilities.0" &&
      validationIssue.message.includes("maturity is planned") &&
      validationIssue.message.includes("must be available"),
  ),
)
check(
  "synthetic planned capability remains planned, so the negative test is not vacuous",
  syntheticFieldJobsDescriptor.capabilities.find((capability) => capability.id === "__contractTestPlanned")?.maturity ===
    "planned",
)

const draftWithPlannedRequiredCapability: BusinessBlueprint = {
  ...activeWithPlannedRequiredCapability,
  id: "valid-draft-planned-capability",
  status: "draft",
}
check(
  "draft blueprint may reference synthetic planned capability",
  validateBusinessBlueprint(draftWithPlannedRequiredCapability, syntheticRegistry).ok,
)

const proposedWithPlannedRequiredCapability: BusinessBlueprint = {
  ...activeWithPlannedRequiredCapability,
  id: "valid-proposed-planned-capability",
  status: "proposed",
}
check(
  "proposed blueprint may reference synthetic planned capability",
  validateBusinessBlueprint(proposedWithPlannedRequiredCapability, syntheticRegistry).ok,
)

const activeWithAvailableRequiredCapability: BusinessBlueprint = {
  ...activeWithPlannedRequiredCapability,
  id: "valid-active-available-capability",
  engines: [{ engineId: "fieldJobs", capabilities: ["__contractTestAvailable"], required: true }],
}
check(
  "active blueprint requiring synthetic available capability is allowed",
  validateBusinessBlueprint(activeWithAvailableRequiredCapability, syntheticRegistry).ok,
)

const defaultRegistryResult = validateBusinessBlueprint(activeWithPlannedRequiredCapability)
const explicitRegistryResult = validateBusinessBlueprint(activeWithPlannedRequiredCapability, businessEngineDescriptors)
check(
  "validator default registry matches the explicit real registry",
  JSON.stringify(defaultRegistryResult) === JSON.stringify(explicitRegistryResult),
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
  "commerce returns is now available, so it can no longer serve as the planned example",
  businessEngineDescriptors.commerce.capabilities.find((c) => c.id === "returns")?.maturity === "available",
)
check(
  "casesProjects retainers is now available, so it can no longer serve as the planned example either",
  businessEngineDescriptors.casesProjects.capabilities.find((c) => c.id === "retainers")?.maturity === "available",
)
check(
  "contentCohorts accessLevels is now available, so it can no longer serve as the planned example either",
  businessEngineDescriptors.contentCohorts.capabilities.find((c) => c.id === "accessLevels")?.maturity === "available",
)
check(
  "fieldJobs dispatch is now available, so it can no longer serve as the planned example either",
  businessEngineDescriptors.fieldJobs.capabilities.find((c) => c.id === "dispatch")?.maturity === "available",
)
check(
  "fieldJobs intake is now available too",
  businessEngineDescriptors.fieldJobs.capabilities.find((c) => c.id === "intake")?.maturity === "available",
)

// Wave G3 promoted two capabilities that three ACTIVE blueprints were carrying as planned
// backlog entries. A backlog entry for something that exists is a false statement, so they
// had to move into the required set - the same correction restaurant-venue-v3 made for
// inventory in Wave F. This asserts the move happened rather than trusting the comment.
for (const [blueprintId, engineId, capabilityId] of [
  ["coaching-studio-v2", "contentCohorts", "accessLevels"],
  ["consulting-agency-v1", "casesProjects", "retainers"],
  ["ca-practice-v1", "casesProjects", "retainers"],
] as Array<[string, string, string]>) {
  const blueprint = getBusinessBlueprint(blueprintId)
  const composition = blueprint?.engines.find((e) => e.engineId === engineId)
  check(
    `${blueprintId} now requires ${engineId}:${capabilityId} instead of listing it as planned`,
    composition?.capabilities.includes(capabilityId) === true &&
      (composition?.plannedCapabilities ?? []).includes(capabilityId) === false,
    `required=${composition?.capabilities.join("+")} planned=${(composition?.plannedCapabilities ?? []).join("+") || "none"}`,
  )
}
// The remaining planned backlog entries must all still be genuinely unbuilt, or the same
// false-statement problem is back somewhere else.
//
// DEPRECATED blueprints are exempt, and the exemption is the interesting part. This check
// caught restaurant-venue-v2 listing commerce:inventory as planned, which became available in
// Wave F. v2 is retained for addressability as a HISTORICAL contract, and its backlog was
// accurate when it was written; editing it to match today would be claiming the historical
// contract said something it did not. A live blueprint is a claim about now, a deprecated one is
// a record of then. The exemption is listed by name below so it cannot quietly grow.
const HISTORICAL_BACKLOG_EXEMPTIONS = ["restaurant-venue-v2"]
const falseBacklog: string[] = []
const exemptedBacklog: string[] = []
for (const blueprint of listBusinessBlueprints()) {
  for (const composition of blueprint.engines) {
    for (const capabilityId of composition.plannedCapabilities ?? []) {
      const capability = businessEngineDescriptors[composition.engineId].capabilities.find((c) => c.id === capabilityId)
      if (capability?.maturity !== "available") continue
      const entry = `${blueprint.id} lists ${composition.engineId}:${capabilityId} as planned, but it is available`
      if (blueprint.status === "deprecated") exemptedBacklog.push(entry)
      else falseBacklog.push(entry)
    }
  }
}
checkInvertible(
  "no LIVE blueprint carries a planned backlog entry for a capability that is already available",
  falseBacklog.length === 0,
  falseBacklog.join("; ") || "none",
)
check(
  "every stale backlog entry belongs to a deprecated blueprint, and to one this harness already knows about",
  exemptedBacklog.every((entry) => HISTORICAL_BACKLOG_EXEMPTIONS.some((id) => entry.startsWith(`${id} `))),
  exemptedBacklog.join("; ") || "none",
)

// Wave E and F activations, asserted individually so a silent status regression is caught.
for (const [blueprintId, expectedStatus] of [
  ["restaurant-venue-v1", "deprecated"],
  ["restaurant-venue-v2", "deprecated"],
  ["restaurant-venue-v3", "active"],
  ["coaching-studio-v1", "deprecated"],
  ["coaching-studio-v2", "active"],
  ["consulting-agency-v1", "active"],
  ["ca-practice-v1", "active"],
  ["retail-storefront-v1", "active"],
] as Array<[string, string]>) {
  const blueprint = getBusinessBlueprint(blueprintId)
  check(`${blueprintId} exists`, blueprint !== null)
  check(`${blueprintId} status is ${expectedStatus}`, blueprint?.status === expectedStatus, blueprint?.status)
}

// Retail is active as of Wave G. The previous version of this block asserted the opposite —
// "activating retail is still rejected" — and named variants, fulfilment and returns as the
// reason. That assertion is now inverted rather than deleted, because the interesting claim
// is not "retail is active" (a string in blueprints.ts) but "retail activation is what the
// validator produces given the real capability registry".
const retail = getBusinessBlueprint("retail-storefront-v1")
check("retail storefront requires inventory", retail?.engines[0]?.capabilities.includes("inventory") === true)
check(
  "retail storefront also requires variants, fulfilment and returns",
  ["variants", "fulfilment", "returns"].every((c) => retail?.engines[0]?.capabilities.includes(c) === true),
)
const retailActivation = retail === null ? null : validateBusinessBlueprint({ ...retail, status: "active" })
checkInvertible("activating retail is accepted", retailActivation !== null && retailActivation.ok)
check(
  "retail activation carries no outstanding issue",
  (retailActivation?.issues ?? []).length === 0,
  (retailActivation?.issues ?? []).map((i) => i.message).join(" | ").slice(0, 200),
)
check(
  "every capability retail requires is available with an evidence file that exists",
  (retail?.engines[0]?.capabilities ?? []).every((capabilityId) => {
    const capability = businessEngineDescriptors.commerce.capabilities.find((c) => c.id === capabilityId)
    return capability?.maturity === "available" && existsSync(join(APP_ROOT, capability.evidence))
  }),
)

// Required by the wave brief: activation must fail when ANY ONE required capability is
// downgraded. Asserted by temporarily downgrading each of the six in the real registry and
// re-running the real validator, rather than by constructing a fake registry — a fake one
// would only prove that the fake is wired up. Each downgrade is reverted immediately and
// the revert is verified at the end, so this test cannot leak state into later assertions.
const retailRequired = retail?.engines[0]?.capabilities ?? []
const downgradeEvidence: Array<{ capability: string; downgradedTo: string; rejected: boolean; named: boolean }> = []
for (const capabilityId of retailRequired) {
  const capability = businessEngineDescriptors.commerce.capabilities.find((c) => c.id === capabilityId)
  if (!capability || retail === null) continue
  for (const downgradedTo of ["partial", "planned"] as const) {
    const original = capability.maturity
    capability.maturity = downgradedTo
    const result = validateBusinessBlueprint({ ...retail, status: "active" })
    capability.maturity = original
    const messages = result.issues.map((i) => i.message).join(" | ")
    downgradeEvidence.push({
      capability: capabilityId,
      downgradedTo,
      rejected: !result.ok,
      named: messages.includes(`commerce:${capabilityId}`),
    })
    checkInvertible(
      `downgrading commerce:${capabilityId} to ${downgradedTo} blocks retail activation`,
      !result.ok,
    )
    check(
      `the ${capabilityId}/${downgradedTo} rejection names the capability it blocked on`,
      messages.includes(`commerce:${capabilityId}`) && messages.includes(`maturity is ${downgradedTo}`),
      messages.slice(0, 160),
    )
  }
}
check(
  "the downgrade test covered all six required retail capabilities in both directions",
  downgradeEvidence.length === 12 && new Set(downgradeEvidence.map((d) => d.capability)).size === 6,
  `${downgradeEvidence.length} cases`,
)
// The registry must be exactly as it was before the downgrade loop ran, or every assertion
// after this point would be reading mutated state.
check(
  "the capability registry is restored after the downgrade test",
  ["catalog", "orders", "inventory", "variants", "fulfilment", "returns"].every(
    (c) => businessEngineDescriptors.commerce.capabilities.find((x) => x.id === c)?.maturity === "available",
  ),
)
const retailAfterDowngradeTest = retail === null ? null : validateBusinessBlueprint({ ...retail, status: "active" })
check(
  "retail still activates cleanly after the downgrade test restored the registry",
  retailAfterDowngradeTest !== null && retailAfterDowngradeTest.ok,
)

// Wave G must not let an activation imply an integration. These three are the claims a
// reader would most reasonably assume from an active retail storefront, and none of them
// is true, so the blueprint text has to say so.
const retailProse = `${retail?.summary ?? ""}`
check(
  "the retail summary does not claim a carrier integration",
  !/\b(carrier api|carrier integration|live tracking|real-time tracking)\b/i.test(retailProse),
)
check(
  "the retail summary states that tracking is owner-entered and refunds are not executed",
  /owner-entered/i.test(retailProse) && /referenced rather than executed/i.test(retailProse),
)
check(
  "the fulfilment capability description states that no carrier is contacted",
  /No carrier is contacted/i.test(
    businessEngineDescriptors.commerce.capabilities.find((c) => c.id === "fulfilment")?.description ?? "",
  ),
)
check(
  "the returns capability description states that no refund is executed",
  /No refund is executed/i.test(
    businessEngineDescriptors.commerce.capabilities.find((c) => c.id === "returns")?.description ?? "",
  ),
)

report.granularCapabilities = requiredGranularCapabilities
report.restaurantBlueprint = {
  historicalIds: [restaurantV1?.id, restaurantV2?.id],
  activeId: restaurantV3?.id,
  version: restaurantV3?.version,
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
report.retailActivation = {
  status: retail?.status,
  accepted: retailActivation?.ok === true,
  required: retail?.engines[0]?.capabilities,
  downgradeCases: downgradeEvidence.length,
  downgradeAllRejected: downgradeEvidence.every((d) => d.rejected && d.named),
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
