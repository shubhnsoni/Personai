/**
 * Vertical pack contracts: unregistered candidates and reviewed active registrations.
 *
 * Both states are declarative compositions over the REAL engine and capability registry. Promotion
 * changes four pinned facts together: blueprint status, readiness, registration, and onboarding
 * correspondence. It never creates an engine, provider, table, or migration.
 *
 * WHAT THIS IS NOT, and each of these is load-bearing rather than decorative:
 *
 *   IT IS NOT REGISTERED. `../blueprints.ts` is untouched by this package. Nothing in the product can
 *   reach a candidate: `listBusinessBlueprints()` does not return one, `getBusinessBlueprint()` does not
 *   resolve one, and `CORRESPONDING_BLUEPRINT` in `../../onboarding-needs.ts` points no onboarding role
 *   at one. A candidate is therefore inert by CONSTRUCTION, not by convention - there is no code path
 *   that installs, previews or resolves it.
 *
 *   IT IS NOT RUNTIME. No engine, table, migration, provider or capability is added anywhere. Every
 *   `engineId` and every capability id in a candidate must already exist in the real registry, so a
 *   candidate can only ever RECOMBINE what is already built. `install-types.ts` already forbids
 *   vertical-specific config tables (`SalonConfig`, `ClinicConfig` are named in its FORBIDDEN_TABLES);
 *   this package is the shape a vertical takes when that prohibition is respected.
 *
 *   IT DOES NOT DECLARE TERMINOLOGY OR SURFACES AS FACT. `BusinessBlueprint` deliberately declares
 *   neither - `../preview.ts` measured that before it was written and resolves both through the
 *   onboarding role instead, tagging every value `source: "role-derived"`. None of these candidates
 *   corresponds to an existing role, so a candidate's `proposedTerminology` and `intendedSurfaces`
 *   resolve to NOTHING today. They are recorded as intent for a future onboarding decision, and named
 *   `proposed`/`intended` so a reader cannot mistake them for resolved configuration.
 *
 *   IT DOES NOT EXECUTE A WORKFLOW. `../workflow.ts` exposes `planWorkflowRun`, which returns a PLAN;
 *   there is no executor in this repository that consumes a blueprint workflow declaration and performs
 *   its actions. Candidate workflows are therefore configuration only.
 *
 *   IT DOES NOT CLAIM A PROVIDER. No candidate may declare a `sendNotification` action, even though the
 *   real `WorkflowActionKind` union permits one, because no messaging provider is wired anywhere in the
 *   product. Payments, reminders, maps and every external provider are recorded as `unsupported` or as
 *   `ownerGated` with an explicit inert/owner-gated boundary, never as a capability.
 */
import type { Surface } from "../../surfaces"
import type { BusinessBlueprint } from "../types"

/**
 * The only readiness value a candidate may hold. A single-member union rather than a boolean, so the
 * state is self-describing at every use site and a second state cannot be introduced by accident.
 */
export type CandidateReadiness = "candidate-not-registered"
export type RegisteredReadiness = "active-registered"

/**
 * How an external dependency behaves today.
 *
 *   `inert`       - the record exists and nothing leaves the system. Nobody is contacted, no money moves.
 *   `owner-gated` - it happens only because a human did it by hand, outside the product.
 *
 * There is deliberately no `automatic` member. Adding one would require a wired provider, and none
 * exists.
 */
export type ProviderBoundary = "inert" | "owner-gated"

/** A function this vertical does NOT provide, with the reason it is absent rather than pending. */
export type UnsupportedFunction = Readonly<{
  id: string
  label: string
  /** Why it is absent. A reason, not a roadmap entry. */
  reason: string
}>

/** A function that exists only behind a human action, with its boundary named. */
export type OwnerGatedFunction = Readonly<{
  id: string
  label: string
  /** What the owner must personally do for this to happen at all. */
  gate: string
  boundary: ProviderBoundary
}>

