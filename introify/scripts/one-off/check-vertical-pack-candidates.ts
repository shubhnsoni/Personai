/**
 * check-vertical-pack-candidates.ts
 *
 * Executable contract for the UNREGISTERED candidate vertical packs in
 * src/lib/business-os/vertical-packs/.
 *
 * WHAT THIS HARNESS IS FOR: a candidate pack is prose plus a type until something falsifies it. The
 * claims worth falsifying are not "does it compile" but "does it overclaim" - a pack that names a
 * capability nobody built, that quietly requires a capability whose provider is inert, that could be
 * reached by the product, or that implies a clinical function, is worse than no pack at all.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it opens no database connection, starts no server, and writes
 * nothing. Every fact it checks is derivable from the static registry, the real validator and the files
 * on disk, which is why it can run in a bare checkout.
 *
 * INVERSION: set INVERT_ASSERTION=1 to flip every invertible assertion. A harness that cannot be made
 * to fail is not evidence, so the required proof for this file is exit 0 normally, non-zero inverted,
 * exit 0 again once restored. Non-vacuity assertions (the ones asserting a FIXTURE really has the bad
 * property a negative test depends on) use plain `check` and are NOT inverted, because inverting them
 * would assert the fixture is well-formed, which is the opposite of their purpose.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { getBusinessBlueprint, listBusinessBlueprints } from "../../src/lib/business-os/blueprints"
import { businessEngineDescriptors } from "../../src/lib/business-os/engines"
import { validateBusinessBlueprint } from "../../src/lib/business-os/validation"
import { planWorkflowRun } from "../../src/lib/business-os/workflow"
import type { BusinessBlueprint, BusinessEngineId, WorkflowActionKind } from "../../src/lib/business-os/types"
import {
  CANDIDATE_ALLOWED_ACTION_KINDS,
  CANDIDATE_STATUS,
  getVerticalPackCandidate,
  listVerticalPackCandidates,
} from "../../src/lib/business-os/vertical-packs"
import type { VerticalPackCandidate } from "../../src/lib/business-os/vertical-packs"
import { CORRESPONDING_BLUEPRINT, ROLES_WITHOUT_BLUEPRINT } from "../../src/lib/onboarding-needs"
import type { Surface } from "../../src/lib/surfaces"

const APP_ROOT = join(__dirname, "../..")
const PACK_DIR = join(APP_ROOT, "src/lib/business-os/vertical-packs")

const INVERT = process.env.INVERT_ASSERTION === "1"

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * ASSERTION EVIDENCE. Counted inside the real helper, so the number the gate reads
 * is produced by the same call that decides the verdict - there is no separate
 * tally that could drift from, or be maintained independently of, the checks.
 *
 * Deliberately not a literal anywhere: a hard-coded total would keep printing a
 * healthy-looking count after someone deleted half the assertions, which is the
 * exact failure the evidence contract exists to catch. Every assertion that runs
 * increments `assertionsRun`; only one whose condition held increments
 * `assertionsPassed`. So a failing assertion necessarily LOWERS the passed count
 * and, through `failures`, sets a non-zero exit.
 */
let assertionsRun = 0
let assertionsPassed = 0

function check(name: string, condition: unknown, detail?: string) {
  assertionsRun += 1
  if (condition) {
    assertionsPassed += 1
    return
  }
  failures.push(detail ? `${name}: ${detail}` : name)
}

function checkInvertible(name: string, condition: unknown, detail?: string) {
  check(name, INVERT ? !condition : condition, detail)
}

// ---------------------------------------------------------------------------
// Expected inventory. Hardcoded rather than derived from the module, so adding or
// dropping a candidate has to be a deliberate edit here as well.
// ---------------------------------------------------------------------------

const EXPECTED_CANDIDATE_IDS = [
  "home-services-v1",
  "clinic-practice-v1",
] as const

/**
 * Every member of the real `Surface` union. Typed as `readonly Surface[]`, so if a surface is added or
 * retired this list stops compiling rather than silently going stale - the same reason
 * check-capability-contract.ts checks evidence paths on disk instead of trusting a maturity string.
 */
const KNOWN_SURFACES: readonly Surface[] = [
  "home",
  "profile",
  "inbox",
  "leads",
  "shop",
  "services",
  "calendar",
  "courses",
  "events",
  "sales",
  "businessOs",
]

const candidates = listVerticalPackCandidates()

// ---------------------------------------------------------------------------
// 1. Six unique candidate ids.
// ---------------------------------------------------------------------------

checkInvertible("exactly two candidates remain unregistered", candidates.length === 2, `${candidates.length}`)

const candidateIds = candidates.map((candidate) => candidate.blueprint.id)
const uniqueCandidateIds = new Set(candidateIds)
checkInvertible("candidate ids are unique", uniqueCandidateIds.size === candidateIds.length, candidateIds.join(", "))
checkInvertible(
  "the candidate id set is exactly the expected two",
  EXPECTED_CANDIDATE_IDS.every((id) => uniqueCandidateIds.has(id)) && uniqueCandidateIds.size === EXPECTED_CANDIDATE_IDS.length,
  candidateIds.join(", "),
)
for (const id of EXPECTED_CANDIDATE_IDS) {
  checkInvertible(`${id} resolves through getVerticalPackCandidate`, getVerticalPackCandidate(id)?.blueprint.id === id)
}
checkInvertible("an unknown candidate id resolves to null", getVerticalPackCandidate("__no-such-candidate") === null)

// ---------------------------------------------------------------------------
// 2. NOT REGISTERED. The most important property here: the product must be unable to reach a candidate.
// ---------------------------------------------------------------------------

const registryIds = new Set(listBusinessBlueprints().map((blueprint) => blueprint.id))
for (const id of candidateIds) {
  checkInvertible(`${id} is absent from the blueprint registry`, !registryIds.has(id))
  checkInvertible(`${id} does not resolve through getBusinessBlueprint`, getBusinessBlueprint(id) === null)
}

const correspondingBlueprintIds = new Set(Object.values(CORRESPONDING_BLUEPRINT))
for (const id of candidateIds) {
  checkInvertible(`no onboarding role corresponds to ${id}`, !correspondingBlueprintIds.has(id))
}

