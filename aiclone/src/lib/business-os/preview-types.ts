/**
 * The blueprint PREVIEW contract.
 *
 * This file is the contract itself rather than a document describing one, so a UI written against it
 * cannot drift from the resolver that implements it. Both import these types.
 *
 * WHAT PREVIEW IS: a resolved, read-only answer to "what would choosing this blueprint mean for me".
 * It reads the static registry and the live engine descriptors and computes nothing durable.
 *
 * WHAT PREVIEW IS NOT: an install, or a report about an install. There is no installation runtime in
 * this repository yet - no durable installed-blueprint record and no route that creates one - so every
 * response carries `installed: null` and a `limitations` list saying so. A field that would imply
 * installed state does not exist here, which is stronger than a field that is documented as always
 * null.
 *
 * THE HONESTY PROBLEM THIS CONTRACT SOLVES
 *
 * A blueprint declares engines, capabilities, workflows, copilot prompts, a version and an optional
 * `supersedes`. It declares NO terminology, NO surfaces and NO dashboard modules - that was measured,
 * not assumed. So a preview that presented a "terminology pack" as the blueprint's own would be
 * fabricating it.
 *
 * Terminology and surfaces DO exist in this product, but keyed on `Profile.roleTemplate` rather than
 * on a blueprint: `surfacesFor(role)`, `calendarNoun(role)`, `shopNavLabel(role)` in src/lib/surfaces.ts.
 * Onboarding already records which blueprint a role corresponds to. So preview resolves them through
 * that correspondence and labels every such value with `source: "role-derived"`, while values taken
 * from the blueprint itself are `source: "blueprint"`. A reader can always tell which is which.
 */
import type { BusinessBlueprintStatus, CapabilityMaturity } from "./types"

/** Where a previewed value actually came from. Rendered, never hidden. */
export type PreviewValueSource =
    /** Declared by the blueprint in the registry. */
    | "blueprint"
    /** Not declared by any blueprint; resolved through the role this blueprint corresponds to. */
    | "role-derived"

export type PreviewCapability = Readonly<{
    id: string
    label: string
    description: string
    maturity: CapabilityMaturity
    /** A repository path, or "none" when nothing implements it. */
    evidence: string
    /** Whether the blueprint REQUIRES it, as opposed to composing it optionally. */
    required: boolean
    /** True when maturity is "available". An unavailable required capability blocks activation. */
    satisfied: boolean
}>

export type PreviewEngine = Readonly<{
    engineId: string
    label: string
    description: string
    required: boolean
    capabilities: readonly PreviewCapability[]
    /** Capabilities the blueprint names in its planned backlog rather than composing. */
    plannedCapabilities: readonly string[]
}>

export type PreviewWorkflow = Readonly<{
    id: string
    name: string
    triggerKind: string
    /** The event or schedule the trigger names, when it names one. */
    triggerDetail: string | null
    actionCount: number
    /** Actions that would require a human approval, with the reason the approver is shown. */
    approvals: readonly Readonly<{ actionId: string; approverRole: string; reason: string }>[]
}>

/**
 * Surfaces and labels this blueprint's corresponding role would turn on.
 *
 * `source` is always "role-derived" here, because no blueprint declares these. `businessOs` is
 * deliberately reported separately: src/lib/surfaces.ts excludes it from every role kit and grants it
 * only by explicit per-profile opt-in, so an install that switched it on would be a silent permission
 * expansion. Preview says it is opt-in rather than implying it comes for free.
 */
export type PreviewPresentation = Readonly<{
    source: PreviewValueSource
    /** The role this blueprint corresponds to, or null when no onboarding role maps to it. */
    role: string | null
    surfaces: readonly string[]
    fieldPacks: readonly string[]
    /** Label overrides the role already produces, e.g. calendar noun and shop nav label. */
    terminology: Readonly<Record<string, string>>
    /** True when the owner console surface would NOT be granted by this alone. */
    businessOsRequiresOptIn: boolean
}>

/** The supersession chain, so an owner can see this is an upgrade rather than a new thing. */
export type PreviewVersioning = Readonly<{
    version: string
    status: BusinessBlueprintStatus
    /** The blueprint id this one replaces, when it replaces one. */
    supersedes: string | null
    /** Ids that declare THIS blueprint as the one they supersede. */
    supersededBy: readonly string[]
    /** True when a newer blueprint supersedes this one, so choosing it would be choosing the old one. */
    isSuperseded: boolean
}>

export type BlueprintSummaryView = Readonly<{
    id: string
    name: string
    vertical: string
    version: string
    status: BusinessBlueprintStatus
    summary: string
    /** Engine ids composed, for a list view that does not need the full resolution. */
    engineIds: readonly string[]
    /** False when any REQUIRED capability is not available. */
    installable: boolean
    /** Why not, when installable is false. Empty when it is true. */
    blockedBy: readonly string[]
}>

export type BlueprintPreviewView = Readonly<{
    id: string
    name: string
    vertical: string
    summary: string
    versioning: PreviewVersioning
    engines: readonly PreviewEngine[]
    workflows: readonly PreviewWorkflow[]
    ownerCopilotPrompts: readonly string[]
    presentation: PreviewPresentation
    /**
     * Whether every REQUIRED capability is available right now. Recomputed at preview time rather than
     * trusted from the blueprint's status, because a capability can regress after a blueprint is
     * declared active.
     */
    installable: boolean
    blockedBy: readonly string[]
    /**
     * Always null. Installation does not exist, so there is no installed state to report. Present as a
     * field so a caller can see the question was asked and answered rather than omitted.
     */
    installed: null
    /**
     * What this preview cannot tell you, in the response rather than in a document. A caller that
     * renders a preview without rendering these is overstating what it knows.
     */
    limitations: readonly string[]
}>
