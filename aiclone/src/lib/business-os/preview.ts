/**
 * Blueprint preview resolver.
 *
 * READ-ONLY BY CONSTRUCTION. This file has no Prisma import, no database call, no `create`/`update`/
 * `delete`, no fetch and no transaction. It resolves the static registry plus the live engine
 * descriptors into an answer to "what would choosing this blueprint mean for me", and computes nothing
 * durable. A harness asserts every one of those absences textually rather than trusting this paragraph.
 *
 * WHY IT CANNOT SIMPLY ECHO THE BLUEPRINT
 *
 * `BusinessBlueprint` declares engines, capabilities, workflows, copilot prompts, a version and an
 * optional `supersedes`. It declares **no terminology, no surfaces and no dashboard modules** - that was
 * measured before this file was written, not assumed. A preview that presented a "terminology pack" as
 * the blueprint's own would be inventing it.
 *
 * Terminology and surfaces do exist in this product, but keyed on `Profile.roleTemplate`:
 * `surfacesFor(role)`, `calendarNoun(role)`, `shopNavLabel(role)`. Onboarding already records which
 * blueprint each role corresponds to, so this resolver inverts that map and resolves presentation
 * through the role - tagging it `source: "role-derived"` so a caller can never mistake it for something
 * the blueprint declared.
 *
 * `installable` is RECOMPUTED here rather than read from `blueprint.status`. A blueprint is marked
 * active when its required capabilities are available, but a capability can regress afterwards, and the
 * status field would still say active. Preview answers the question as of now.
 */
import {
    ALL_PACKS,
    calendarNoun,
    defaultFulfillment,
    fieldOn,
    shopNavLabel,
    surfacesFor,
    type FieldPack,
} from "../surfaces"
import { CORRESPONDING_BLUEPRINT } from "../onboarding-needs"

import { listBusinessBlueprints } from "./blueprints"
import { businessEngineDescriptors } from "./engines"
import type {
    BlueprintPreviewView,
    BlueprintSummaryView,
    PreviewCapability,
    PreviewEngine,
    PreviewPresentation,
    PreviewVersioning,
    PreviewWorkflow,
} from "./preview-types"
import type { BusinessBlueprint } from "./types"

/**
 * What a preview cannot tell you, carried in every response.
 *
 * These are not disclaimers for their own sake. Each one names a specific thing a reader would
 * otherwise reasonably assume, and each was true at the time this was written:
 */
const LIMITATIONS: readonly string[] = Object.freeze([
    "Installation does not exist yet. This is a preview of what choosing this blueprint would mean, not a report of anything configured - there is no durable installed-blueprint record and no route that creates one.",
    "Surfaces and terminology are not declared by any blueprint. They are resolved through the onboarding role this blueprint corresponds to, and every such value is tagged source: \"role-derived\".",
    "Surfaces are stored per PROFILE, as JSON on Profile.personalityConfig, not per workspace. A profile with several workspaces has one set of surfaces across all of them.",
    "The owner console surface (businessOs) is never granted by a role kit. It requires an explicit per-profile opt-in, so choosing a blueprint would not switch it on.",
    "Workflows here are the blueprint's declarations. Nothing in this preview schedules, triggers or runs one.",
    "Capability maturity and evidence are read from the live engine registry at preview time, so they can differ from what the blueprint assumed when it was declared.",
])

/** Inverse of CORRESPONDING_BLUEPRINT: which onboarding role points at this blueprint, if any. */
function roleForBlueprint(blueprintId: string): string | null {
    for (const [role, id] of Object.entries(CORRESPONDING_BLUEPRINT)) {
        if (id === blueprintId) return role
    }
    return null
}

function resolveCapability(
    engineId: string,
    capabilityId: string,
    required: boolean,
): PreviewCapability | null {
    const engine = businessEngineDescriptors[engineId as keyof typeof businessEngineDescriptors]
    const capability = engine?.capabilities.find((c) => c.id === capabilityId)
    if (!capability) return null
    return Object.freeze({
        id: capability.id,
        label: capability.label,
        description: capability.description,
        maturity: capability.maturity,
        evidence: capability.evidence,
        required,
        satisfied: capability.maturity === "available",
    })
}

function resolveEngines(blueprint: BusinessBlueprint): readonly PreviewEngine[] {
    return Object.freeze(
        blueprint.engines.map((composition) => {
            const engine = businessEngineDescriptors[composition.engineId]
            const capabilities = composition.capabilities
                .map((id) => resolveCapability(composition.engineId, id, composition.required))
                .filter((c): c is PreviewCapability => c !== null)
            return Object.freeze({
                engineId: composition.engineId,
                label: engine?.label ?? composition.engineId,
                description: engine?.description ?? "",
                required: composition.required,
                capabilities: Object.freeze(capabilities),
                plannedCapabilities: Object.freeze([...(composition.plannedCapabilities ?? [])]),
            })
        }),
    )
}

function resolveWorkflows(blueprint: BusinessBlueprint): readonly PreviewWorkflow[] {
    return Object.freeze(
        blueprint.workflows.map((workflow) =>
            Object.freeze({
                id: workflow.id,
                name: workflow.name,
                triggerKind: workflow.trigger.kind,
                triggerDetail: workflow.trigger.event ?? workflow.trigger.schedule ?? null,
                actionCount: workflow.actions.length,
                // Surfaced rather than counted: an approval is the one place a workflow stops and waits
                // for a person, and the reason is what that person is shown.
                approvals: Object.freeze(
                    workflow.actions
                        .filter((action) => action.approval?.required === true)
                        .map((action) =>
                            Object.freeze({
                                actionId: action.id,
                                approverRole: action.approval!.approverRole,
                                reason: action.approval!.reason,
                            }),
                        ),
                ),
            }),
        ),
    )
}

