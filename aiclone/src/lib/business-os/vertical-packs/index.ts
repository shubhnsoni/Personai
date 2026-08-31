/**
 * CANDIDATE vertical packs - the unregistered set.
 *
 * THIS MODULE IS NOT WIRED INTO THE PRODUCT. `../blueprints.ts` does not import it, so
 * `listBusinessBlueprints()` and `getBusinessBlueprint()` cannot reach a candidate, no onboarding role
 * maps to one, and neither preview nor install can resolve one. That is the point: a candidate is a
 * described recombination of engines that already exist, held where it can be reviewed without being
 * installable.
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
import type { VerticalPackCandidate } from "./types"

export type {
  CandidateReadiness,
  DailyOpportunity,
  OnboardingConfiguration,
  OwnerGatedFunction,
  OwnerWorkflowConfiguration,
  ProviderBoundary,
  UnsupportedFunction,
  VerticalPackCandidate,
} from "./types"
export { CANDIDATE_ALLOWED_ACTION_KINDS, CANDIDATE_STATUS } from "./types"

const candidates: readonly VerticalPackCandidate[] = [
  salonSpaV1,
  eventsStudioV1,
  realEstateBrokerageV1,
  homeServicesV1,
  recruitmentAgencyV1,
  clinicPracticeV1,
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

const duplicateCandidateIds = verticalPackCandidates
  .map((candidate) => candidate.blueprint.id)
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

export {
  clinicPracticeV1,
  eventsStudioV1,
  homeServicesV1,
  realEstateBrokerageV1,
  recruitmentAgencyV1,
  salonSpaV1,
}
