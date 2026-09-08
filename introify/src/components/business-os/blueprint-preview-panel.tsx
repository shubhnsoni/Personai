"use client"

import { AlertTriangle, BadgeCheck, BookOpen, Layers, ListChecks, ShieldQuestion } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    blueprintPreviewErrorCopy,
    blueprintPreviewRequest,
    isAbortError,
    maturityLabel,
    readableKey,
    statusLabel,
    type BlueprintPreviewView,
    type BlueprintSummaryView,
} from "./blueprint-preview-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The blueprint preview / onboarding panel: "what would choosing this blueprint mean for me",
 * answered without installing anything, because there is nothing here that installs.
 *
 * THE HONESTY PROBLEM THIS PANEL EXISTS TO SOLVE
 *
 * `preview-types.ts` draws a line this component must never cross: a blueprint declares engines,
 * capabilities, workflows, copilot prompts and a version - and declares NO terminology, surfaces or
 * dashboard modules. Those exist in the product but are resolved through the ROLE a blueprint
 * corresponds to, not through the blueprint itself, and the contract labels every such value
 * `source: "role-derived"` for exactly that reason. Presenting a role-derived terminology list as
 * "this blueprint's terminology" would be the fabrication the contract exists to prevent, so this
 * panel says "derived from the <role> role" wherever it renders anything from `presentation`.
 *
 * Everything else follows from there being no installation runtime yet:
 *
 *   - `installed` is always `null`. No badge, no install button that posts anywhere, no progress
 *     indicator - there is no endpoint to call. The one affordance offered is a disabled control
 *     whose own copy says installation is not built yet;
 *   - `limitations` renders in full, always, and first among them (or added if the server ever
 *     omitted it) is that installation does not exist yet - a preview screen that dropped this would
 *     read as a settings page reporting configured state, which it is not;
 *   - `businessOsRequiresOptIn: true` is stated as the owner console NOT being granted by this
 *     choice, never rendered as an included feature waiting to switch on;
 *   - `installable` / `blockedBy` are rendered exactly as the server computed them and never
 *     recomputed here - the contract is explicit that a capability can regress after a blueprint is
 *     declared active, so the server's answer is authoritative;
 *   - a missing blueprint is a genuine 404 (`blueprintPreviewErrorCopy` never uses "you do not have
 *     access" phrasing for it), because a blueprint id is a public registry key and revealing that
 *     one does not exist leaks nothing tenant-specific. A 403 still means the workspace is not yours.
 */

/**
 * Both the list and the preview are stored WITH the key they were fetched for, rather than being
 * cleared in an effect when the key changes - the same `Keyed<T>` pattern `operations-panel.tsx`
 * uses, for the same reason: it answers "is this loading or is this empty" by construction instead of
 * needing a synchronous clear inside an effect, which is what `react-hooks/set-state-in-effect`
 * flags in the first place.
 */
type Keyed<T> = Readonly<{ key: string; value: T }>

export function BlueprintPreviewPanel({ workspaceId }: { workspaceId: string }) {
    const [listLoaded, setListLoaded] = useState<Keyed<readonly BlueprintSummaryView[]> | null>(null)
    const [listFailed, setListFailed] = useState<Keyed<unknown> | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [previewLoaded, setPreviewLoaded] = useState<Keyed<BlueprintPreviewView> | null>(null)
    const [previewFailed, setPreviewFailed] = useState<Keyed<unknown> | null>(null)

    /**
     * The mount fetch is written INLINE inside the effect rather than calling a named `loadList`
     * function, matching `operations-panel.tsx`'s documented fix for `react-hooks/set-state-in-effect`:
     * the rule fires on an effect that calls a named function - reachable from elsewhere - which also
     * sets state, and accepts a self-contained async closure because there the compiler can see the
     * whole path in one place. No eslint-disable is used.
     */
    useEffect(() => {
        const controller = new AbortController()
        const run = async () => {
            try {
                const data = await blueprintPreviewRequest<{ blueprints: readonly BlueprintSummaryView[] }>(
                    `/api/platform/blueprints?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { signal: controller.signal },
                )
                setListFailed(null)
                setListLoaded({ key: workspaceId, value: data.blueprints })
            } catch (cause) {
                if (isAbortError(cause)) return
                setListFailed({ key: workspaceId, value: cause })
            }
        }
        if (workspaceId) void run()
        return () => controller.abort()
    }, [workspaceId])

    // Selecting a blueprint fetches its preview. This is a user action (a click handler), not an
    // effect, so reading `workspaceId`/`selectedId` state here while also setting state is fine - the
    // rule only concerns effects.
    const selectBlueprint = useCallback(
        (blueprintId: string) => {
            setSelectedId(blueprintId)
            const controller = new AbortController()
            const previewKey = `${workspaceId}:${blueprintId}`
            void blueprintPreviewRequest<{ preview: BlueprintPreviewView }>(
                `/api/platform/blueprints/${encodeURIComponent(blueprintId)}/preview?workspaceId=${encodeURIComponent(workspaceId)}`,
                { signal: controller.signal },
            )
                .then((data) => {
                    setPreviewFailed(null)
                    setPreviewLoaded({ key: previewKey, value: data.preview })
                })
                .catch((cause) => {
                    if (isAbortError(cause)) return
                    setPreviewFailed({ key: previewKey, value: cause })
                })
        },
        [workspaceId],
    )

    const listKey = workspaceId
    const blueprints = listLoaded !== null && listLoaded.key === listKey ? listLoaded.value : null
    const listError = listFailed !== null && listFailed.key === listKey ? listFailed.value : null

    const previewKey = selectedId ? `${workspaceId}:${selectedId}` : null
    const preview = previewLoaded !== null && previewLoaded.key === previewKey ? previewLoaded.value : null
    const previewError = previewFailed !== null && previewFailed.key === previewKey ? previewFailed.value : null

    if (!workspaceId) {
        return (
            <EmptyState
                icon={<Layers aria-hidden="true" />}
                title="Select a workspace"
                description="Choose a workspace above to preview the blueprints available to it."
            />
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Layers className="h-4 w-4" aria-hidden="true" />
                        Blueprints
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground">
                        A preview of what choosing a blueprint would mean. This screen only reads and installs
                        nothing - there is no install button anywhere on it.
                    </p>

                    {listError ? (
                        <div className="mt-3">
                            <ErrorState
                                title={blueprintPreviewErrorCopy(listError).title}
                                description={blueprintPreviewErrorCopy(listError).description}
                            />
                        </div>
                    ) : null}

                    {blueprints === null && !listError ? (
                        <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                            <span className="sr-only">Loading blueprints</span>
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : null}

                    {blueprints !== null ? (
                        blueprints.length === 0 ? (
                            <div className="mt-3">
                                <EmptyState
                                    icon={<Layers aria-hidden="true" />}
                                    title="No blueprints available"
                                    description="The registry returned no blueprints for this workspace. Nothing here is sample data."
                                />
                            </div>
                        ) : (
                            <ul className="mt-3 space-y-2" aria-label="Available blueprints">
                                {blueprints.map((blueprint) => (
                                    <li key={blueprint.id}>
                                        <button
                                            type="button"
                                            onClick={() => selectBlueprint(blueprint.id)}
                                            aria-pressed={selectedId === blueprint.id}
                                            className="w-full rounded-md border border-border/70 p-3 text-left hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <h3 className="text-sm font-medium">{blueprint.name}</h3>
                                                    <p className="text-xs text-muted-foreground">{blueprint.summary}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline">{blueprint.vertical}</Badge>
                                                    <Badge variant="outline">v{blueprint.version}</Badge>
                                                    <Badge variant="secondary">{statusLabel(blueprint.status)}</Badge>
                                                    {blueprint.installable ? (
                                                        <Badge variant="outline">installable</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">not installable</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            {!blueprint.installable && blueprint.blockedBy.length > 0 ? (
                                                <ul className="mt-2 space-y-0.5">
                                                    {blueprint.blockedBy.map((reason, index) => (
                                                        <li key={index} className="text-xs text-muted-foreground">
                                                            Blocked: {reason}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : null}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )
                    ) : null}
                </CardContent>
            </Card>

            {selectedId ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="h-4 w-4" aria-hidden="true" />
                            Preview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {previewError ? (
                            <ErrorState
                                title={blueprintPreviewErrorCopy(previewError).title}
                                description={blueprintPreviewErrorCopy(previewError).description}
                            >
                                {blueprintPreviewErrorCopy(previewError).details ? (
                                    <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-2 text-left text-xs">
                                        {JSON.stringify(blueprintPreviewErrorCopy(previewError).details, null, 2)}
                                    </pre>
                                ) : null}
                            </ErrorState>
                        ) : null}

                        {preview === null && !previewError ? (
                            <div className="space-y-2" aria-live="polite" aria-busy="true">
                                <span className="sr-only">Loading blueprint preview</span>
                                <Skeleton className="h-8 w-2/3" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : null}

                        {preview !== null ? (
                            <div aria-live="polite" className="space-y-5">
                                <div>
                                    <h3 className="text-base font-semibold">{preview.name}</h3>
                                    <p className="text-xs text-muted-foreground">{preview.summary}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">{preview.vertical}</Badge>
                                        <Badge variant="outline">v{preview.versioning.version}</Badge>
                                        <Badge variant="secondary">{statusLabel(preview.versioning.status)}</Badge>
                                        {preview.installable ? (
                                            <Badge variant="outline">installable</Badge>
                                        ) : (
                                            <Badge variant="destructive">not installable</Badge>
                                        )}
                                        {preview.versioning.isSuperseded ? (
                                            <Badge variant="destructive">superseded</Badge>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Versioning: supersedes / supersededBy, so an owner can see this is an
                                    upgrade rather than a new thing, and can see when choosing it would
                                    mean choosing the old one. */}
                                <section aria-labelledby="bp-versioning-heading">
                                    <h4 id="bp-versioning-heading" className="text-sm font-medium">
                                        Versioning
                                    </h4>
                                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                                        <li>
                                            Supersedes:{" "}
                                            {preview.versioning.supersedes ?? "nothing - this is not declared to replace another blueprint"}
                                        </li>
                                        <li>
                                            Superseded by:{" "}
                                            {preview.versioning.supersededBy.length > 0
                                                ? preview.versioning.supersededBy.join(", ")
                                                : "nothing yet"}
                                        </li>
                                        {preview.versioning.isSuperseded ? (
                                            <li className="text-destructive">
                                                A newer blueprint supersedes this one, so choosing it would be choosing the
                                                older version.
                                            </li>
                                        ) : null}
                                    </ul>
                                </section>

                                {!preview.installable && preview.blockedBy.length > 0 ? (
                                    <section aria-labelledby="bp-blocked-heading">
                                        <h4 id="bp-blocked-heading" className="flex items-center gap-1 text-sm font-medium text-destructive">
                                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                            Not installable right now
                                        </h4>
                                        <ul className="mt-1 space-y-0.5">
                                            {preview.blockedBy.map((reason, index) => (
                                                <li key={index} className="text-xs text-muted-foreground">
                                                    {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ) : null}

                                {/* Engines and capabilities, with maturity, required, and satisfied -
                                    rendered exactly as the server computed them, never recomputed here. */}
                                <section aria-labelledby="bp-engines-heading">
                                    <h4 id="bp-engines-heading" className="flex items-center gap-1 text-sm font-medium">
                                        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                                        Engines
                                    </h4>
                                    {preview.engines.length === 0 ? (
                                        <p className="mt-1 text-xs text-muted-foreground">No engines declared.</p>
                                    ) : (
                                        <ul className="mt-2 space-y-3">
                                            {preview.engines.map((engine) => (
                                                <li key={engine.engineId} className="rounded-md border border-border/70 p-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <h5 className="text-sm font-medium">{engine.label}</h5>
                                                            <p className="text-xs text-muted-foreground">{engine.description}</p>
                                                        </div>
                                                        <Badge variant={engine.required ? "secondary" : "outline"}>
                                                            {engine.required ? "required" : "optional"}
                                                        </Badge>
                                                    </div>
                                                    {engine.capabilities.length === 0 ? (
                                                        <p className="mt-2 text-xs text-muted-foreground">
                                                            No capabilities composed on this engine.
                                                        </p>
                                                    ) : (
                                                        <ul className="mt-2 space-y-1">
                                                            {engine.capabilities.map((capability) => (
                                                                <li
                                                                    key={capability.id}
                                                                    className="flex flex-wrap items-center gap-2 text-xs"
                                                                >
                                                                    <span className="font-medium">{capability.label}</span>
                                                                    <Badge variant="outline">{maturityLabel(capability.maturity)}</Badge>
                                                                    {capability.required ? (
                                                                        <Badge variant="secondary">required</Badge>
                                                                    ) : null}
                                                                    {capability.required ? (
                                                                        capability.satisfied ? (
                                                                            <Badge variant="outline">satisfied</Badge>
                                                                        ) : (
                                                                            <Badge variant="destructive">unsatisfied</Badge>
                                                                        )
                                                                    ) : null}
                                                                    <span className="text-muted-foreground">{capability.description}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {engine.plannedCapabilities.length > 0 ? (
                                                        <p className="mt-2 text-xs text-muted-foreground">
                                                            Planned backlog, not composed yet: {engine.plannedCapabilities.join(", ")}
                                                        </p>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                {/* Workflows, with trigger and approval requirements including WHY an
                                    approver is shown. */}
                                <section aria-labelledby="bp-workflows-heading">
                                    <h4 id="bp-workflows-heading" className="text-sm font-medium">
                                        Workflows
                                    </h4>
                                    {preview.workflows.length === 0 ? (
                                        <p className="mt-1 text-xs text-muted-foreground">No workflows declared.</p>
                                    ) : (
                                        <ul className="mt-2 space-y-3">
                                            {preview.workflows.map((workflow) => (
                                                <li key={workflow.id} className="rounded-md border border-border/70 p-3">
                                                    <h5 className="text-sm font-medium">{workflow.name}</h5>
                                                    <p className="text-xs text-muted-foreground">
                                                        Trigger: {workflow.triggerKind}
                                                        {workflow.triggerDetail ? ` — ${workflow.triggerDetail}` : ""}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {workflow.actionCount === 1 ? "1 action" : `${workflow.actionCount} actions`}
                                                    </p>
                                                    {workflow.approvals.length > 0 ? (
                                                        <ul className="mt-1 space-y-0.5">
                                                            {workflow.approvals.map((approval) => (
                                                                <li key={approval.actionId} className="text-xs text-muted-foreground">
                                                                    Requires approval from{" "}
                                                                    <span className="font-medium">{approval.approverRole}</span> —{" "}
                                                                    {approval.reason}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="mt-1 text-xs text-muted-foreground">No approvals required.</p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                {/* Owner copilot prompts — plain list text, never styled as a clickable
                                    control, matching the a11y finding already fixed elsewhere in this
                                    surface: a non-interactive prompt must not look like a button. */}
                                <section aria-labelledby="bp-copilot-heading">
                                    <h4 id="bp-copilot-heading" className="text-sm font-medium">
                                        Owner copilot prompts
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Suggested prompts, shown for reference. Not interactive - selecting text here does
                                        not run anything.
                                    </p>
                                    {preview.ownerCopilotPrompts.length === 0 ? (
                                        <p className="mt-1 text-xs text-muted-foreground">No copilot prompts declared.</p>
                                    ) : (
                                        <ul className="mt-1 list-disc space-y-1 pl-5">
                                            {preview.ownerCopilotPrompts.map((prompt, index) => (
                                                <li key={index} className="text-xs text-muted-foreground">
                                                    {prompt}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                {/* Presentation — the part that matters most. Everything here is
                                    role-derived, not declared by the blueprint, and the panel says so
                                    before it says anything else in this section. */}
                                <section aria-labelledby="bp-presentation-heading">
                                    <h4 id="bp-presentation-heading" className="flex items-center gap-1 text-sm font-medium">
                                        <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" />
                                        Presentation
                                    </h4>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {preview.presentation.source === "role-derived"
                                            ? preview.presentation.role
                                                ? `Not declared by this blueprint. Derived from the "${preview.presentation.role}" role it corresponds to.`
                                                : "Not declared by this blueprint, and no onboarding role currently maps to it, so nothing below is resolved."
                                            : "Declared by this blueprint."}
                                    </p>

                                    {preview.presentation.businessOsRequiresOptIn ? (
                                        <p className="mt-2 rounded-md border border-dashed border-border/70 p-2 text-xs text-muted-foreground">
                                            The owner console surface is <span className="font-medium">not</span> granted by
                                            choosing this blueprint. It requires a separate, explicit opt-in.
                                        </p>
                                    ) : null}

                                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Surfaces
                                            </h5>
                                            {preview.presentation.surfaces.length === 0 ? (
                                                <p className="mt-1 text-xs text-muted-foreground">None resolved.</p>
                                            ) : (
                                                <ul className="mt-1 space-y-0.5">
                                                    {preview.presentation.surfaces.map((surface) => (
                                                        <li key={surface} className="text-xs text-muted-foreground">
                                                            {surface}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Field packs
                                            </h5>
                                            {preview.presentation.fieldPacks.length === 0 ? (
                                                <p className="mt-1 text-xs text-muted-foreground">None resolved.</p>
                                            ) : (
                                                <ul className="mt-1 space-y-0.5">
                                                    {preview.presentation.fieldPacks.map((pack) => (
                                                        <li key={pack} className="text-xs text-muted-foreground">
                                                            {pack}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            Terminology (role-derived label overrides)
                                        </h5>
                                        {Object.keys(preview.presentation.terminology).length === 0 ? (
                                            <p className="mt-1 text-xs text-muted-foreground">None resolved.</p>
                                        ) : (
                                            <ul className="mt-1 space-y-0.5">
                                                {Object.entries(preview.presentation.terminology).map(([key, value]) => (
                                                    <li key={key} className="text-xs text-muted-foreground">
                                                        <span className="font-medium">{readableKey(key)}:</span> {value}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </section>

                                {/* Installed — always null. No badge, no install button, no progress
                                    indicator. The only affordance is a disabled control that says why. */}
                                <section aria-labelledby="bp-install-heading">
                                    <h4 id="bp-install-heading" className="text-sm font-medium">
                                        Install
                                    </h4>
                                    <Button size="sm" variant="outline" disabled aria-disabled="true">
                                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                        Installation is not built yet
                                    </Button>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        This button does nothing. There is no install endpoint in this product yet, so
                                        this screen cannot install anything, report an install in progress, or show an
                                        &ldquo;installed&rdquo; state - it has none to show.
                                    </p>
                                </section>

                                {/* Limitations — rendered in full, always. This is what keeps the whole
                                    screen a preview rather than a settings page. */}
                                <section aria-labelledby="bp-limitations-heading">
                                    <h4 id="bp-limitations-heading" className="flex items-center gap-1 text-sm font-medium">
                                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                        What this preview does not tell you
                                    </h4>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        This is a preview of what choosing this blueprint would mean, not a report of
                                        anything configured or installed.
                                    </p>
                                    {preview.limitations.length === 0 ? (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            The server returned no limitations for this preview.
                                        </p>
                                    ) : (
                                        <ul className="mt-1 list-disc space-y-1 pl-5">
                                            {preview.limitations.map((limitation, index) => (
                                                <li key={index} className="text-xs text-muted-foreground">
                                                    {limitation}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    )
}
