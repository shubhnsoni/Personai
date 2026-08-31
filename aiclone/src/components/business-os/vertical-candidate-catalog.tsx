import type { ReactNode } from "react"
import {
    AlertTriangle,
    Ban,
    CircleSlash,
    FileWarning,
    Layers,
    Lock,
    ShieldAlert,
    Workflow as WorkflowIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { businessEngineDescriptors } from "@/lib/business-os/engines"
import type {
    BlueprintEngineComposition,
    BusinessBlueprint,
    EngineCapability,
} from "@/lib/business-os/types"
import type { OwnerGatedFunction, VerticalPackCandidate } from "@/lib/business-os/vertical-packs"

/**
 * VERTICAL CANDIDATE CATALOG - a READ-ONLY evaluation surface for the six UNREGISTERED
 * vertical pack candidates.
 *
 * WHAT THIS COMPONENT IS ALLOWED TO DO: describe a candidate. That is all.
 *
 * WHAT IT DELIBERATELY CANNOT DO, and how that is guaranteed rather than promised:
 *
 *   IT IS A SERVER COMPONENT. There is no "use client" directive, no hook, no event handler and
 *   no state. It therefore ships no JavaScript to the browser, which is the strongest available
 *   form of "this cannot mutate anything": there is no client bundle in which a mutation could
 *   later be added by accident.
 *
 *   IT RENDERS NO INTERACTIVE ELEMENT AT ALL. No <button>, <form>, <input>, <select> or <a>.
 *   `check-vertical-candidate-catalog.ts` counts them in the rendered markup and requires the
 *   count to be zero, so an install/activate affordance cannot be introduced silently. Nothing
 *   here can make a candidate registered or installable - this surface has no write path to
 *   `blueprints.ts`, to onboarding activation, or to install choices, and adds none.
 *
 *   IT INVENTS NO DATA. Every string rendered for a candidate comes from that candidate's own
 *   descriptor in `@/lib/business-os/vertical-packs`, or from the real engine registry in
 *   `@/lib/business-os/engines`. There is no count of clients, bookings, revenue or usage
 *   anywhere, because no such figure exists for something that has never been installed. Where a
 *   descriptor field is empty, an explicit "nothing is declared" line is rendered instead of a
 *   plausible-looking number.
 *
 *   IT READS THE DESCRIPTORS DIRECTLY. It takes them as props from the server page, which reads
 *   `listVerticalPackCandidates()`. There is no internal HTTP hop and no dependency on any
 *   candidate API route.
 *
 * THE ALIAS MARKER IS COMPUTED, NOT ASSERTED. `home-services-v1` is shown as an alias/fold
 * candidate for the ACTIVE `field-service-v1` only while their engine fingerprints are identical;
 * the fingerprint is computed from the real registry passed in as `registeredBlueprints`. If either
 * side diverges later, the marker DROPS and a divergence note takes its place, so the page cannot
 * keep claiming a relationship that has stopped being true.
 */

/** The five states this surface can be in. `empty` is `ready` with no candidates - see the render. */
export type VerticalCandidateCatalogState =
    | Readonly<{ kind: "loading" }>
    | Readonly<{ kind: "unauthorized" }>
    | Readonly<{ kind: "forbidden" }>
    | Readonly<{ kind: "dependency-error"; detail?: string }>
    | Readonly<{
          kind: "ready"
          candidates: readonly VerticalPackCandidate[]
          /** The REAL registry, so registration and the alias fingerprint are checked, not assumed. */
          registeredBlueprints: readonly BusinessBlueprint[]
      }>

/**
 * How an external dependency reads on this page. A closed two-member union with no `available`
 * member, so no rendering path can describe messaging, deposits, payments or an external provider
 * as available - that would require adding a member here and would be a compile-time decision
 * somebody has to make deliberately.
 */
type DependencyStatus = "unavailable" | "owner-gated"

type DependencyRow = Readonly<{
    id: string
    label: string
    status: DependencyStatus
    detail: string
}>

/**
 * Candidates that are declared as an alias/fold of an EXISTING blueprint rather than as a
 * distinct vertical. The value is the registered blueprint id the claim is checked against.
 */
const ALIAS_OF: Readonly<Record<string, string>> = {
    "home-services-v1": "field-service-v1",
}

/**
 * The four external dependencies an owner evaluating a vertical will assume work, and which do
 * not. Each is matched against the candidate's OWN `unsupported` and `ownerGated` entries, so the
 * status shown is derived from the descriptor rather than typed in here.
 */
const DEPENDENCY_KINDS: readonly Readonly<{ id: string; label: string; match: RegExp }>[] = [
    {
        id: "messages",
        label: "Messages, reminders and notifications",
        match: /messag|notif|remind|contact|told|telling|inform|sms|email|whatsapp/i,
    },
    {
        id: "deposits",
        label: "Deposits and prepayment",
        match: /deposit|prepay|up front|upfront/i,
    },
    {
        id: "payments",
        label: "Payments, invoicing and money movement",
        match: /payment|invoic|money|\bfee\b|billing|charge|refund|payout|commission|payroll/i,
    },
    {
        id: "providers",
        label: "External providers and integrations",
        match: /provider|integration|\bmap\b|carrier|gateway|portal|listing service|aggregator|external/i,
    },
]

/**
 * Unsupported entries that state a CLINICAL exclusion. Matched on the descriptor's own words so
 * the boundary callout appears because the candidate says so, not because this file hardcodes
 * which candidate is the clinical one. If clinic-practice-v1 ever dropped these exclusions the
 * callout would disappear rather than misreport them.
 */
const CLINICAL_BOUNDARY_MATCH =
    /diagnos|prescri|clinical|medical record|protected health information|health information|triage|emergency|treatment advice/i

/**
 * Engine fingerprint: engineId + sorted capabilities + required, per engine, sorted across engines.
 *
 * Sorted on both axes so declaration ORDER cannot make two identical compositions look different.
 * Exported because the verification harness compares with the same function - a harness computing
 * its own fingerprint would be checking its own arithmetic rather than the component's.
 */
export function engineCompositionFingerprint(engines: readonly BlueprintEngineComposition[]): string {
    return engines
        .map(
            (engine) =>
                `${engine.engineId}:${[...engine.capabilities].sort().join("+")}:${engine.required ? "required" : "optional"}`,
        )
        .sort()
        .join(" | ")
}

type AliasVerdict = Readonly<{
    baseId: string
    matches: boolean
    candidateFingerprint: string
    baseFingerprint: string | null
}>

/**
 * Resolves the alias claim against the real registry. Returns null when the candidate makes no
 * alias claim at all, so a non-alias candidate renders no marker and no divergence note.
 */
export function resolveAliasVerdict(
    candidate: VerticalPackCandidate,
    registeredBlueprints: readonly BusinessBlueprint[],
): AliasVerdict | null {
    const baseId = ALIAS_OF[candidate.blueprint.id]
    if (!baseId) return null

    // Only an ACTIVE blueprint can be the thing this folds into. A deprecated or draft base would
    // not be "the active field-service-v1" the claim names.
    const base = registeredBlueprints.find((blueprint) => blueprint.id === baseId && blueprint.status === "active") ?? null
    const candidateFingerprint = engineCompositionFingerprint(candidate.blueprint.engines)
    const baseFingerprint = base ? engineCompositionFingerprint(base.engines) : null

    return {
        baseId,
        matches: baseFingerprint !== null && baseFingerprint === candidateFingerprint,
        candidateFingerprint,
        baseFingerprint,
    }
}

/** Derives the four dependency rows for one candidate from its own declared entries. */
export function dependencyRows(candidate: VerticalPackCandidate): readonly DependencyRow[] {
    return DEPENDENCY_KINDS.map((kind) => {
        const gated: readonly OwnerGatedFunction[] = candidate.ownerGated.filter(
            (entry) => kind.match.test(entry.label) || kind.match.test(entry.gate),
        )
        const unsupported = candidate.unsupported.filter(
            (entry) => kind.match.test(entry.label) || kind.match.test(entry.reason),
        )

        // A human action outside the product is the ONLY way any of these happens. `inert` means the
        // record exists and nothing leaves the system, which for the owner reads as unavailable.
        const ownerGatedEntry = gated.find((entry) => entry.boundary === "owner-gated")
        if (ownerGatedEntry) {
            return {
                id: kind.id,
                label: kind.label,
                status: "owner-gated" as const,
                detail: `Only because a person did it by hand, outside the product: ${ownerGatedEntry.gate}`,
            }
        }
        if (gated.length > 0) {
            return {
                id: kind.id,
                label: kind.label,
                status: "unavailable" as const,
                detail: `The record exists and nothing leaves the system: ${gated[0].gate}`,
            }
        }
        if (unsupported.length > 0) {
            return {
                id: kind.id,
                label: kind.label,
                status: "unavailable" as const,
                detail: unsupported[0].reason,
            }
        }
        // Default deny. Nothing in this candidate declares it, and no provider is wired anywhere in
        // the product, so the honest reading is that it does not happen - never that it is available.
        return {
            id: kind.id,
            label: kind.label,
            status: "unavailable" as const,
            detail: "This candidate declares nothing for it and no provider is wired anywhere in the product.",
        }
    })
}

function dependencyStatusLabel(status: DependencyStatus): string {
    return status === "owner-gated" ? "Owner-gated" : "Unavailable"
}

function capabilityOf(engineId: BlueprintEngineComposition["engineId"], capabilityId: string): EngineCapability | null {
    return businessEngineDescriptors[engineId].capabilities.find((capability) => capability.id === capabilityId) ?? null
}

/** Slug-safe id for aria-labelledby / aria-describedby wiring. */
function domId(...parts: readonly string[]): string {
    return parts.join("-").replace(/[^a-zA-Z0-9-]/g, "-")
}

function HonestlyEmpty({ children }: { children: string }) {
    return <p className="text-xs text-muted-foreground italic">{children}</p>
}

function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <h4 id={id} className="text-sm font-semibold tracking-tight">
            {children}
        </h4>
    )
}