/**
 * Onboarding configuration a candidate WOULD need.
 *
 * `proposedRoleKey` is intentionally a plain string and NOT a `RoleTemplate` member: no such role
 * exists, and typing it as `RoleTemplate` would make an unbuilt role look installed. `correspondsToExistingRole`
 * is pinned to `false` so the harness can assert the absence rather than infer it.
 */
export type OnboardingConfiguration = Readonly<{
  proposedRoleKey: string
  correspondsToExistingRole: false
  /** Ordered questions onboarding would ask before this vertical could be configured. */
  steps: readonly string[]
  /** Decisions that must be a human's, listed so none is silently defaulted. */
  requiredOwnerDecisions: readonly string[]
}>

/** Onboarding configuration after a reviewed pack has a real RoleTemplate and registry mapping. */
export type RegisteredOnboardingConfiguration = Readonly<{
  proposedRoleKey: string
  correspondsToExistingRole: true
  steps: readonly string[]
  requiredOwnerDecisions: readonly string[]
}>

/**
 * Owner workflow configuration.
 *
 * `configuredWorkflowIds` must name workflows that exist on the candidate's own blueprint, so this
 * cannot drift into referring to a workflow nobody declared.
 */
export type OwnerWorkflowConfiguration = Readonly<{
  configuredWorkflowIds: readonly string[]
  /** Human-readable approval gates, derived from the blueprint's own required approvals. */
  approvalGates: readonly string[]
  /** States plainly that these are declarations with no executor. */
  executionNote: string
}>

/**
 * A daily operational question an owner could ask against data the composed engines already hold.
 *
 * `readsFrom` names `engineId:capabilityId` pairs that must exist in the real registry. An opportunity
 * is READ-ONLY by contract: there is no action, no write and no side effect anywhere in this type.
 */
export type DailyOpportunity = Readonly<{
  id: string
  prompt: string
  readsFrom: readonly string[]
}>

type VerticalPackMetadata = Readonly<{
  proposedTerminology: Readonly<Record<string, string>>
  /** Restates, per candidate, that terminology is not blueprint-declared in this product. */
  terminologyNote: string
  /**
   * Surfaces this vertical would want. Real `Surface` members, so a typo is a compile error rather than
   * a string nobody validates. `businessOs` must never appear: the owner console is granted only by an
   * explicit per-profile opt-in and `install-types.ts` asserts `businessOsExcluded` on every install.
   */
  intendedSurfaces: readonly Surface[]
  ownerWorkflow: OwnerWorkflowConfiguration
  dailyOpportunities: readonly DailyOpportunity[]
  unsupported: readonly UnsupportedFunction[]
  ownerGated: readonly OwnerGatedFunction[]
  /** Considerations the integration owner needs, including overlaps with existing live blueprints. */
  integrationNotes: readonly string[]
}>

/** One unregistered candidate vertical. */
export type VerticalPackCandidate = Readonly<{
  blueprint: BusinessBlueprint & Readonly<{ status: "draft" }>
  readiness: CandidateReadiness
  registered: false
  onboarding: OnboardingConfiguration
}> & VerticalPackMetadata

/** One reviewed vertical pack active in the registry and mapped from onboarding. */
export type RegisteredVerticalPack = Readonly<{
  blueprint: BusinessBlueprint & Readonly<{ status: "active" }>
  readiness: RegisteredReadiness
  registered: true
  onboarding: RegisteredOnboardingConfiguration
}> & VerticalPackMetadata

/**
 * The status every candidate must hold.
 *
 * `draft` is the most conservative member of `BusinessBlueprintStatus` for something never shipped.
 * `proposed` asserts the contract has been put forward, and `deprecated` would claim it was once live
 * and then retired - both would be false of a candidate that has never left this package.
 */
export const CANDIDATE_STATUS = "draft" as const
export const REGISTERED_STATUS = "active" as const

/** Action kinds a candidate may declare. `sendNotification` is excluded; see the file header. */
export const CANDIDATE_ALLOWED_ACTION_KINDS = Object.freeze([
  "createTask",
  "requestApproval",
  "recordAudit",
  "handoffToOwner",
] as const)