// Structural proof of non-registration: the registry file must not import this package at all. A
// behavioural check alone would pass if blueprints.ts imported the candidates and merely failed to push
// them, which is one edit away from shipping them.
const blueprintsSource = readFileSync(join(APP_ROOT, "src/lib/business-os/blueprints.ts"), "utf8")
checkInvertible(
  "blueprints.ts imports only the reviewed registered pack list, not the candidate list",
  /listRegisteredVerticalPacks/.test(blueprintsSource) && !/listVerticalPackCandidates/.test(blueprintsSource),
)
for (const id of candidateIds) {
  checkInvertible(`blueprints.ts does not mention ${id}`, !blueprintsSource.includes(id))
}
const businessOsIndexSource = readFileSync(join(APP_ROOT, "src/lib/business-os/index.ts"), "utf8")
checkInvertible(
  "the business-os barrel does not re-export the vertical-packs package",
  !/vertical-packs/.test(businessOsIndexSource),
)

// The registry itself must be untouched by this work.
checkInvertible(
  "the registry contains the nine established blueprints plus four promoted packs",
  listBusinessBlueprints().length === 13,
  `${listBusinessBlueprints().length}`,
)

// ---------------------------------------------------------------------------
// 3. Every candidate validates against the REAL contract.
// ---------------------------------------------------------------------------

for (const candidate of candidates) {
  const result = validateBusinessBlueprint(candidate.blueprint)
  checkInvertible(
    `${candidate.blueprint.id} validates against the real contract`,
    result.ok,
    result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" | "),
  )
  checkInvertible(`${candidate.blueprint.id} validates with zero issues`, result.issues.length === 0)
}

// ---------------------------------------------------------------------------
// 4. None is active, and each sits at the most conservative non-active status.
// ---------------------------------------------------------------------------

checkInvertible("the shared candidate status constant is draft", CANDIDATE_STATUS === "draft")
for (const candidate of candidates) {
  checkInvertible(
    `${candidate.blueprint.id} is draft, the most conservative non-active status`,
    candidate.blueprint.status === "draft",
    candidate.blueprint.status,
  )
  checkInvertible(`${candidate.blueprint.id} declares readiness candidate-not-registered`, candidate.readiness === "candidate-not-registered")
  checkInvertible(`${candidate.blueprint.id} declares registered false`, candidate.registered === false)
  // `deprecated` would claim it was once live; `proposed` would claim it had been put forward.
}

// ---------------------------------------------------------------------------
// 5. Every engine and capability reference exists in the REAL registry.
// ---------------------------------------------------------------------------

const engineIds = new Set(Object.keys(businessEngineDescriptors))
const capabilityIndex = new Map<string, { maturity: string; evidence: string }>()
for (const engine of Object.values(businessEngineDescriptors)) {
  for (const capability of engine.capabilities) {
    capabilityIndex.set(`${engine.id}:${capability.id}`, { maturity: capability.maturity, evidence: capability.evidence })
  }
}

const dependencyTable: Array<Record<string, unknown>> = []

for (const candidate of candidates) {
  for (const composition of candidate.blueprint.engines) {
    checkInvertible(
      `${candidate.blueprint.id} references the real engine ${composition.engineId}`,
      engineIds.has(composition.engineId),
    )
    for (const capabilityId of composition.capabilities) {
      checkInvertible(
        `${candidate.blueprint.id} references real capability ${composition.engineId}:${capabilityId}`,
        capabilityIndex.has(`${composition.engineId}:${capabilityId}`),
      )
    }
    for (const capabilityId of composition.plannedCapabilities ?? []) {
      checkInvertible(
        `${candidate.blueprint.id} backlogs real capability ${composition.engineId}:${capabilityId}`,
        capabilityIndex.has(`${composition.engineId}:${capabilityId}`),
      )
      checkInvertible(
        `${candidate.blueprint.id} does not both select and backlog ${composition.engineId}:${capabilityId}`,
        !composition.capabilities.includes(capabilityId),
      )
    }
    dependencyTable.push({
      candidate: candidate.blueprint.id,
      engine: composition.engineId,
      required: composition.required,
      capabilities: composition.capabilities.map((id) => `${id}(${capabilityIndex.get(`${composition.engineId}:${id}`)?.maturity})`),
      backlogged: (composition.plannedCapabilities ?? []).map(
        (id) => `${id}(${capabilityIndex.get(`${composition.engineId}:${id}`)?.maturity})`,
      ),
    })
  }
}

// Every capability an active blueprint could rely on must cite an evidence file that exists. Candidates
// are not active, but a candidate pointing at rotted evidence would still be describing something that
// is not there.
const candidateEvidenceRot: string[] = []
for (const candidate of candidates) {
  for (const composition of candidate.blueprint.engines) {
    for (const capabilityId of composition.capabilities) {
      const entry = capabilityIndex.get(`${composition.engineId}:${capabilityId}`)
      if (!entry || entry.maturity === "planned") continue
      if (!existsSync(join(APP_ROOT, entry.evidence))) {
        candidateEvidenceRot.push(`${candidate.blueprint.id} -> ${composition.engineId}:${capabilityId} -> ${entry.evidence}`)
      }
    }
  }
}
checkInvertible(
  "every capability a candidate selects cites an evidence file that exists on disk",
  candidateEvidenceRot.length === 0,
  candidateEvidenceRot.join("; "),
)

// ---------------------------------------------------------------------------
// 6. Partial capabilities are not represented as available.
// ---------------------------------------------------------------------------

const partialInRequired: string[] = []
const falseBacklog: string[] = []
for (const candidate of candidates) {
  for (const composition of candidate.blueprint.engines) {
    if (composition.required) {
      for (const capabilityId of composition.capabilities) {
        const entry = capabilityIndex.get(`${composition.engineId}:${capabilityId}`)
        if (entry && entry.maturity !== "available") {
          partialInRequired.push(`${candidate.blueprint.id} requires ${composition.engineId}:${capabilityId} (${entry.maturity})`)
        }
      }
    }
    for (const capabilityId of composition.plannedCapabilities ?? []) {
      const entry = capabilityIndex.get(`${composition.engineId}:${capabilityId}`)
      // A backlog entry for something that already exists is a false statement about the product - the
      // exact failure check-capability-contract.ts refuses for live blueprints.
      if (entry && entry.maturity === "available") {
        falseBacklog.push(`${candidate.blueprint.id} backlogs ${composition.engineId}:${capabilityId}, which is available`)
      }
    }
  }
}
checkInvertible(
  "no candidate REQUIRES a capability that is not available",
  partialInRequired.length === 0,
  partialInRequired.join("; "),
)
checkInvertible(
  "no candidate backlogs a capability that is already available",
  falseBacklog.length === 0,
  falseBacklog.join("; "),
)