function resolveVersioning(blueprint: BusinessBlueprint, all: readonly BusinessBlueprint[]): PreviewVersioning {
    const supersededBy = all.filter((b) => b.supersedes === blueprint.id).map((b) => b.id)
    return Object.freeze({
        version: blueprint.version,
        status: blueprint.status,
        supersedes: blueprint.supersedes ?? null,
        supersededBy: Object.freeze(supersededBy),
        isSuperseded: supersededBy.length > 0,
    })
}

/**
 * Surfaces and labels the corresponding role would turn on.
 *
 * `businessOsRequiresOptIn` is always true and that is not a placeholder: src/lib/surfaces.ts excludes
 * `businessOs` from every role kit on purpose, so it is never granted by choosing a blueprint. Reporting
 * it as opt-in is the difference between a preview and an overclaim.
 */
function resolvePresentation(blueprintId: string): PreviewPresentation {
    const role = roleForBlueprint(blueprintId)
    if (role === null) {
        return Object.freeze({
            source: "role-derived" as const,
            role: null,
            surfaces: Object.freeze([]),
            fieldPacks: Object.freeze([]),
            terminology: Object.freeze({}),
            businessOsRequiresOptIn: true,
        })
    }
    const surfaces = surfacesFor(role)
    const packs = ALL_PACKS.filter((pack: FieldPack) => fieldOn(role, pack))
    return Object.freeze({
        source: "role-derived" as const,
        role,
        surfaces: Object.freeze([...surfaces]),
        fieldPacks: Object.freeze([...packs]),
        terminology: Object.freeze({
            calendar: calendarNoun(role),
            shopNav: shopNavLabel(role),
            defaultFulfillment: defaultFulfillment(role),
        }),
        businessOsRequiresOptIn: !surfaces.includes("businessOs"),
    })
}

/**
 * Why a blueprint could not be installed right now, recomputed from live maturity.
 *
 * Only REQUIRED capabilities block. An optional capability that is planned is a stated future, not an
 * obstacle - `field-service-v1` composes commerce:inventory optionally for exactly that reason.
 *
 * Exported for the harness. Every capability the live registry composes optionally happens to be
 * `available` today, so a check driven only through the real registry cannot tell "optional is
 * excluded" apart from "nothing optional is unavailable". The harness therefore calls this directly
 * with a synthetic composition over the REAL engine registry, which is the only way the rule bites.
 */
export function resolveBlockers(blueprint: BusinessBlueprint): readonly string[] {
    const blockers: string[] = []
    for (const composition of blueprint.engines) {
        const engine = businessEngineDescriptors[composition.engineId]
        if (!engine) {
            blockers.push(`${composition.engineId}: engine is not in the registry`)
            continue
        }
        if (!composition.required) continue
        for (const capabilityId of composition.capabilities) {
            const capability = engine.capabilities.find((c) => c.id === capabilityId)
            if (!capability) {
                blockers.push(`${engine.id}:${capabilityId} is not declared on the engine`)
            } else if (capability.maturity !== "available") {
                blockers.push(`${engine.id}:${capability.id} is ${capability.maturity}, not available`)
            }
        }
    }
    return Object.freeze(blockers)
}

export class BlueprintPreviewService {
    /** Every blueprint in the registry, with live installability. Deprecated ones are included and
     *  labelled rather than hidden, because an owner looking at an older vertical should learn that a
     *  newer one supersedes it instead of finding nothing. */
    list(): readonly BlueprintSummaryView[] {
        const all = listBusinessBlueprints()
        return Object.freeze(
            all.map((blueprint) => {
                const blockedBy = resolveBlockers(blueprint)
                return Object.freeze({
                    id: blueprint.id,
                    name: blueprint.name,
                    vertical: blueprint.vertical,
                    version: blueprint.version,
                    status: blueprint.status,
                    summary: blueprint.summary,
                    engineIds: Object.freeze(blueprint.engines.map((e) => e.engineId)),
                    installable: blockedBy.length === 0,
                    blockedBy,
                })
            }),
        )
    }

    /** null when no blueprint has that id. The caller turns that into a 404. */
    preview(blueprintId: string): BlueprintPreviewView | null {
        const id = blueprintId.trim()
        if (!id) return null
        const all = listBusinessBlueprints()
        const blueprint = all.find((b) => b.id === id)
        if (!blueprint) return null

        const blockedBy = resolveBlockers(blueprint)
        return Object.freeze({
            id: blueprint.id,
            name: blueprint.name,
            vertical: blueprint.vertical,
            summary: blueprint.summary,
            versioning: resolveVersioning(blueprint, all),
            engines: resolveEngines(blueprint),
            workflows: resolveWorkflows(blueprint),
            ownerCopilotPrompts: Object.freeze([...blueprint.ownerCopilotPrompts]),
            presentation: resolvePresentation(blueprint.id),
            installable: blockedBy.length === 0,
            blockedBy,
            installed: null,
            limitations: LIMITATIONS,
        })
    }
}

export { LIMITATIONS as PREVIEW_LIMITATIONS }
