import { businessEngineDescriptors, getBusinessBlueprint } from "@/lib/business-os"
import type {
    BusinessBlueprint,
    BusinessBlueprintStatus,
    BusinessEngineId,
    CapabilityMaturity,
    WorkflowActionKind,
    WorkflowTriggerKind,
} from "@/lib/business-os/types"
import type { CandidateReadiness, ProviderBoundary, VerticalPackCandidate } from "@/lib/business-os/vertical-packs"
import type { Surface } from "@/lib/surfaces"

/**
 * READ-ONLY view projection for the UNREGISTERED vertical pack CANDIDATES.
 *
 * WHAT THIS MODULE IS: the only translation between a `VerticalPackCandidate` descriptor and what
 * `/api/business-os/vertical-candidates` returns. It reads. It composes nothing, installs nothing,
 * registers nothing, and writes nothing - there is no exported function here that takes anything other
 * than a descriptor the caller already holds.
 *
 * WHY THE TRUTH FLAGS ARE STRUCTURAL RATHER THAN PROSE. A candidate is one careless sentence away from
 * reading as a shipped feature. So `registered`, `installed` and `active` are carried as PINNED LITERAL
 * `false` types: a future edit that tries to serialize one of them as `true` is a compile error, not a
 * lie that ships. The three human labels ("Candidate", "Not installed", "Not active") are exported
 * constants for the same reason - a consumer cannot invent a friendlier word for the same state without
 * that being a visible change to this file.
 *
 * WHAT IS NEVER FABRICATED. Every string that describes a vertical comes VERBATIM from the descriptor.
 * No customer, appointment, order, revenue figure, count-of-anything-operational or sample record is
 * produced here, because the descriptors hold none and inventing one would make an unregistered draft
 * look like a running business. The only strings authored in this file are the four notices below, and
 * each of them is a statement about THIS SURFACE, not about a vertical.
 *
 * CAPABILITY MATURITY IS READ FROM THE REAL REGISTRY, never from the candidate. A candidate that names
 * `appointments:reminders` cannot advertise it as available by declaring it so: the maturity here is
 * whatever `businessEngineDescriptors` actually says, and `plannedCapabilities` are projected into a
 * separate `backloggedCapabilities` list with `available: false`. That is what keeps messages, deposits,
 * payments and every external provider represented as unavailable or owner-gated rather than as a
 * feature - together with `unsupported` and `ownerGated`, which are passed through untouched.
 */

/** The status word for every candidate. Never "Draft feature", never "Coming soon", never a version. */
export const CANDIDATE_STATUS_LABEL = "Candidate" as const
/** Registration state, in words. */
export const CANDIDATE_REGISTRATION_LABEL = "Not installed" as const
/** Activation state, in words. */
export const CANDIDATE_ACTIVATION_LABEL = "Not active" as const

/**
 * What this API is. Authored here rather than in the route so the claim travels with the payload that
 * has to honour it.
 */
export const CANDIDATE_SURFACE_NOTICE =
    "Read-only. These are unregistered candidate vertical packs. Nothing on this surface can be installed, " +
    "registered, previewed or activated: the route exports no state-changing verb, listBusinessBlueprints() " +
    "returns none of these ids, and no onboarding role resolves one."

const CANDIDATE_TRUTH_NOTE =
    "Candidate only. Not registered, not installed, not active, and not installable through this API."

const INTENDED_SURFACES_NOTE =
    "Intent only, not resolved configuration. No onboarding role points at this candidate, so none of these " +
    "surfaces is granted to anybody today."

const WORKFLOW_EXECUTION_NOTE =
    "Declared configuration. No consumer in this repository executes a blueprint workflow declaration, so " +
    "nothing here runs on its own."

// ---------------------------------------------------------------------------
// Capabilities and engines
// ---------------------------------------------------------------------------

export type VerticalCandidateCapabilityView = Readonly<{
    id: string
    /** From the real engine registry. Falls back to the raw id when the registry does not know it. */
    label: string
    description: string | null
    /** From the real engine registry. `null` when the registry does not know this capability at all. */
    maturity: CapabilityMaturity | null
    /** True ONLY for a registry maturity of exactly "available". Unknown or partial is never available. */
    available: boolean
    /** False for a capability the registry does not carry, so an unresolvable reference cannot read as real. */
    registryKnown: boolean
    /** True when the candidate composes it; false when it is only backlogged. */
    composed: boolean
}>