// Non-vacuity: the two partial capabilities must still be partial, or the check above proves nothing.
check(
  "appointments:reminders is still only partial, so the partial checks are not vacuous",
  capabilityIndex.get("appointments:reminders")?.maturity === "partial",
)
check(
  "appointments:deposits is still only partial, so the partial checks are not vacuous",
  capabilityIndex.get("appointments:deposits")?.maturity === "partial",
)

// And the inert providers must actually be carried as backlog somewhere, or "we did not overclaim" would
// be satisfied by never mentioning them at all.
const backloggedPairs = new Set(
  candidates.flatMap((candidate) =>
    candidate.blueprint.engines.flatMap((composition) =>
      (composition.plannedCapabilities ?? []).map((id) => `${composition.engineId}:${id}`),
    ),
  ),
)
checkInvertible("at least one candidate backlogs appointments:reminders rather than ignoring it", backloggedPairs.has("appointments:reminders"))
checkInvertible("at least one candidate backlogs appointments:deposits rather than ignoring it", backloggedPairs.has("appointments:deposits"))

// ---------------------------------------------------------------------------
// 7. No provider, payment or message execution claim.
// ---------------------------------------------------------------------------

const allowedActionKinds = new Set<string>(CANDIDATE_ALLOWED_ACTION_KINDS)
checkInvertible("sendNotification is not an allowed candidate action kind", !allowedActionKinds.has("sendNotification"))

const notificationActions: string[] = []
const disallowedActions: string[] = []
const scheduleTriggers: string[] = []
for (const candidate of candidates) {
  for (const workflow of candidate.blueprint.workflows) {
    if (workflow.trigger.kind === "schedule") {
      // A schedule implies a scheduler. There is none, so a scheduled trigger would be a claim that
      // something fires on its own.
      scheduleTriggers.push(`${candidate.blueprint.id}:${workflow.id}`)
    }
    for (const action of workflow.actions) {
      const kind: WorkflowActionKind = action.kind
      if (kind === "sendNotification") notificationActions.push(`${candidate.blueprint.id}:${workflow.id}:${action.id}`)
      if (!allowedActionKinds.has(kind)) disallowedActions.push(`${candidate.blueprint.id}:${workflow.id}:${action.id} (${kind})`)
    }
  }
}
checkInvertible(
  "no candidate declares a sendNotification action, because no messaging provider is wired",
  notificationActions.length === 0,
  notificationActions.join("; "),
)
checkInvertible(
  "every candidate action kind is on the allowed candidate list",
  disallowedActions.length === 0,
  disallowedActions.join("; "),
)
checkInvertible(
  "no candidate uses a schedule trigger, because no scheduler exists",
  scheduleTriggers.length === 0,
  scheduleTriggers.join("; "),
)

// Provider boundaries must be declared, and only as inert or owner-gated.
const badBoundaries: string[] = []
for (const candidate of candidates) {
  for (const gated of candidate.ownerGated) {
    if (gated.boundary !== "inert" && gated.boundary !== "owner-gated") {
      badBoundaries.push(`${candidate.blueprint.id}:${gated.id} (${gated.boundary})`)
    }
  }
  checkInvertible(
    `${candidate.blueprint.id} names at least one unsupported function`,
    candidate.unsupported.length > 0,
  )
  checkInvertible(
    `${candidate.blueprint.id} names at least one owner-gated function`,
    candidate.ownerGated.length > 0,
  )
  for (const unsupported of candidate.unsupported) {
    checkInvertible(`${candidate.blueprint.id}:${unsupported.id} states a reason`, unsupported.reason.trim().length > 0)
  }
  for (const gated of candidate.ownerGated) {
    checkInvertible(`${candidate.blueprint.id}:${gated.id} states its gate`, gated.gate.trim().length > 0)
  }
}
checkInvertible("every declared provider boundary is inert or owner-gated", badBoundaries.length === 0, badBoundaries.join("; "))

/**
 * Affirmative prose per candidate: the text that DESCRIBES what the pack does. `unsupported`,
 * `ownerGated`, `integrationNotes` and `terminologyNote` are excluded because their whole content is
 * negation, and scanning them for the words they exist to deny would be incoherent.
 */
function affirmativeProse(candidate: VerticalPackCandidate): string[] {
  return [
    candidate.blueprint.name,
    candidate.blueprint.summary,
    ...candidate.blueprint.ownerCopilotPrompts,
    ...Object.values(candidate.proposedTerminology),
    ...candidate.onboarding.steps,
    ...candidate.onboarding.requiredOwnerDecisions,
    ...candidate.ownerWorkflow.approvalGates,
    candidate.ownerWorkflow.executionNote,
    ...candidate.dailyOpportunities.map((opportunity) => opportunity.prompt),
    ...candidate.blueprint.workflows.flatMap((workflow) => [
      workflow.name,
      ...workflow.actions.map((action) => action.label),
      ...workflow.actions.map((action) => action.approval?.reason ?? ""),
    ]),
  ].filter((text) => text.trim().length > 0)
}

// Execution claims: an affirmative sentence must never say the product itself delivers, charges or
// integrates.
const EXECUTION_CLAIM_PATTERNS: Array<[string, RegExp]> = [
  ["delivers a message", /\b(sends?|sending|delivers?|texts?|emails?)\s+(the\s+|a\s+|an\s+)?(sms|text|email|whatsapp|message|reminder|notification)/i],
  ["captures a payment", /\b(charges?|captures?|collects?|processes?|refunds?)\s+(the\s+|a\s+|an\s+)?(payment|card|deposit|fee|money)/i],
  ["calls a provider", /\b(calls?|contacts?|syncs?\s+with|integrates?\s+with|posts?\s+to)\s+(the\s+)?(provider|carrier|gateway|portal|mls|api)/i],
  ["automatic execution", /\bautomatically\s+(sends?|notifies|charges?|books?|promotes?|executes?|runs?|files?)/i],
]