/**
 * The honesty banner, repeated on EVERY candidate rather than only in the page header. A reader who
 * lands mid-page, or who only ever sees one card, must still be told what they are looking at.
 */
function TruthLabels({ candidateId }: { candidateId: string }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5" data-truth-labels={candidateId}>
            <Badge variant="outline" className="border-dashed">
                Candidate
            </Badge>
            <Badge variant="secondary">Not installed</Badge>
            <Badge variant="secondary">Not active</Badge>
        </div>
    )
}

function CandidateCard({
    candidate,
    registeredBlueprints,
}: {
    candidate: VerticalPackCandidate
    registeredBlueprints: readonly BusinessBlueprint[]
}) {
    const { blueprint } = candidate
    const headingId = domId("candidate", blueprint.id, "heading")
    const alias = resolveAliasVerdict(candidate, registeredBlueprints)
    const dependencies = dependencyRows(candidate)
    const clinicalExclusions = candidate.unsupported.filter(
        (entry) => CLINICAL_BOUNDARY_MATCH.test(entry.label) || CLINICAL_BOUNDARY_MATCH.test(entry.reason),
    )
    // Cross-checked against the REAL registry rather than trusting the pinned literal alone.
    const registryConflict = registeredBlueprints.some((registered) => registered.id === blueprint.id)
    const terminologyEntries = Object.entries(candidate.proposedTerminology)

    return (
        <article
            aria-labelledby={headingId}
            data-candidate-id={blueprint.id}
            className="rounded-2xl border border-border/70 bg-muted/10 p-4 space-y-4"
        >
            <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                        <h3 id={headingId} className="text-base font-semibold tracking-tight">
                            {blueprint.name}
                        </h3>
                        <p className="font-mono text-xs text-muted-foreground">
                            {blueprint.id} · v{blueprint.version} · vertical {blueprint.vertical}
                        </p>
                    </div>
                    <TruthLabels candidateId={blueprint.id} />
                </div>
                <p className="text-sm text-muted-foreground">{blueprint.summary}</p>
            </div>

            {clinicalExclusions.length > 0 ? (
                <section
                    aria-labelledby={domId("candidate", blueprint.id, "clinical")}
                    className="rounded-xl border-2 border-destructive/60 bg-destructive/5 p-3 space-y-2"
                    data-clinical-boundary={blueprint.id}
                >
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                        <SectionHeading id={domId("candidate", blueprint.id, "clinical")}>
                            Non-clinical boundary: administration only
                        </SectionHeading>
                    </div>
                    <p className="text-sm">
                        This candidate is front-desk administration and nothing beyond it. It holds no health
                        information, keeps no record of what happened in an appointment, and has no role in urgent or
                        emergency care. Each exclusion below is stated by the candidate itself, as a boundary rather
                        than a roadmap.
                    </p>
                    <ul className="space-y-1 text-sm">
                        {clinicalExclusions.map((entry) => (
                            <li key={entry.id}>
                                <span className="font-medium">{entry.label}</span>
                                <span className="block text-xs text-muted-foreground">{entry.reason}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {registryConflict ? (
                <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-semibold">
                    REGISTRY CONFLICT: this id was found in the live blueprint registry. Treat every other statement on
                    this card as unverified until that is explained.
                </p>
            ) : null}

            {alias?.matches ? (
                <section
                    aria-labelledby={domId("candidate", blueprint.id, "alias")}
                    className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-3 space-y-1"
                    data-alias-of={alias.baseId}
                >
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4" aria-hidden="true" />
                        <SectionHeading id={domId("candidate", blueprint.id, "alias")}>
                            Alias / fold candidate for {alias.baseId}
                        </SectionHeading>
                    </div>
                    <p className="text-sm">
                        Its engine fingerprint is identical to the active {alias.baseId}, so this is a terminology
                        variant of an existing vertical rather than a distinct one. This marker is computed from the
                        live registry on every render: if either composition changes, it disappears.
                    </p>
                    <p className="font-mono text-xs break-words text-muted-foreground">{alias.candidateFingerprint}</p>
                </section>
            ) : alias ? (
                <section
                    aria-labelledby={domId("candidate", blueprint.id, "alias")}
                    className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1"
                    data-alias-diverged={alias.baseId}
                >
                    <SectionHeading id={domId("candidate", blueprint.id, "alias")}>
                        No longer an alias for {alias.baseId}
                    </SectionHeading>
                    <p className="text-sm">
                        This candidate was recorded as a fold of {alias.baseId}, but their engine fingerprints no longer
                        match, so it is not presented as an alias.
                    </p>
                    <p className="font-mono text-xs break-words text-muted-foreground">
                        candidate: {alias.candidateFingerprint}
                    </p>
                    <p className="font-mono text-xs break-words text-muted-foreground">
                        {alias.baseId}: {alias.baseFingerprint ?? "not an active blueprint"}
                    </p>
                </section>
            ) : null}

            <section aria-labelledby={domId("candidate", blueprint.id, "readiness")} className="space-y-2">
                <SectionHeading id={domId("candidate", blueprint.id, "readiness")}>Readiness</SectionHeading>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-xs text-muted-foreground">Readiness</dt>
                        <dd className="font-mono text-xs">{candidate.readiness}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Blueprint status</dt>
                        <dd className="font-mono text-xs">{blueprint.status}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">In the blueprint registry</dt>
                        <dd className="text-xs">{registryConflict ? "PRESENT - see conflict above" : "No"}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Onboarding role</dt>
                        <dd className="text-xs">
                            <span className="font-mono">{candidate.onboarding.proposedRoleKey}</span> is proposed only;
                            no such role exists and none points here.
                        </dd>
                    </div>
                </dl>
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "terminology")} className="space-y-2">
                <SectionHeading id={domId("candidate", blueprint.id, "terminology")}>
                    Proposed terminology
                </SectionHeading>
                {terminologyEntries.length === 0 ? (
                    <HonestlyEmpty>No terminology is proposed by this candidate.</HonestlyEmpty>
                ) : (
                    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {terminologyEntries.map(([key, value]) => (
                            <div key={key} className="rounded-lg bg-muted/30 px-2 py-1.5">
                                <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                                <dd className="text-sm">{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
                <p className="text-xs text-muted-foreground">{candidate.terminologyNote}</p>
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "engines")} className="space-y-2">
                <SectionHeading id={domId("candidate", blueprint.id, "engines")}>
                    Engines and capabilities
                </SectionHeading>
                <div className="space-y-2">
                    {blueprint.engines.map((composition) => {
                        const descriptor = businessEngineDescriptors[composition.engineId]
                        return (
                            <div
                                key={composition.engineId}
                                className="rounded-xl border border-border/70 bg-background/40 p-3 space-y-2"
                                data-engine={composition.engineId}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium">
                                        {descriptor.label}{" "}
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {composition.engineId}
                                        </span>
                                    </p>
                                    <Badge
                                        variant={composition.required ? "default" : "outline"}
                                        data-engine-requirement={composition.required ? "required" : "optional"}
                                    >
                                        {composition.required ? "Required" : "Optional"}
                                    </Badge>
                                </div>
                                <ul className="space-y-1">
                                    {composition.capabilities.map((capabilityId) => {
                                        const capability = capabilityOf(composition.engineId, capabilityId)
                                        return (
                                            <li key={capabilityId} className="text-sm">
                                                <span className="font-mono text-xs">{capabilityId}</span>
                                                {capability ? (
                                                    <>
                                                        {" — "}
                                                        {capability.label}
                                                        <span className="block text-xs text-muted-foreground">
                                                            engine capability status: {capability.maturity}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="block text-xs text-muted-foreground">
                                                        Not found in the engine registry.
                                                    </span>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                                {composition.plannedCapabilities && composition.plannedCapabilities.length > 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Backlog, not composed and not claimed:{" "}
                                        <span className="font-mono">
                                            {composition.plannedCapabilities.join(", ")}
                                        </span>
                                    </p>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "workflows")} className="space-y-2">
                <div className="flex items-center gap-2">
                    <WorkflowIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <SectionHeading id={domId("candidate", blueprint.id, "workflows")}>Workflows</SectionHeading>
                </div>
                <p className="text-xs text-muted-foreground">{candidate.ownerWorkflow.executionNote}</p>
                {blueprint.workflows.length === 0 ? (
                    <HonestlyEmpty>No workflow is declared by this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-2">
                        {blueprint.workflows.map((workflow) => (
                            <li
                                key={workflow.id}
                                className="rounded-xl border border-border/70 bg-background/40 p-3 space-y-1"
                            >
                                <p className="text-sm font-medium">{workflow.name}</p>
                                <p className="font-mono text-xs text-muted-foreground">
                                    {workflow.id} · trigger {workflow.trigger.kind}
                                    {workflow.trigger.event ? ` · ${workflow.trigger.event}` : ""}
                                    {workflow.trigger.schedule ? ` · ${workflow.trigger.schedule}` : ""}
                                </p>
                                <ul className="space-y-0.5 text-sm">
                                    {workflow.actions.map((action) => (
                                        <li key={action.id}>
                                            {action.label}
                                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                                                {action.kind}
                                            </span>
                                            {action.approval?.required ? (
                                                <span className="block text-xs text-muted-foreground">
                                                    needs approval from {action.approval.approverRole}:{" "}
                                                    {action.approval.reason}
                                                </span>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
                {candidate.ownerWorkflow.approvalGates.length === 0 ? (
                    <HonestlyEmpty>No approval gate is declared by this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {candidate.ownerWorkflow.approvalGates.map((gate) => (
                            <li key={gate}>Approval gate: {gate}</li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "dependencies")} className="space-y-2">
                <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <SectionHeading id={domId("candidate", blueprint.id, "dependencies")}>
                        External dependencies and owner-gated functions
                    </SectionHeading>
                </div>
                <ul className="space-y-1.5" data-dependency-matrix={blueprint.id}>
                    {dependencies.map((row) => (
                        <li
                            key={row.id}
                            className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                            data-dependency={row.id}
                            data-dependency-status={row.status}
                        >
                            <span className="text-sm">
                                {row.label}
                                <span className="block text-xs text-muted-foreground">{row.detail}</span>
                            </span>
                            <Badge variant={row.status === "owner-gated" ? "secondary" : "outline"}>
                                {dependencyStatusLabel(row.status)}
                            </Badge>
                        </li>
                    ))}
                </ul>
                {candidate.ownerGated.length === 0 ? (
                    <HonestlyEmpty>No owner-gated function is declared by this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-1">
                        {candidate.ownerGated.map((entry) => (
                            <li key={entry.id} className="text-sm" data-owner-gated={entry.id}>
                                <span className="font-medium">{entry.label}</span>
                                <Badge variant="outline" className="ml-2">
                                    {entry.boundary === "owner-gated"
                                        ? "Owner-gated"
                                        : "Inert - nothing leaves the system"}
                                </Badge>
                                <span className="block text-xs text-muted-foreground">{entry.gate}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "unsupported")} className="space-y-2">
                <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <SectionHeading id={domId("candidate", blueprint.id, "unsupported")}>
                        Functions this candidate does not provide
                    </SectionHeading>
                </div>
                {candidate.unsupported.length === 0 ? (
                    <HonestlyEmpty>No unsupported function is declared by this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-1">
                        {candidate.unsupported.map((entry) => (
                            <li key={entry.id} className="text-sm" data-unsupported={entry.id}>
                                <span className="font-medium">{entry.label}</span>
                                <span className="block text-xs text-muted-foreground">{entry.reason}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "onboarding")} className="space-y-2">
                <SectionHeading id={domId("candidate", blueprint.id, "onboarding")}>
                    Onboarding this would need
                </SectionHeading>
                <p className="text-xs text-muted-foreground">
                    Corresponds to an existing onboarding role:{" "}
                    {candidate.onboarding.correspondsToExistingRole ? "yes" : "no"}. Nothing here is configurable from
                    this page.
                </p>
                {candidate.onboarding.steps.length === 0 ? (
                    <HonestlyEmpty>No onboarding step is declared by this candidate.</HonestlyEmpty>
                ) : (
                    <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                        {candidate.onboarding.steps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                )}
                {candidate.onboarding.requiredOwnerDecisions.length === 0 ? (
                    <HonestlyEmpty>No owner decision is recorded as required by this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {candidate.onboarding.requiredOwnerDecisions.map((decision) => (
                            <li key={decision}>Owner decision required: {decision}</li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "questions")} className="space-y-2">
                <SectionHeading id={domId("candidate", blueprint.id, "questions")}>
                    Daily questions it could answer
                </SectionHeading>
                <p className="text-xs text-muted-foreground">
                    Read-only prompts recorded on the candidate. Listed as text and not interactive: there is nothing to
                    run and no result to show, because nothing is installed.
                </p>
                {candidate.dailyOpportunities.length === 0 ? (
                    <HonestlyEmpty>No daily question is declared by this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {candidate.dailyOpportunities.map((opportunity) => (
                            <li key={opportunity.id}>
                                {opportunity.prompt}
                                <span className="block font-mono text-xs text-muted-foreground">
                                    reads {opportunity.readsFrom.join(", ")}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "surfaces")} className="space-y-2">
                <SectionHeading id={domId("candidate", blueprint.id, "surfaces")}>Intended surfaces</SectionHeading>
                {candidate.intendedSurfaces.length === 0 ? (
                    <HonestlyEmpty>No surface is intended by this candidate.</HonestlyEmpty>
                ) : (
                    <p className="font-mono text-xs text-muted-foreground">
                        {candidate.intendedSurfaces.join(", ")}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    Intended only. Surfaces are resolved from the onboarding role, and no role points at this
                    candidate, so none of these resolves anywhere today.
                </p>
            </section>

            <section aria-labelledby={domId("candidate", blueprint.id, "integration")} className="space-y-2">
                <div className="flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <SectionHeading id={domId("candidate", blueprint.id, "integration")}>
                        Notes for the integration owner
                    </SectionHeading>
                </div>
                {candidate.integrationNotes.length === 0 ? (
                    <HonestlyEmpty>No integration note is recorded for this candidate.</HonestlyEmpty>
                ) : (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                        {candidate.integrationNotes.map((note) => (
                            <li key={note}>{note}</li>
                        ))}
                    </ul>
                )}
            </section>
        </article>
    )
}

const PAGE_TITLE = "Vertical candidate catalog"
const PAGE_DESCRIPTION =
    "Six unregistered vertical packs, described for evaluation only. Nothing on this page is installed, active, or installable from here."

export function VerticalCandidateCatalog({ state }: { state: VerticalCandidateCatalogState }) {
    if (state.kind === "loading") {
        return (
            <div className="flex-1 space-y-6" aria-busy="true" aria-live="polite">
                <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
                <span className="sr-only">Loading vertical candidates</span>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="rounded-2xl border border-border/70 bg-muted/10 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (state.kind === "unauthorized") {
        return (
            <div className="flex-1 space-y-6">
                <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
                <Card>
                    <CardContent>
                        <ErrorState
                            title="You are not signed in"
                            description="This catalog is shown only to a signed-in owner. No candidate is listed, and nothing is shown in place of one."
                        />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (state.kind === "forbidden") {
        return (
            <div className="flex-1 space-y-6">
                <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
                <Card>
                    <CardContent>
                        <ErrorState
                            title="Your profile does not include the Business OS surface"
                            description="This catalog is part of the owner console, which is granted per profile. No candidate is listed, and nothing is shown in place of one. Nothing was changed."
                        />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (state.kind === "dependency-error") {
        return (
            <div className="flex-1 space-y-6">
                <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
                <Card>
                    <CardContent>
                        <ErrorState
                            title="The candidate descriptors could not be read"
                            description={
                                <div className="space-y-1">
                                    <p>
                                        The candidate package validates itself when it loads, and that failed. No
                                        candidate is listed, and nothing is shown in place of one. Nothing was changed.
                                    </p>
                                    {state.detail ? (
                                        <p className="font-mono text-xs break-words">{state.detail}</p>
                                    ) : null}
                                </div>
                            }
                        />
                    </CardContent>
                </Card>
            </div>
        )
    }

    const { candidates, registeredBlueprints } = state

    return (
        <div className="flex-1 space-y-6">
            <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

            <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
                    <CardTitle className="text-sm font-medium">
                        <h3>How to read this page</h3>
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        Every entry below is a CANDIDATE: not installed, not active, and not installable. There is no
                        install, activate or enable control on this page, and this surface has no write path that could
                        make one of these registered.
                    </p>
                    <p>
                        No customer, booking, revenue or usage figure appears anywhere on this page, because none exists
                        for something that has never been installed. Where a candidate declares nothing for a field, the
                        card says so instead of showing a number.
                    </p>
                    <p>
                        Messages, deposits, payments and external providers read as unavailable or owner-gated on every
                        card. That is the product&apos;s actual state, not a limitation of this view.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">
                        <h3>Candidates</h3>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {candidates.length === 0 ? (
                        <EmptyState
                            icon={<CircleSlash aria-hidden="true" />}
                            title="No vertical candidates are declared"
                            description="The candidate package is empty. No example, sample or placeholder candidate is shown in its place."
                        />
                    ) : (
                        <div className="space-y-4">
                            {candidates.map((candidate) => (
                                <CandidateCard
                                    key={candidate.blueprint.id}
                                    candidate={candidate}
                                    registeredBlueprints={registeredBlueprints}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