export type VerticalCandidateEngineView = Readonly<{
    engineId: BusinessEngineId
    engineLabel: string
    required: boolean
    /** The required/optional flag in words, so a consumer cannot render a boolean as the wrong one. */
    requirement: "required" | "optional"
    capabilities: readonly VerticalCandidateCapabilityView[]
    /** `plannedCapabilities`: named, and explicitly NOT part of the composition. */
    backloggedCapabilities: readonly VerticalCandidateCapabilityView[]
}>

function capabilityView(
    engineId: BusinessEngineId,
    capabilityId: string,
    composed: boolean,
): VerticalCandidateCapabilityView {
    const descriptor = businessEngineDescriptors[engineId]
    const capability = descriptor?.capabilities.find((entry) => entry.id === capabilityId)

    return Object.freeze({
        id: capabilityId,
        label: capability?.label ?? capabilityId,
        description: capability?.description ?? null,
        maturity: capability?.maturity ?? null,
        available: capability?.maturity === "available",
        registryKnown: capability !== undefined,
        composed,
    })
}

function engineViews(blueprint: BusinessBlueprint): readonly VerticalCandidateEngineView[] {
    return Object.freeze(
        blueprint.engines.map((composition) =>
            Object.freeze({
                engineId: composition.engineId,
                engineLabel: businessEngineDescriptors[composition.engineId]?.label ?? composition.engineId,
                required: composition.required,
                requirement: composition.required ? ("required" as const) : ("optional" as const),
                capabilities: Object.freeze(
                    composition.capabilities.map((id) => capabilityView(composition.engineId, id, true)),
                ),
                backloggedCapabilities: Object.freeze(
                    (composition.plannedCapabilities ?? []).map((id) => capabilityView(composition.engineId, id, false)),
                ),
            }),
        ),
    )
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export type VerticalCandidateWorkflowActionView = Readonly<{
    id: string
    kind: WorkflowActionKind
    label: string
    approvalRequired: boolean
    approverRole: string | null
    approvalReason: string | null
    auditSubject: string | null
}>

export type VerticalCandidateWorkflowView = Readonly<{
    id: string
    name: string
    triggerKind: WorkflowTriggerKind
    triggerEvent: string | null
    /** Pinned: there is no executor for a blueprint workflow declaration in this repository. */
    executed: false
    actions: readonly VerticalCandidateWorkflowActionView[]
}>

function workflowViews(blueprint: BusinessBlueprint): readonly VerticalCandidateWorkflowView[] {
    return Object.freeze(
        blueprint.workflows.map((workflow) =>
            Object.freeze({
                id: workflow.id,
                name: workflow.name,
                triggerKind: workflow.trigger.kind,
                triggerEvent: workflow.trigger.event ?? null,
                executed: false as const,
                actions: Object.freeze(
                    workflow.actions.map((action) =>
                        Object.freeze({
                            id: action.id,
                            kind: action.kind,
                            label: action.label,
                            approvalRequired: action.approval?.required === true,
                            approverRole: action.approval?.approverRole ?? null,
                            approvalReason: action.approval?.reason ?? null,
                            auditSubject: action.auditSubject ?? null,
                        }),
                    ),
                ),
            }),
        ),
    )
}

// ---------------------------------------------------------------------------
// Boundaries - a first-class field, never a note
// ---------------------------------------------------------------------------

export type VerticalCandidateBoundaryStatement = Readonly<{
    source: "summary" | "unsupported" | "onboarding-step" | "owner-decision"
    /** The descriptor id the statement came from, when it has one. */
    id: string | null
    /** VERBATIM descriptor text. Nothing is paraphrased into a boundary. */
    text: string
}>

export type VerticalCandidateBoundary = Readonly<{
    id: string
    domain: string
    label: string
    statements: readonly VerticalCandidateBoundaryStatement[]
}>

/**
 * Boundary domains this serializer can recognise.
 *
 * A boundary is EMITTED ONLY WHEN THE DESCRIPTOR ACTUALLY STATES IT. The label is not attached because
 * of a candidate's id or vertical string - it is attached because the descriptor holds statements that
 * deny the domain. So if clinic-practice-v1's denials were ever weakened or deleted, the boundary field
 * empties instead of continuing to assert a safety property nobody declares any more.
 *
 * `terms` deliberately does NOT include bare "treatment": salon-spa-v1 uses that word affirmatively for
 * a bookable service ("service: treatment"), and a detector that fired on it would attach a clinical
 * boundary to a salon. Measured against all six descriptors, `terms` matches clinic-practice-v1 only.
 */
const BOUNDARY_DOMAINS: readonly Readonly<{ id: string; domain: string; label: string; terms: RegExp }>[] =
    Object.freeze([
        Object.freeze({
            id: "non-clinical-administration-only",
            domain: "clinical",
            label: "Non-clinical administration only",
            terms:
                /\b(clinical|clinician|diagnos\w*|prescri(?:be|bes|bed|bing|ption|ptions)|medical\s+record\w*|medication\w*|symptom\w*|health\s+information|protected\s+health\s+information|phi|triage|inpatient|hospital|emergency|urgent\s+care|treatment\s+(?:advice|plan|guidance|recommendation)\w*)\b/iu,
        }),
    ])

/**
 * The negation vocabulary, restated from the shape check-vertical-pack-candidates.ts already uses. A
 * statement counts as a BOUNDARY only when the denial sits in the SAME CLAUSE as the domain term -
 * otherwise "no reminder is delivered. Consultations are booked" would read as a clinical denial.
 */
const NEGATORS =
    /\b(no|not|never|none|nothing|neither|nor|outside|excluded|exclude|without|cannot|must\s+not|does\s+not|do\s+not|holds\s+no|has\s+no|makes\s+no|keeps\s+no|stores\s+no|is\s+not|are\s+not)\b/iu

function clauses(text: string): string[] {
    return text
        .split(/[.;:,]/u)
        .map((clause) => clause.trim())
        .filter((clause) => clause.length > 0)
}

function deniesDomain(text: string, terms: RegExp): boolean {
    return clauses(text).some((clause) => terms.test(clause) && NEGATORS.test(clause))
}

function boundaryViews(candidate: VerticalPackCandidate): readonly VerticalCandidateBoundary[] {
    const boundaries: VerticalCandidateBoundary[] = []

    for (const domain of BOUNDARY_DOMAINS) {
        const statements: VerticalCandidateBoundaryStatement[] = []

        // `unsupported` is an absence statement BY CONTRACT - the type says so - so the domain term alone
        // qualifies it. Nothing else here is trusted without a negator.
        for (const unsupported of candidate.unsupported) {
            if (domain.terms.test(unsupported.label) || domain.terms.test(unsupported.reason)) {
                statements.push(
                    Object.freeze({
                        source: "unsupported" as const,
                        id: unsupported.id,
                        text: `${unsupported.label}: ${unsupported.reason}`,
                    }),
                )
            }
        }

        if (deniesDomain(candidate.blueprint.summary, domain.terms)) {
            statements.push(Object.freeze({ source: "summary" as const, id: null, text: candidate.blueprint.summary }))
        }
        for (const step of candidate.onboarding.steps) {
            if (deniesDomain(step, domain.terms)) {
                statements.push(Object.freeze({ source: "onboarding-step" as const, id: null, text: step }))
            }
        }
        for (const decision of candidate.onboarding.requiredOwnerDecisions) {
            if (deniesDomain(decision, domain.terms)) {
                statements.push(Object.freeze({ source: "owner-decision" as const, id: null, text: decision }))
            }
        }

        if (statements.length > 0) {
            boundaries.push(
                Object.freeze({
                    id: domain.id,
                    domain: domain.domain,
                    label: domain.label,
                    statements: Object.freeze(statements),
                }),
            )
        }
    }

    return Object.freeze(boundaries)
}

// ---------------------------------------------------------------------------
// Alias / fold marker
// ---------------------------------------------------------------------------

/**
 * Declared alias relationships: candidate id -> the ACTIVE blueprint it would fold into.
 *
 * home-services-v1's own `integrationNotes` state that it composes the identical engine and capability
 * set as the registered field-service-v1 and that folding it in is one of the defensible options. This
 * table is that claim in a form the serializer can check rather than repeat.
 */
export const CANDIDATE_ALIAS_TARGETS: Readonly<Record<string, string>> = Object.freeze({
    "home-services-v1": "field-service-v1",
})

export type VerticalCandidateAliasMarker = Readonly<{
    aliasOfBlueprintId: string
    aliasOfBlueprintName: string
    aliasOfBlueprintStatus: BusinessBlueprintStatus
    relationship: "fold-or-terminology-alias-candidate"
    label: string
    engineFingerprint: string
    aliasTargetFingerprint: string
    /** Pinned literal: this marker is only constructible on the branch where the two fingerprints are equal. */
    fingerprintsMatch: true
    note: string
}>

/**
 * The engine fingerprint, computed the SAME way check-vertical-pack-candidates.ts computes it:
 * `engineId + sorted capabilities + required`, per composition, then the compositions sorted.
 *
 * Sorting on both axes is what makes it a fingerprint of the COMPOSITION rather than of the declaration
 * order, so re-ordering an engine list cannot make two identical compositions look different.
 */
export function engineCompositionFingerprint(blueprint: BusinessBlueprint): string {
    return [...blueprint.engines]
        .map(
            (engine) =>
                `${engine.engineId}:${[...engine.capabilities].sort().join("+")}:${engine.required ? "required" : "optional"}`,
        )
        .sort()
        .join(" | ")
}

/**
 * The alias marker, emitted CONDITIONALLY.
 *
 * Three things must hold: the candidate has a declared alias target, that target resolves as a real
 * blueprint through the registry, and the two engine fingerprints are equal. If the compositions ever
 * genuinely diverge, this returns `null` - the marker DROPS instead of asserting an equivalence that
 * has stopped being true. An unconditional marker would be the defect, not the feature.
 */
function aliasMarker(candidate: VerticalPackCandidate): VerticalCandidateAliasMarker | null {
    const targetId = CANDIDATE_ALIAS_TARGETS[candidate.blueprint.id]
    if (targetId === undefined) return null

    const target = getBusinessBlueprint(targetId)
    if (!target) return null

    const candidateFingerprint = engineCompositionFingerprint(candidate.blueprint)
    const targetFingerprint = engineCompositionFingerprint(target)
    if (candidateFingerprint !== targetFingerprint) return null

    return Object.freeze({
        aliasOfBlueprintId: target.id,
        aliasOfBlueprintName: target.name,
        aliasOfBlueprintStatus: target.status,
        relationship: "fold-or-terminology-alias-candidate" as const,
        label: `Alias/fold candidate for ${target.id}`,
        engineFingerprint: candidateFingerprint,
        aliasTargetFingerprint: targetFingerprint,
        fingerprintsMatch: true as const,
        note:
            `This candidate composes the identical engine and capability set as ${target.id}, which IS registered. ` +
            "The marker is emitted only while those fingerprints match, and drops if they diverge. " +
            "It records an open integration decision; it does not register, install or activate anything.",
    })
}

// ---------------------------------------------------------------------------
// Truth flags
// ---------------------------------------------------------------------------

export type VerticalCandidateTruth = Readonly<{
    /** Pinned literals. Serializing any of these as `true` is a compile error. */
    registered: false
    installed: false
    active: false
    installableThroughThisApi: false
    correspondsToExistingRole: false
    readiness: CandidateReadiness
    status: BusinessBlueprintStatus
    /**
     * The three human labels. Typed `string` rather than `typeof CANDIDATE_*_LABEL` ON PURPOSE: pinning
     * them to the constants' literal types would make the type mirror whatever the constant happens to
     * say, so flipping "Not installed" to "Installed" would keep compiling here AND silently retype every
     * assertion that reads it. As plain strings the VALUES are asserted at runtime by
     * check-vertical-candidate-routes.ts, which is where a lie about installation state has to be caught.
     */
    statusLabel: string
    registrationLabel: string
    activationLabel: string
    note: string
}>

export type VerticalCandidateProviderGate = Readonly<{
    id: string
    label: string
    gate: string
    boundary: ProviderBoundary
    /** Pinned: an owner-gated function is never available in the product. */
    available: false
}>

export type VerticalCandidateUnsupported = Readonly<{
    id: string
    label: string
    reason: string
    /** Pinned: an unsupported function is never available. */
    available: false
}>

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export type VerticalCandidateView = Readonly<{
    id: string
    version: string
    name: string
    vertical: string
    status: BusinessBlueprintStatus
    summary: string
    /** Top-level duplicate of `truth.registered`, pinned, so the flag cannot be missed by a shallow read. */
    registered: false
    truth: VerticalCandidateTruth
    /** The FIRST-CLASS boundary field. Non-empty for clinic-practice-v1; never buried in notes. */
    boundaries: readonly VerticalCandidateBoundary[]
    /** The headline boundary label, so a consumer rendering one line still renders the boundary. */
    primaryBoundary: string | null
    aliasMarker: VerticalCandidateAliasMarker | null
    proposedTerminology: Readonly<{
        terminology: Readonly<Record<string, string>>
        resolved: false
        note: string
    }>
    intendedSurfaces: Readonly<{
        surfaces: readonly Surface[]
        resolved: false
        note: string
    }>
    engines: readonly VerticalCandidateEngineView[]
    engineFingerprint: string
    readiness: CandidateReadiness
    workflows: Readonly<{
        definitions: readonly VerticalCandidateWorkflowView[]
        configuredWorkflowIds: readonly string[]
        approvalGates: readonly string[]
        executed: false
        executionNote: string
        declaredExecutionNote: string
    }>
    onboarding: Readonly<{
        proposedRoleKey: string
        correspondsToExistingRole: false
        steps: readonly string[]
        requiredOwnerDecisions: readonly string[]
    }>
    dailyOpportunities: readonly Readonly<{
        id: string
        prompt: string
        readsFrom: readonly string[]
        /** Pinned: a daily opportunity is a read-only question, never an action. */
        readOnly: true
    }>[]
    unsupported: readonly VerticalCandidateUnsupported[]
    ownerGated: readonly VerticalCandidateProviderGate[]
    integrationNotes: readonly string[]
}>

/** Projects ONE candidate descriptor into the read-only API view. */
export function toVerticalCandidateView(candidate: VerticalPackCandidate): VerticalCandidateView {
    const boundaries = boundaryViews(candidate)

    return Object.freeze({
        id: candidate.blueprint.id,
        version: candidate.blueprint.version,
        name: candidate.blueprint.name,
        vertical: candidate.blueprint.vertical,
        status: candidate.blueprint.status,
        summary: candidate.blueprint.summary,
        registered: false as const,
        truth: Object.freeze({
            registered: false as const,
            installed: false as const,
            active: false as const,
            installableThroughThisApi: false as const,
            correspondsToExistingRole: false as const,
            readiness: candidate.readiness,
            status: candidate.blueprint.status,
            statusLabel: CANDIDATE_STATUS_LABEL,
            registrationLabel: CANDIDATE_REGISTRATION_LABEL,
            activationLabel: CANDIDATE_ACTIVATION_LABEL,
            note: CANDIDATE_TRUTH_NOTE,
        }),
        boundaries,
        primaryBoundary: boundaries[0]?.label ?? null,
        aliasMarker: aliasMarker(candidate),
        proposedTerminology: Object.freeze({
            terminology: candidate.proposedTerminology,
            resolved: false as const,
            note: candidate.terminologyNote,
        }),
        intendedSurfaces: Object.freeze({
            surfaces: candidate.intendedSurfaces,
            resolved: false as const,
            note: INTENDED_SURFACES_NOTE,
        }),
        engines: engineViews(candidate.blueprint),
        engineFingerprint: engineCompositionFingerprint(candidate.blueprint),
        readiness: candidate.readiness,
        workflows: Object.freeze({
            definitions: workflowViews(candidate.blueprint),
            configuredWorkflowIds: candidate.ownerWorkflow.configuredWorkflowIds,
            approvalGates: candidate.ownerWorkflow.approvalGates,
            executed: false as const,
            executionNote: WORKFLOW_EXECUTION_NOTE,
            declaredExecutionNote: candidate.ownerWorkflow.executionNote,
        }),
        onboarding: Object.freeze({
            proposedRoleKey: candidate.onboarding.proposedRoleKey,
            correspondsToExistingRole: false as const,
            steps: candidate.onboarding.steps,
            requiredOwnerDecisions: candidate.onboarding.requiredOwnerDecisions,
        }),
        dailyOpportunities: Object.freeze(
            candidate.dailyOpportunities.map((opportunity) =>
                Object.freeze({
                    id: opportunity.id,
                    prompt: opportunity.prompt,
                    readsFrom: opportunity.readsFrom,
                    readOnly: true as const,
                }),
            ),
        ),
        unsupported: Object.freeze(
            candidate.unsupported.map((entry) =>
                Object.freeze({
                    id: entry.id,
                    label: entry.label,
                    reason: entry.reason,
                    available: false as const,
                }),
            ),
        ),
        ownerGated: Object.freeze(
            candidate.ownerGated.map((entry) =>
                Object.freeze({
                    id: entry.id,
                    label: entry.label,
                    gate: entry.gate,
                    boundary: entry.boundary,
                    available: false as const,
                }),
            ),
        ),
        integrationNotes: candidate.integrationNotes,
    })
}

/** Projects the candidate set. Order is the descriptor order; nothing is sorted, filtered or invented. */
export function toVerticalCandidateViews(
    candidates: readonly VerticalPackCandidate[],
): readonly VerticalCandidateView[] {
    return Object.freeze(candidates.map(toVerticalCandidateView))
}