const executionClaims: string[] = []
const scannedProseCounts: Record<string, number> = {}
for (const candidate of candidates) {
  const prose = affirmativeProse(candidate)
  scannedProseCounts[candidate.blueprint.id] = prose.length
  checkInvertible(`${candidate.blueprint.id} has affirmative prose to scan`, prose.length >= 10, `${prose.length}`)
  for (const text of prose) {
    for (const [label, pattern] of EXECUTION_CLAIM_PATTERNS) {
      if (pattern.test(text)) executionClaims.push(`${candidate.blueprint.id}: ${label}: ${text.slice(0, 120)}`)
    }
  }
}
checkInvertible(
  "no candidate's affirmative prose claims a message, payment or provider execution",
  executionClaims.length === 0,
  executionClaims.join(" ;; "),
)

// ---------------------------------------------------------------------------
// 8. No fabricated persisted data, and no automatic workflow execution.
// ---------------------------------------------------------------------------

const PACK_FILES = [
  "types.ts",
  "index.ts",
  "salon-spa-v1.ts",
  "events-studio-v1.ts",
  "real-estate-brokerage-v1.ts",
  "home-services-v1.ts",
  "recruitment-agency-v1.ts",
  "clinic-practice-v1.ts",
]

// A candidate is declarative. If one of these files could reach a database, a network or a provider SDK,
// "declarative" would be an assertion about intent rather than about the code.
const FORBIDDEN_SOURCE_PATTERNS: Array<[string, RegExp]> = [
  ["prisma client", /@prisma\/client|PrismaClient|\bprisma\./],
  ["database access", /\b(findMany|findUnique|createMany|upsert|\$transaction|\$queryRaw)\b/],
  ["network call", /\bfetch\s*\(|axios|node-fetch|https?\.request/],
  ["provider sdk", /\bstripe\b|twilio|sendgrid|nodemailer|razorpay|googleapis/i],
  ["filesystem write", /writeFileSync|createWriteStream|\bunlinkSync\b/],
  ["timer or scheduler", /setInterval|setTimeout|node-cron|node-schedule/],
]

const forbiddenSourceHits: string[] = []
for (const file of PACK_FILES) {
  const absolute = join(PACK_DIR, file)
  checkInvertible(`vertical-packs/${file} exists`, existsSync(absolute))
  if (!existsSync(absolute)) continue
  const source = readFileSync(absolute, "utf8")
  for (const [label, pattern] of FORBIDDEN_SOURCE_PATTERNS) {
    if (pattern.test(source)) forbiddenSourceHits.push(`${file}: ${label}`)
  }
}
checkInvertible(
  "no candidate source file can reach a database, network, provider or scheduler",
  forbiddenSourceHits.length === 0,
  forbiddenSourceHits.join("; "),
)

// The workflow planner is a planner. Proven two ways: it produces only plan statuses, and it is
// referenced by nothing outside its own module, so no consumer turns a declaration into an effect.
const planStatuses = new Set<string>()
for (const candidate of candidates) {
  for (const workflow of candidate.blueprint.workflows) {
    const first = planWorkflowRun(workflow, "harness:check-vertical-pack-candidates")
    const second = planWorkflowRun(workflow, "harness:check-vertical-pack-candidates")
    for (const planned of first.actions) planStatuses.add(planned.status)
    checkInvertible(
      `${candidate.blueprint.id}:${workflow.id} plans every declared action`,
      first.actions.length === workflow.actions.length,
    )
    // Same input, same shape: a planner that accumulated state would drift between calls.
    checkInvertible(
      `${candidate.blueprint.id}:${workflow.id} planning is repeatable`,
      JSON.stringify(first.actions.map((a) => [a.action.id, a.status])) ===
        JSON.stringify(second.actions.map((a) => [a.action.id, a.status])),
    )
  }
}
checkInvertible(
  "planning yields only plan statuses, never an executed one",
  [...planStatuses].every((status) => status === "ready" || status === "waiting_for_approval"),
  [...planStatuses].join(", "),
)

const workflowModuleConsumers: string[] = []
for (const relative of ["src", "scripts"]) {
  // A CONSUMER is a call site or an import of the workflow module - not a prose mention. The candidate
  // files discuss planWorkflowRun by name in their comments precisely to state that nothing runs it, so
  // matching the bare identifier would flag the documentation of the property as a violation of it.
  const CALL_SITE = /planWorkflowRun\s*\(/
  const MODULE_IMPORT = /from\s+["'][^"']*business-os\/workflow["']/
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue
        walk(abs)
      } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const text = readFileSync(abs, "utf8")
        if (!CALL_SITE.test(text) && !MODULE_IMPORT.test(text)) continue
        const rel = abs.slice(APP_ROOT.length + 1).replace(/\\/g, "/")
        if (rel === "src/lib/business-os/workflow.ts") continue
        if (rel === "scripts/one-off/check-vertical-pack-candidates.ts") continue
        workflowModuleConsumers.push(rel)
      }
    }
  }
  const root = join(APP_ROOT, relative)
  if (existsSync(root)) walk(root)
}
checkInvertible(
  "nothing outside the workflow module calls or imports the planner, so no declaration is executed",
  workflowModuleConsumers.length === 0,
  workflowModuleConsumers.join("; "),
)

