/**
 * Vertical pack inventory.
 *
 * Four reviewed packs are registered by `../blueprints.ts`; two remain explicitly unregistered. Keeping
 * those sets separate prevents a catalog-only candidate from becoming installable by accident.
 *
 * It IS now read by two owner-facing read-only surfaces, both behind the Business OS guard: the
 * `/api/business-os/vertical-candidates` route and the dashboard Vertical Candidate Catalog page. Both
 * serialise descriptors for evaluation only - neither can register, install or activate a candidate, and
 * harnesses assert that no candidate id ever appears in `listBusinessBlueprints()`. The earlier wording
 * here said this module was "not wired into the product", which stopped being true when those surfaces
 * landed; being readable and being installable are different claims, and only the second is still false.
 *
 * Each candidate IS validated here at module load, exactly as `blueprints.ts` validates the registry, so
 * a malformed candidate fails at import rather than at review time. Validation uses the REAL
 * `validateBusinessBlueprint` against the REAL `businessEngineDescriptors`, which is what makes the
 * engine and capability references in these files claims that can be falsified rather than prose.
 */
import { assertValidBusinessBlueprint } from "../validation"
import { clinicPracticeV1 } from "./clinic-practice-v1"
import { eventsStudioV1 } from "./events-studio-v1"
import { homeServicesV1 } from "./home-services-v1"
import { realEstateBrokerageV1 } from "./real-estate-brokerage-v1"
import { recruitmentAgencyV1 } from "./recruitment-agency-v1"
import { salonSpaV1 } from "./salon-spa-v1"
import type { RegisteredVerticalPack, VerticalPackCandidate } from "./types"

export type {
  CandidateReadiness,
  DailyOpportunity,
  OnboardingConfiguration,
  OwnerGatedFunction,
  OwnerWorkflowConfiguration,
  ProviderBoundary,
  RegisteredOnboardingConfiguration,
  RegisteredReadiness,
  RegisteredVerticalPack,
  UnsupportedFunction,
  VerticalPackCandidate,
} from "./types"
export { CANDIDATE_ALLOWED_ACTION_KINDS, CANDIDATE_STATUS, REGISTERED_STATUS } from "./types"

const candidates: readonly VerticalPackCandidate[] = [
  homeServicesV1,
  clinicPracticeV1,
]

const registered: readonly RegisteredVerticalPack[] = [
  salonSpaV1,
  eventsStudioV1,
  realEstateBrokerageV1,
  recruitmentAgencyV1,
]

/**
 * The candidate set, each blueprint validated against the real contract at module load.
 *
 * Note what is NOT done here: nothing is pushed into `businessBlueprintRegistry`, and nothing is
 * exported under a name a registry consumer would pick up by mistake.
 */
export const verticalPackCandidates: readonly VerticalPackCandidate[] = candidates.map((candidate) => {
  assertValidBusinessBlueprint(candidate.blueprint)
  return candidate
})

export const registeredVerticalPacks: readonly RegisteredVerticalPack[] = registered.map((pack) => {
  assertValidBusinessBlueprint(pack.blueprint)
  return pack
})

const allPackIds = [...verticalPackCandidates, ...registeredVerticalPacks].map((pack) => pack.blueprint.id)
const duplicateCandidateIds = allPackIds
  .filter((id, index, all) => all.indexOf(id) !== index)

if (duplicateCandidateIds.length > 0) {
  // getVerticalPackCandidate resolves by find(), so a duplicate id would silently shadow - the same
  // failure mode blueprints.ts guards against for the registry.
  throw new Error(`Duplicate vertical pack candidate ids: ${[...new Set(duplicateCandidateIds)].join(", ")}`)
}

export function listVerticalPackCandidates(): readonly VerticalPackCandidate[] {
  return verticalPackCandidates
}

export function getVerticalPackCandidate(id: string): VerticalPackCandidate | null {
  return verticalPackCandidates.find((candidate) => candidate.blueprint.id === id) ?? null
}

export function listRegisteredVerticalPacks(): readonly RegisteredVerticalPack[] {
  return registeredVerticalPacks
}

export function getRegisteredVerticalPack(id: string): RegisteredVerticalPack | null {
  return registeredVerticalPacks.find((pack) => pack.blueprint.id === id) ?? null
}

export {
  clinicPracticeV1,
  eventsStudioV1,
  homeServicesV1,
  realEstateBrokerageV1,
  recruitmentAgencyV1,
  salonSpaV1,
}