// Non-vacuity: the two detectors must actually fire on the shapes they are looking for, or the check
// above would pass simply because it can never match anything.
check(
  "the planner call-site detector matches a real call",
  /planWorkflowRun\s*\(/.test("const plan = planWorkflowRun(workflow, actor)"),
)
check(
  "the planner import detector matches a real import",
  /from\s+["'][^"']*business-os\/workflow["']/.test('import { planWorkflowRun } from "../../src/lib/business-os/workflow"'),
)
check(
  "the planner detectors ignore a prose mention",
  !/planWorkflowRun\s*\(/.test("workflow.ts exposes planWorkflowRun, which returns a plan"),
)

// Cross-references must resolve, or the configuration describes something that is not there.
for (const candidate of candidates) {
  const workflowIds = new Set(candidate.blueprint.workflows.map((workflow) => workflow.id))
  for (const configuredId of candidate.ownerWorkflow.configuredWorkflowIds) {
    checkInvertible(
      `${candidate.blueprint.id} configured workflow ${configuredId} is declared on the blueprint`,
      workflowIds.has(configuredId),
    )
  }
  checkInvertible(
    `${candidate.blueprint.id} states that workflows are not executed`,
    /plan|configuration only/i.test(candidate.ownerWorkflow.executionNote),
  )
  for (const opportunity of candidate.dailyOpportunities) {
    for (const pair of opportunity.readsFrom) {
      checkInvertible(
        `${candidate.blueprint.id}:${opportunity.id} reads from real capability ${pair}`,
        capabilityIndex.has(pair),
      )
    }
  }
  // Surfaces: real members only, and never the owner console.
  for (const surface of candidate.intendedSurfaces) {
    checkInvertible(`${candidate.blueprint.id} intends the real surface ${surface}`, KNOWN_SURFACES.includes(surface))
  }
  checkInvertible(
    `${candidate.blueprint.id} does not intend the businessOs owner console surface`,
    !candidate.intendedSurfaces.includes("businessOs"),
  )
  // Onboarding: the proposed role must not pretend to be an existing one.
  const realRoleKeys = new Set<string>([...Object.keys(CORRESPONDING_BLUEPRINT), ...ROLES_WITHOUT_BLUEPRINT])
  checkInvertible(
    `${candidate.blueprint.id} proposes a role key that does not already exist`,
    !realRoleKeys.has(candidate.onboarding.proposedRoleKey),
    candidate.onboarding.proposedRoleKey,
  )
  checkInvertible(
    `${candidate.blueprint.id} declares that it corresponds to no existing role`,
    candidate.onboarding.correspondsToExistingRole === false,
  )
  checkInvertible(`${candidate.blueprint.id} declares onboarding steps`, candidate.onboarding.steps.length > 0)
  checkInvertible(
    `${candidate.blueprint.id} declares required owner decisions`,
    candidate.onboarding.requiredOwnerDecisions.length > 0,
  )
  checkInvertible(
    `${candidate.blueprint.id} declares daily operational opportunities`,
    candidate.dailyOpportunities.length > 0,
  )
  checkInvertible(
    `${candidate.blueprint.id} states that terminology is not blueprint-declared`,
    /role-derived/.test(candidate.terminologyNote),
  )
}

// ---------------------------------------------------------------------------
// 9. Clinic boundaries. Non-clinical administration only.
// ---------------------------------------------------------------------------

const CLINICAL_TERM_PATTERNS: Array<[string, RegExp]> = [
  ["diagnosis", /\bdiagnos(is|es|e|ed|ing|tic)\b/i],
  ["prescription", /\bprescri(be|bes|bed|bing|ption|ptions)\b/i],
  ["treatment advice", /\btreatment\s+(advice|plan|guidance|recommendation)/i],
  ["medical record", /\bmedical\s+record/i],
  ["clinical record or advice", /\bclinical\s+(record|records|advice|guidance|decision|judgement)/i],
  ["protected health information", /\b(phi|protected\s+health\s+information)\b/i],
  ["triage", /\btriage\b/i],
  ["symptom", /\bsymptom/i],
  ["medication", /\bmedication\b/i],
  ["emergency care", /\bemergency\s+(care|department|treatment)\b/i],
]

const NEGATORS = /\b(no|not|never|none|nothing|neither|nor|outside|excluded|exclude|without|cannot|must not|does not|do not|holds no|has no|makes no|keeps no|is not|are not)\b/i

/**
 * Clauses that use a clinical term WITHOUT a negator in the SAME clause.
 *
 * The negator test is what makes this checkable at all: a pack whose entire purpose is to deny clinical
 * function has to be allowed to say the words it is denying. "has no part in urgent or emergency care"
 * is a boundary; "provides diagnosis support" is a claim.
 *
 * SCOPE IS THE CLAUSE, NOT THE SENTENCE, and that was a real bug rather than a refinement. A
 * sentence-scoped version of this function passed a mutation that injected "Provides diagnosis support
 * and issues a prescription for a practice" into the clinic summary, because the rest of that long
 * sentence happened to contain the word "nothing". Splitting on strong punctuation puts the claim and
 * the unrelated negator in different clauses, so the claim is caught. The cost is that a boundary
 * statement must carry its own negator next to the term it is denying, which is how one should be
 * written anyway.
 */
function unnegatedClinicalClaims(texts: readonly string[]): string[] {
  const offending: string[] = []
  for (const text of texts) {
    // Strong punctuation only. Splitting on "and"/"or" too would break "has no part in urgent or
    // emergency care", where the negator legitimately governs both branches.
    for (const clause of text.split(/[.!?;:,]\s*|\n+/)) {
      if (clause.trim().length === 0) continue
      for (const [label, pattern] of CLINICAL_TERM_PATTERNS) {
        if (!pattern.test(clause)) continue
        if (NEGATORS.test(clause)) continue
        offending.push(`${label}: ${clause.trim().slice(0, 140)}`)
      }
    }
  }
  return offending
}

// Applied to EVERY candidate, not only the clinic: a clinical claim would be just as wrong in the salon
// pack. The patterns are tight enough that the salon's "treatment" terminology does not match, because
// only "treatment advice/plan/guidance/recommendation" does.
const clinicalClaimsAcrossCandidates: string[] = []
for (const candidate of candidates) {
  for (const offence of unnegatedClinicalClaims(affirmativeProse(candidate))) {
    clinicalClaimsAcrossCandidates.push(`${candidate.blueprint.id}: ${offence}`)
  }
}
checkInvertible(
  "no candidate makes an unnegated clinical claim anywhere in its affirmative prose",
  clinicalClaimsAcrossCandidates.length === 0,
  clinicalClaimsAcrossCandidates.join(" ;; "),
)

const clinic = getVerticalPackCandidate("clinic-practice-v1")
checkInvertible("the clinic candidate exists", clinic !== null)

const REQUIRED_CLINIC_EXCLUSIONS: Array<[string, RegExp]> = [
  ["clinic-no-diagnosis", /\bdiagnos/i],
  ["clinic-no-prescriptions", /\bprescri/i],
  ["clinic-no-treatment-advice", /\btreatment\b/i],
  ["clinic-no-medical-records", /\brecord/i],
  ["clinic-no-phi-claim", /health information/i],
  ["clinic-no-hospital-workflows", /\bhospital|inpatient|ward|bed\b/i],
  ["clinic-no-emergency-care", /\bemergency|urgent|triage\b/i],
]

if (clinic) {
  const unsupportedById = new Map(clinic.unsupported.map((entry) => [entry.id, entry]))
  for (const [id, prosePattern] of REQUIRED_CLINIC_EXCLUSIONS) {
    const entry = unsupportedById.get(id)
    checkInvertible(`the clinic pack explicitly excludes ${id}`, entry !== undefined)
    // Non-vacuity: the exclusion must actually be about the thing its id names, not an empty entry
    // carrying the right key.
    checkInvertible(
      `the ${id} exclusion describes the function it names`,
      entry !== undefined && prosePattern.test(`${entry.label} ${entry.reason}`),
      entry ? `${entry.label}`.slice(0, 80) : "missing",
    )
  }

  // The clinic pack must be structurally narrow, not merely described as narrow.
  checkInvertible(
    "the clinic pack composes exactly one engine",
    clinic.blueprint.engines.length === 1,
    `${clinic.blueprint.engines.length}`,
  )
  checkInvertible(
    "the clinic pack composes only the appointments engine",
    clinic.blueprint.engines[0]?.engineId === "appointments",
    clinic.blueprint.engines[0]?.engineId,
  )
  const clinicEngineIds = clinic.blueprint.engines.map((composition) => composition.engineId)
  // documents is the obvious temptation and the one that would create a clinical-record-shaped hole.
  checkInvertible(
    "the clinic pack does not compose casesProjects, so it has no document store",
    !clinicEngineIds.includes("casesProjects" as BusinessEngineId),
  )
  checkInvertible(
    "the clinic pack does not compose commerce",
    !clinicEngineIds.includes("commerce" as BusinessEngineId),
  )
  checkInvertible(
    "the clinic pack's own summary states it is administrative only",
    /administrative only/i.test(clinic.blueprint.summary),
  )
  checkInvertible(
    "the clinic pack states it holds no health information",
    /holds no health information/i.test(clinic.blueprint.summary),
  )
  checkInvertible(
    "the clinic pack states it has no part in emergency care",
    /no part in urgent or emergency care/i.test(clinic.blueprint.summary),
  )
  checkInvertible(
    "the clinic pack explains why a document store was not composed",
    clinic.unsupported.some((entry) => /deliberately NOT composed/i.test(entry.reason)),
  )
  checkInvertible(
    "the clinic pack does not intend the shop or sales surface",
    !clinic.intendedSurfaces.includes("shop") && !clinic.intendedSurfaces.includes("sales"),
  )
}

// ---------------------------------------------------------------------------
// 10. NEGATIVE TESTS. Each must fail, and each fixture is asserted to really carry the defect.
// ---------------------------------------------------------------------------

function baseBlueprint(): BusinessBlueprint {
  return {
    id: "negative-fixture",
    version: "1.0.0",
    status: "draft",
    name: "Negative fixture",
    vertical: "negative-fixture",
    summary: "Fixture used to prove the candidate checks can fail.",
    engines: [{ engineId: "appointments", capabilities: ["services"], required: true }],
    workflows: [],
    ownerCopilotPrompts: [],
  }
}

// (a) An invented capability must be rejected by the REAL validator.
const inventedCapability: BusinessBlueprint = {
  ...baseBlueprint(),
  id: "negative-invented-capability",
  engines: [{ engineId: "appointments", capabilities: ["__notARealCapability"], required: true }],
}
const inventedCapabilityResult = validateBusinessBlueprint(inventedCapability)
checkInvertible("a candidate naming an invented capability is rejected", !inventedCapabilityResult.ok)
checkInvertible(
  "the invented-capability rejection says the capability is not declared",
  inventedCapabilityResult.issues.some((issue) => /is not declared on appointments/.test(issue.message)),
  inventedCapabilityResult.issues.map((i) => i.message).join(" | ").slice(0, 160),
)
check(
  "the invented-capability fixture really names a capability the registry does not have",
  !capabilityIndex.has("appointments:__notARealCapability"),
)

// (b) An invented ENGINE must be rejected too.
const inventedEngine: BusinessBlueprint = {
  ...baseBlueprint(),
  id: "negative-invented-engine",
  engines: [{ engineId: "__salonEngine" as BusinessEngineId, capabilities: ["services"], required: true }],
}
const inventedEngineResult = validateBusinessBlueprint(inventedEngine)
checkInvertible("a candidate naming an invented engine is rejected", !inventedEngineResult.ok)
checkInvertible(
  "the invented-engine rejection identifies an unknown engine id",
  inventedEngineResult.issues.some((issue) => /Unknown engine id/.test(issue.message)),
)
check("the invented-engine fixture really names an engine the registry does not have", !engineIds.has("__salonEngine"))

// (c) A duplicate candidate id must be detectable by the same rule the package enforces at load.
const duplicatedIds = [...candidateIds, candidateIds[0]]
const detectedDuplicates = duplicatedIds.filter((id, index, all) => all.indexOf(id) !== index)
checkInvertible("a duplicated candidate id is detected", detectedDuplicates.length > 0, detectedDuplicates.join(", "))
checkInvertible(
  "the duplicate detection names the offending id",
  detectedDuplicates.includes(candidateIds[0]),
)
check("the duplicate fixture really repeats an existing id", duplicatedIds.length === candidateIds.length + 1)
// And the real package must be free of the defect the fixture simulates.
checkInvertible(
  "the real candidate set has no duplicate id",
  candidateIds.filter((id, index, all) => all.indexOf(id) !== index).length === 0,
)

// (d) A forbidden clinical claim must be caught by the clinical scan.
const clinicalClaimFixture = [
  "This pack provides diagnosis support for practitioners.",
  "It writes a prescription and stores the medical record.",
]
const caughtClinicalClaims = unnegatedClinicalClaims(clinicalClaimFixture)
checkInvertible("an unnegated clinical claim is caught", caughtClinicalClaims.length >= 2, caughtClinicalClaims.join(" ;; "))
checkInvertible(
  "the clinical scan names diagnosis and prescription in the fixture",
  caughtClinicalClaims.some((claim) => claim.startsWith("diagnosis")) &&
    caughtClinicalClaims.some((claim) => claim.startsWith("prescription")),
  caughtClinicalClaims.join(" ;; "),
)
check(
  "the clinical fixture really contains clinical terms without a negator",
  /diagnosis/i.test(clinicalClaimFixture[0]) && !NEGATORS.test(clinicalClaimFixture[0]),
)
// The mirror direction: a NEGATED clinical sentence must be allowed, or the clinic pack could not
// describe its own boundary and the scan would be unusable.
const negatedClinicalFixture = ["This pack performs no diagnosis and issues no prescription."]
checkInvertible(
  "a negated clinical boundary statement is allowed",
  unnegatedClinicalClaims(negatedClinicalFixture).length === 0,
)
check(
  "the negated fixture really contains a clinical term",
  CLINICAL_TERM_PATTERNS.some(([, pattern]) => pattern.test(negatedClinicalFixture[0])),
)

/**
 * REGRESSION: the exact mutation a sentence-scoped negator test let through.
 *
 * This is the clinic summary with a clinical claim spliced into its opening clause. The remainder of the
 * sentence contains "nothing beyond it", and a sentence-scoped check accepted the whole thing on the
 * strength of that unrelated negator. Pinned here so the clause scope cannot silently regress to
 * sentence scope.
 */
const SENTENCE_SCOPE_REGRESSION =
  "Provides diagnosis support and issues a prescription for a practice, and nothing beyond it: bookable consultation slots with real capacity and overlap refusal."
const regressionClaims = unnegatedClinicalClaims([SENTENCE_SCOPE_REGRESSION])
checkInvertible(
  "a clinical claim is caught even when an unrelated negator appears later in the same sentence",
  regressionClaims.length >= 2,
  regressionClaims.join(" ;; "),
)
check(
  "the regression fixture really carries both an unrelated negator and two clinical terms",
  /\bnothing\b/i.test(SENTENCE_SCOPE_REGRESSION) &&
    /diagnos/i.test(SENTENCE_SCOPE_REGRESSION) &&
    /prescri/i.test(SENTENCE_SCOPE_REGRESSION),
)

// (e) An ACTIVE blueprint requiring a partial capability must still be rejected - the guard that keeps a
// candidate from being promoted while its providers are inert.
const activePartial: BusinessBlueprint = {
  ...baseBlueprint(),
  id: "negative-active-partial",
  status: "active",
  vertical: "negative-active-partial",
  engines: [{ engineId: "appointments", capabilities: ["reminders"], required: true }],
}
const activePartialResult = validateBusinessBlueprint(activePartial)
checkInvertible("activating a candidate that requires a partial capability is rejected", !activePartialResult.ok)
checkInvertible(
  "the partial rejection names maturity enforcement",
  activePartialResult.issues.some((issue) => /maturity is partial/.test(issue.message) && /must be available/.test(issue.message)),
)

// (f) Promoting each real candidate to active must be rejected for exactly the candidates whose required
// set is fully available, and accepted for none that carry an inert provider requirement. Computed
// rather than asserted per-candidate, so it stays honest as the packs change.
const promotionEvidence = candidates.map((candidate) => {
  const promoted = validateBusinessBlueprint({ ...candidate.blueprint, status: "active" })
  return { id: candidate.blueprint.id, wouldValidateIfActivated: promoted.ok, issues: promoted.issues.length }
})
// Neither remaining candidate requires a partial capability, so both would validate if activated. That
// is why their draft status must be deliberate rather than an accidental validator failure.
checkInvertible(
  "every candidate is held non-active by declaration, not by the validator refusing it",
  promotionEvidence.every((entry) => entry.wouldValidateIfActivated) &&
    promotionEvidence.length === 2 &&
    candidates.length === 2 &&
    candidates.every((candidate) => candidate.blueprint.status === "draft"),
  JSON.stringify(promotionEvidence),
)

// (g) A sendNotification action must be caught by the action-kind check.
const notificationFixtureKinds: WorkflowActionKind[] = ["recordAudit", "sendNotification"]
const caughtNotification = notificationFixtureKinds.filter((kind) => !allowedActionKinds.has(kind))
checkInvertible("a sendNotification action is caught", caughtNotification.length === 1, caughtNotification.join(", "))
check("the notification fixture really contains sendNotification", notificationFixtureKinds.includes("sendNotification"))

// (h) An execution claim in affirmative prose must be caught.
const executionClaimFixture = [
  "The system automatically sends an SMS reminder to the client.",
  "It charges the deposit to the card on file.",
]
const caughtExecutionClaims = executionClaimFixture.filter((text) =>
  EXECUTION_CLAIM_PATTERNS.some(([, pattern]) => pattern.test(text)),
)
checkInvertible(
  "an execution claim in prose is caught",
  caughtExecutionClaims.length === 2,
  caughtExecutionClaims.join(" ;; "),
)
check("the execution-claim fixture really contains both claim shapes", executionClaimFixture.length === 2)

// (i) A candidate that WAS registered must be detectable. Simulated against the real registry set.
checkInvertible(
  "a candidate id appearing in the registry would be detected",
  !registryIds.has("home-services-v1") && registryIds.has("salon-spa-v1"),
)
check("the registry non-vacuity anchor still exists", getBusinessBlueprint("restaurant-venue-v3") !== null)

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

report.mode = INVERT ? "INVERTED" : "NORMAL"
report.candidateCount = candidates.length
report.candidateIds = candidateIds
report.registryUntouched = {
  registryBlueprintCount: listBusinessBlueprints().length,
  candidatesInRegistry: candidateIds.filter((id) => registryIds.has(id)),
  blueprintsFileReferencesPackage: /vertical-packs/.test(blueprintsSource),
}
report.dependencyTable = dependencyTable
report.statuses = candidates.map((candidate) => ({
  id: candidate.blueprint.id,
  status: candidate.blueprint.status,
  readiness: candidate.readiness,
  registered: candidate.registered,
}))
report.maturityDiscipline = {
  partialInRequired,
  falseBacklog,
  backloggedPairs: [...backloggedPairs],
  remindersMaturity: capabilityIndex.get("appointments:reminders")?.maturity,
  depositsMaturity: capabilityIndex.get("appointments:deposits")?.maturity,
}
report.providerBoundaries = {
  notificationActions,
  disallowedActions,
  scheduleTriggers,
  executionClaims,
  ownerGatedCounts: candidates.map((candidate) => ({
    id: candidate.blueprint.id,
    unsupported: candidate.unsupported.length,
    ownerGated: candidate.ownerGated.length,
  })),
}
report.inertness = {
  forbiddenSourceHits,
  workflowPlannerConsumersOutsideModule: workflowModuleConsumers,
  planStatusesObserved: [...planStatuses],
}
report.clinicBoundaries = clinic
  ? {
      engines: clinic.blueprint.engines.map((composition) => composition.engineId),
      exclusionIds: clinic.unsupported.map((entry) => entry.id),
      intendedSurfaces: clinic.intendedSurfaces,
      unnegatedClaims: unnegatedClinicalClaims(affirmativeProse(clinic)),
    }
  : null
report.clinicalScan = {
  scannedProseCounts,
  clinicalClaimsAcrossCandidates,
}
report.negativeTests = {
  inventedCapabilityRejected: !inventedCapabilityResult.ok,
  inventedEngineRejected: !inventedEngineResult.ok,
  duplicateIdDetected: detectedDuplicates.length > 0,
  clinicalClaimsCaught: caughtClinicalClaims.length,
  negatedBoundaryAllowed: unnegatedClinicalClaims(negatedClinicalFixture).length === 0,
  activePartialRejected: !activePartialResult.ok,
  notificationCaught: caughtNotification.length === 1,
  executionClaimsCaught: caughtExecutionClaims.length,
}
// ---------------------------------------------------------------------------
// HOME-SERVICES ALIAS CONSTRAINT - executable, not prose.
//
// home-services-v1 composes the IDENTICAL engine and capability set as the ACTIVE
// field-service-v1. The candidate's own integration notes say so, and say something
// sharper: its vertical string "home-services" does not collide with the registered
// "field-service", so the one-active-blueprint-per-vertical rule "would not itself
// block registration - which is why the overlap needs stating in prose rather than
// being left to a uniqueness check that would pass."
//
// Prose does not survive a refactor. This block turns the integration decision into
// a checked invariant: WHILE the composition is identical, home-services-v1 must
// stay unregistered AND must name field-service-v1 as its fold/alias target. Anyone
// registering it as a second active blueprint on an identical composition fails the
// harness instead of discovering the duplication in production.
//
// The constraint is deliberately CONDITIONAL on the overlap. If the composition
// genuinely diverges later, the alias argument no longer applies and the implication
// is vacuously satisfied - so this cannot block legitimate differentiation.
// ---------------------------------------------------------------------------

function engineFingerprint(blueprint: BusinessBlueprint): string {
  return [...blueprint.engines]
    .map(
      (engine) =>
        `${engine.engineId}:${[...engine.capabilities].sort().join("+")}:${engine.required ? "required" : "optional"}`,
    )
    .sort()
    .join(" | ")
}

const homeServicesCandidate = getVerticalPackCandidate("home-services-v1")
const fieldServiceBlueprint = getBusinessBlueprint("field-service-v1")

check(
  "both sides of the alias constraint resolve: the home-services candidate and the active field-service blueprint",
  homeServicesCandidate !== undefined && fieldServiceBlueprint !== undefined,
  `candidate=${homeServicesCandidate !== undefined} blueprint=${fieldServiceBlueprint !== undefined}`,
)

const homeFingerprint = homeServicesCandidate ? engineFingerprint(homeServicesCandidate.blueprint) : ""
const fieldFingerprint = fieldServiceBlueprint ? engineFingerprint(fieldServiceBlueprint) : ""
const compositionIdentical = homeFingerprint !== "" && homeFingerprint === fieldFingerprint

const registeredBlueprintIds = listBusinessBlueprints().map((blueprint) => blueprint.id)
const homeServicesRegistered = registeredBlueprintIds.includes("home-services-v1")

const namesFoldTarget = (homeServicesCandidate?.integrationNotes ?? []).some(
  (note) => /field-service-v1/u.test(note) && /\b(fold|alias|terminology|overlap)\b/iu.test(note),
)

checkInvertible(
  "home-services-v1 is not a registered blueprint",
  !homeServicesRegistered,
  `registeredIds=[${registeredBlueprintIds.join(",")}]`,
)

checkInvertible(
  "WHILE home-services-v1 composes the identical engine set as field-service-v1 it stays unregistered and names field-service-v1 as its fold/alias target",
  !compositionIdentical || (!homeServicesRegistered && namesFoldTarget),
  `identical=${compositionIdentical} registered=${homeServicesRegistered} namesFoldTarget=${namesFoldTarget}`,
)

check(
  "MEASURED: the home-services/field-service overlap is still exact, so the alias constraint above is the binding one - if this fails the compositions have diverged, the alias argument no longer applies, and this pin should be updated deliberately",
  compositionIdentical,
  `home=[${homeFingerprint}] field=[${fieldFingerprint}]`,
)

report.homeServicesAliasConstraint = {
  homeFingerprint,
  fieldFingerprint,
  compositionIdentical,
  registered: homeServicesRegistered,
  namesFoldTarget,
  decision:
    "Unregistered draft candidate. Treated as a future onboarding/terminology alias or fold candidate for field-service-v1. Not registered as a second active blueprint while the engine and capability composition is identical.",
}

report.promotionEvidence = promotionEvidence
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failureCount = failures.length
report.failures = failures
report.assertionsRun = assertionsRun
report.assertionsPassed = assertionsPassed

console.log(JSON.stringify(report, null, 2))

// Machine-readable assertion evidence for scripts/gates/run-gates.js.
//
// The identity-bearing GATE-EVIDENCE line must be the WHOLE line to be read, and
// its harness id must match this file's name exactly or the driver reports
// EVIDENCE_IDENTITY_MISMATCH. Both numbers come from the counters incremented
// inside check() above, so they cannot claim more than actually ran.
//
// The driver prefers explicit identity-bearing evidence over the heuristic ratio
// form, so printing both is safe: the GATE-EVIDENCE line is authoritative and the
// ratio line stays human-readable in the log.
console.log(`GATE-EVIDENCE harness=check-vertical-pack-candidates.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

if (failures.length > 0) process.exitCode = 1
