"use client"

import { AlertTriangle, ArrowUpCircle, History, PackageCheck, ShieldOff, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    blueprintInstallErrorCopy,
    blueprintInstallRequest,
    eventKindLabel,
    formatOccurredAt,
    installationStateLabel,
    isAbortError,
    newIdempotencyKey,
    readableKey,
    type InstallPlanView,
    type InstallResult,
    type InstalledBlueprintView,
    type WorkspaceInstallationView,
} from "./blueprint-install-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The owner-facing blueprint INSTALLATION panel: what is installed, what installing would do, and
 * install / upgrade / remove — against endpoints root is building in parallel and which do not exist
 * while this package is written. Every state below is verified with `tsc` and static assertions only;
 * none of it has been runtime-exercised, and the report says so plainly.
 *
 * THE HONESTY PROBLEM THIS PANEL EXISTS TO SOLVE
 *
 * `install-types.ts` draws six lines this component must never cross, and each has a dedicated
 * section below so a reader can check the panel against the contract line by line:
 *
 *   1. `permissionChanges` is typed `readonly []` — always empty. Rendered as a stated fact ("this
 *      would change no permissions"), never as an empty list with a "none" placeholder, because a
 *      placeholder is exactly the shape that would silently hide a future non-empty value.
 *   2. `surfaces` / `fieldPacks` are RECORDED, not granted. Copy says the install recorded them and
 *      that navigation is unchanged; there is no "your new features" framing anywhere.
 *   3. `config` is frozen at install time. When `driftedFromRegistry` is true, the panel shows the
 *      frozen config and says today's resolution differs — it never swaps in a live re-resolution.
 *   4. Remove is not a delete: it moves the row to `REMOVED` and history is retained. The confirmation
 *      step says this before the DELETE fires, and REMOVED renders as a distinct history state rather
 *      than the installation disappearing.
 *   5. The history list has no edit or delete control on any line — it is append-only in the database.
 *   6. `idempotencyKey` is minted once per user intent (install click, upgrade click, remove click)
 *      and REUSED across a retry of that same intent after a failure. A fresh click after a
 *      successful or already-failed-and-abandoned attempt starts a new intent and a new key.
 *
 * 409 gets its own copy split (`conflictCopy` in the shared module) because collapsing it to "already
 * installed" would misdescribe the one case that is not an error: `outcome: "replayed"` is a 2xx
 * SUCCESS and is rendered as one, never routed through error copy at all.
 *
 * 403 vs 404: 403 covers a foreign workspace and a nonexistent workspace byte-identically, so this
 * panel's 403 copy makes no claim about which one happened. 404 is reserved for an unknown blueprint
 * id and never used for a workspace.
 */

/**
 * Loaded/failed state is stored WITH the key it was fetched for, matching the `Keyed<T>` pattern
 * `operations-panel.tsx` and `blueprint-preview-panel.tsx` already use — it answers "is this loading
 * or is this empty" by construction, which is what keeps the mount effect free of
 * `react-hooks/set-state-in-effect` without an eslint-disable.
 */
type Keyed<T> = Readonly<{ key: string; value: T }>

type PendingIntent = Readonly<{ kind: "install" | "upgrade" | "remove"; blueprintId: string; idempotencyKey: string }>

export function BlueprintInstallPanel({ workspaceId }: { workspaceId: string }) {
    const [loaded, setLoaded] = useState<Keyed<WorkspaceInstallationView> | null>(null)
    const [failed, setFailed] = useState<Keyed<unknown> | null>(null)

    const [planBlueprintId, setPlanBlueprintId] = useState<string | null>(null)
    const [planLoaded, setPlanLoaded] = useState<Keyed<InstallPlanView> | null>(null)
    const [planFailed, setPlanFailed] = useState<Keyed<unknown> | null>(null)

    const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null)
    const [actionBusy, setActionBusy] = useState(false)
    const [actionFailed, setActionFailed] = useState<unknown>(null)
    const [actionResult, setActionResult] = useState<InstallResult | null>(null)

    const [confirmingRemove, setConfirmingRemove] = useState(false)
    const [historyExpanded, setHistoryExpanded] = useState(false)

    /**
     * Mount fetch written INLINE inside the effect, matching `operations-panel.tsx`'s documented fix
     * for `react-hooks/set-state-in-effect`: the rule fires on an effect that calls a named function
     * — reachable from elsewhere — which also sets state. A self-contained async closure is accepted
     * because the compiler can see the whole path in one place. No eslint-disable is used.
     */
    useEffect(() => {
        const controller = new AbortController()
        const run = async () => {
            try {
                const data = await blueprintInstallRequest<WorkspaceInstallationView>(
                    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/blueprint`,
                    { signal: controller.signal },
                )
                setFailed(null)
                setLoaded({ key: workspaceId, value: data })
            } catch (cause) {
                if (isAbortError(cause)) return
                setFailed({ key: workspaceId, value: cause })
            }
        }
        if (workspaceId) void run()
        return () => controller.abort()
    }, [workspaceId])

    const reload = useCallback(async () => {
        if (!workspaceId) return
        try {
            const data = await blueprintInstallRequest<WorkspaceInstallationView>(
                `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/blueprint`,
            )
            setFailed(null)
            setLoaded({ key: workspaceId, value: data })
        } catch (cause) {
            if (isAbortError(cause)) return
            setFailed({ key: workspaceId, value: cause })
        }
    }, [workspaceId])

    // Fetching a plan is a user action (opening the "install/upgrade this blueprint" view), not an
    // effect, so reading `workspaceId` state here while also setting state is fine — the
    // set-state-in-effect rule only concerns effects.
    const loadPlan = useCallback(
        (blueprintId: string) => {
            setPlanBlueprintId(blueprintId)
            const controller = new AbortController()
            const key = `${workspaceId}:${blueprintId}`
            void blueprintInstallRequest<InstallPlanView>(
                `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/blueprint/plan?blueprintId=${encodeURIComponent(blueprintId)}`,
                { signal: controller.signal },
            )
                .then((data) => {
                    setPlanFailed(null)
                    setPlanLoaded({ key, value: data })
                })
                .catch((cause) => {
                    if (isAbortError(cause)) return
                    setPlanFailed({ key, value: cause })
                })
        },
        [workspaceId],
    )

    /**
     * Mints or reuses the idempotency key for one user intent. A retry after a FAILURE of the same
     * intent (same kind, same blueprintId) reuses the key already stored in `pendingIntent` — that is
     * the entire point of the key, per the contract. A fresh click that starts a DIFFERENT intent (a
     * different kind, or after the prior intent succeeded / was abandoned) mints a new one.
     */
    const keyForIntent = useCallback(
        (kind: PendingIntent["kind"], blueprintId: string): string => {
            if (pendingIntent && pendingIntent.kind === kind && pendingIntent.blueprintId === blueprintId && actionFailed) {
                return pendingIntent.idempotencyKey
            }
            return newIdempotencyKey()
        },
        [pendingIntent, actionFailed],
    )

    const runInstall = useCallback(
        async (blueprintId: string, kind: "install" | "upgrade") => {
            const idempotencyKey = keyForIntent(kind, blueprintId)
            setPendingIntent({ kind, blueprintId, idempotencyKey })
            setActionBusy(true)
            setActionFailed(null)
            try {
                const result = await blueprintInstallRequest<InstallResult>(
                    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/blueprint`,
                    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blueprintId, idempotencyKey }) },
                )
                setActionResult(result)
                setPendingIntent(null)
                await reload()
            } catch (cause) {
                setActionFailed(cause)
            } finally {
                setActionBusy(false)
            }
        },
        [workspaceId, keyForIntent, reload],
    )

    const runRemove = useCallback(async () => {
        const installed = loaded?.value.installed
        if (!installed) return
        const idempotencyKey = keyForIntent("remove", installed.blueprintId)
        setPendingIntent({ kind: "remove", blueprintId: installed.blueprintId, idempotencyKey })
        setActionBusy(true)
        setActionFailed(null)
        try {
            await blueprintInstallRequest<InstalledBlueprintView>(
                `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/blueprint`,
                { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey }) },
            )
            setPendingIntent(null)
            setConfirmingRemove(false)
            await reload()
        } catch (cause) {
            setActionFailed(cause)
        } finally {
            setActionBusy(false)
        }
    }, [workspaceId, loaded, keyForIntent, reload])

    const view = loaded !== null && loaded.key === workspaceId ? loaded.value : null
    const loadError = failed !== null && failed.key === workspaceId ? failed.value : null

    const planKey = planBlueprintId ? `${workspaceId}:${planBlueprintId}` : null
    const plan = planLoaded !== null && planLoaded.key === planKey ? planLoaded.value : null
    const planError = planFailed !== null && planFailed.key === planKey ? planFailed.value : null

    if (!workspaceId) {
        return (
            <EmptyState
                icon={<PackageCheck aria-hidden="true" />}
                title="Select a workspace"
                description="Choose a workspace above to see what is installed there."
            />
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <PackageCheck className="h-4 w-4" aria-hidden="true" />
                        Blueprint installation
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadError ? (
                        <ErrorState
                            title={blueprintInstallErrorCopy(loadError).title}
                            description={blueprintInstallErrorCopy(loadError).description}
                        >
                            {blueprintInstallErrorCopy(loadError).details ? (
                                <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-2 text-left text-xs">
                                    {JSON.stringify(blueprintInstallErrorCopy(loadError).details, null, 2)}
                                </pre>
                            ) : null}
                        </ErrorState>
                    ) : null}

                    {view === null && !loadError ? (
                        <div className="space-y-2" aria-live="polite" aria-busy="true">
                            <span className="sr-only">Loading blueprint installation</span>
                            <Skeleton className="h-8 w-2/3" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : null}

                    {view !== null ? (
                        <div aria-live="polite" className="space-y-5">
                            {view.installed === null ? (
                                <EmptyState
                                    icon={<PackageCheck aria-hidden="true" />}
                                    title="Nothing installed"
                                    description="This workspace has no active blueprint installation. This is a real answer, not an error and not a gap in what loaded."
                                />
                            ) : (
                                <InstalledSummary
                                    installed={view.installed}
                                    onUpgrade={(blueprintId) => loadPlan(blueprintId)}
                                    onOpenRemove={() => setConfirmingRemove(true)}
                                />
                            )}

                            {/* Limitations — rendered in full, always, matching the preview panel's own
                                convention: this is what keeps the screen honest about what it does not
                                know. */}
                            <section aria-labelledby="bp-install-limitations-heading">
                                <h4 id="bp-install-limitations-heading" className="flex items-center gap-1 text-sm font-medium">
                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                    What this view does not tell you
                                </h4>
                                {view.limitations.length === 0 ? (
                                    <p className="mt-1 text-xs text-muted-foreground">The server returned no limitations for this view.</p>
                                ) : (
                                    <ul className="mt-1 list-disc space-y-1 pl-5">
                                        {view.limitations.map((limitation, index) => (
                                            <li key={index} className="text-xs text-muted-foreground">
                                                {limitation}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            {view.installed && view.installed.history.length > 0 ? (
                                <HistorySection history={view.installed.history} expanded={historyExpanded} onToggle={() => setHistoryExpanded((v) => !v)} />
                            ) : view.installed ? (
                                <p className="text-xs text-muted-foreground">No history recorded yet.</p>
                            ) : null}

                            {view.all.length > 0 ? (
                                <section aria-labelledby="bp-install-all-heading">
                                    <h4 id="bp-install-all-heading" className="text-sm font-medium">
                                        All installations this workspace has had
                                    </h4>
                                    <ul className="mt-2 space-y-1">
                                        {view.all.map((installation) => (
                                            <li key={installation.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline">{installationStateLabel(installation.state)}</Badge>
                                                <span className="font-medium">{installation.blueprintId}</span>
                                                <span>v{installation.blueprintVersion}</span>
                                                <span>installed {formatOccurredAt(installation.installedAt)}</span>
                                                {installation.removedAt ? <span>removed {formatOccurredAt(installation.removedAt)}</span> : null}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ) : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {planBlueprintId ? (
                <PlanSection
                    plan={plan}
                    error={planError}
                    isUpgrade={view?.installed !== null && view?.installed !== undefined}
                    busy={actionBusy}
                    onInstall={() => runInstall(planBlueprintId, view?.installed ? "upgrade" : "install")}
                    onDismiss={() => {
                        setPlanBlueprintId(null)
                        setPlanLoaded(null)
                        setPlanFailed(null)
                    }}
                />
            ) : null}

            {confirmingRemove && view?.installed ? (
                <RemoveConfirmSection
                    installed={view.installed}
                    busy={actionBusy}
                    onConfirm={runRemove}
                    onCancel={() => setConfirmingRemove(false)}
                />
            ) : null}

            {actionFailed ? (
                <ErrorState title={blueprintInstallErrorCopy(actionFailed).title} description={blueprintInstallErrorCopy(actionFailed).description}>
                    {blueprintInstallErrorCopy(actionFailed).details ? (
                        <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-2 text-left text-xs">
                            {JSON.stringify(blueprintInstallErrorCopy(actionFailed).details, null, 2)}
                        </pre>
                    ) : null}
                </ErrorState>
            ) : null}

            {actionResult ? (
                <div role="status" className="rounded-md border border-border/70 p-3 text-xs">
                    {actionResult.outcome === "replayed" ? (
                        <p>
                            This was a replay of an attempt already made with this key. No new row was written; the installation shown is the
                            original result. This is a success, not an error.
                        </p>
                    ) : actionResult.outcome === "upgraded" ? (
                        <p>Upgraded. The previous installation was superseded and is retained in history.</p>
                    ) : (
                        <p>Installed.</p>
                    )}
                </div>
            ) : null}
        </div>
    )
}

function InstalledSummary({
    installed,
    onUpgrade,
    onOpenRemove,
}: {
    installed: InstalledBlueprintView
    onUpgrade: (blueprintId: string) => void
    onOpenRemove: () => void
}) {
    return (
        <section aria-labelledby="bp-installed-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 id="bp-installed-heading" className="text-sm font-medium">
                        {installed.blueprintId}
                    </h4>
                    <p className="text-xs text-muted-foreground">v{installed.blueprintVersion}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{installationStateLabel(installed.state)}</Badge>
                    {installed.driftedFromRegistry ? <Badge variant="destructive">drifted from registry</Badge> : null}
                </div>
            </div>

            {installed.driftedFromRegistry ? (
                <p className="rounded-md border border-dashed border-border/70 p-2 text-xs text-muted-foreground">
                    Re-resolving this blueprint today would not produce the configuration below. What is shown is what this workspace agreed
                    to at install time — not today&rsquo;s resolution, which has moved on.
                </p>
            ) : null}

            {installed.currentBlockers.length > 0 ? (
                <div>
                    <h5 className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        This installation has lost ground
                    </h5>
                    <ul className="mt-1 space-y-0.5">
                        {installed.currentBlockers.map((blocker, index) => (
                            <li key={index} className="text-xs text-muted-foreground">
                                {blocker}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <ConfigSection config={installed.config} />

            {installed.state === "ACTIVE" ? (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onUpgrade(installed.blueprintId)}>
                        <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        View upgrade / reinstall plan
                    </Button>
                    <Button size="sm" variant="destructive" onClick={onOpenRemove}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                    </Button>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    {installed.state === "SUPERSEDED"
                        ? "Superseded by a later installation and cannot change."
                        : "Removed and cannot change."}
                </p>
            )}
        </section>
    )
}

function ConfigSection({ config }: { config: InstalledBlueprintView["config"] }) {
    return (
        <div className="space-y-2 rounded-md border border-border/70 p-3">
            <p className="text-xs text-muted-foreground">
                {config.role ? `Derived from the "${config.role}" role this blueprint corresponded to at install time.` : "No onboarding role corresponded to this blueprint at install time."}
            </p>
            <p className="text-xs text-muted-foreground">
                Surfaces and field packs below were <span className="font-medium">recorded</span> at install time, not granted. Navigation did
                not change and remains per-profile.
            </p>
            {config.businessOsExcluded ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                    The owner console surface was not included and was not granted by this installation.
                </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surfaces (recorded)</h5>
                    {config.surfaces.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">None recorded.</p>
                    ) : (
                        <ul className="mt-1 space-y-0.5">
                            {config.surfaces.map((surface) => (
                                <li key={surface} className="text-xs text-muted-foreground">
                                    {surface}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field packs (recorded)</h5>
                    {config.fieldPacks.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">None recorded.</p>
                    ) : (
                        <ul className="mt-1 space-y-0.5">
                            {config.fieldPacks.map((pack) => (
                                <li key={pack} className="text-xs text-muted-foreground">
                                    {pack}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Terminology</h5>
                {Object.keys(config.terminology).length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">None recorded.</p>
                ) : (
                    <ul className="mt-1 space-y-0.5">
                        {Object.entries(config.terminology).map(([key, value]) => (
                            <li key={key} className="text-xs text-muted-foreground">
                                <span className="font-medium">{readableKey(key)}:</span> {value}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {config.engineIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">Engines: {config.engineIds.join(", ")}</p>
            ) : null}
        </div>
    )
}

function HistorySection({
    history,
    expanded,
    onToggle,
}: {
    history: InstalledBlueprintView["history"]
    expanded: boolean
    onToggle: () => void
}) {
    return (
        <section aria-labelledby="bp-install-history-heading">
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls="bp-install-history-list"
                onClick={onToggle}
                className="flex items-center gap-1 text-sm font-medium"
            >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                <span id="bp-install-history-heading">History ({history.length})</span>
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
                Append-only. There is no edit or delete control on any line below, because none exists on the record.
            </p>
            {expanded ? (
                <ul id="bp-install-history-list" className="mt-2 space-y-1">
                    {history.map((event) => (
                        <li key={event.id} className="text-xs text-muted-foreground">
                            <span className="font-medium">{eventKindLabel(event.kind)}</span> by {event.actor} —{" "}
                            {formatOccurredAt(event.occurredAt)}
                            {event.detail ? <span> — {event.detail}</span> : null}
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    )
}

function PlanSection({
    plan,
    error,
    isUpgrade,
    busy,
    onInstall,
    onDismiss,
}: {
    plan: InstallPlanView | null
    error: unknown
    isUpgrade: boolean
    busy: boolean
    onInstall: () => void
    onDismiss: () => void
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{isUpgrade ? "Upgrade plan" : "Install plan"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {error ? (
                    <ErrorState title={blueprintInstallErrorCopy(error).title} description={blueprintInstallErrorCopy(error).description} />
                ) : null}

                {plan === null && !error ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading install plan</span>
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : null}

                {plan !== null ? (
                    <div aria-live="polite" className="space-y-3">
                        {plan.refused ? (
                            <div>
                                <h5 className="flex items-center gap-1 text-xs font-medium text-destructive">
                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                    This install would be refused right now
                                </h5>
                                <ul className="mt-1 space-y-0.5">
                                    {plan.refusals.map((reason, index) => (
                                        <li key={index} className="text-xs text-muted-foreground">
                                            {reason}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {plan.isUpgrade && plan.supersedes ? (
                            <p className="text-xs text-muted-foreground">
                                This would supersede the current installation of{" "}
                                <span className="font-medium">{plan.supersedes.blueprintId}</span> v{plan.supersedes.blueprintVersion}. The
                                current row moves to superseded and is retained in history; this is an upgrade, not a second install.
                            </p>
                        ) : null}

                        {/* permissionChanges is typed readonly [] — always empty. Stated as a fact, never
                            rendered as an empty list with a placeholder that a future non-empty value
                            would silently hide. */}
                        <p className="rounded-md border border-dashed border-border/70 p-2 text-xs text-muted-foreground">
                            Installing changes no permissions. In particular, it does not grant the owner console
                            (<code>businessOs</code>).
                        </p>

                        <ConfigSection config={plan.config} />

                        <Button size="sm" onClick={onInstall} disabled={busy || plan.refused}>
                            <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            {busy ? "Submitting…" : isUpgrade ? "Confirm upgrade" : "Confirm install"}
                        </Button>
                    </div>
                ) : null}

                <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
                    Dismiss
                </Button>
            </CardContent>
        </Card>
    )
}

function RemoveConfirmSection({
    installed,
    busy,
    onConfirm,
    onCancel,
}: {
    installed: InstalledBlueprintView
    busy: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Confirm remove
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                    Removing <span className="font-medium">{installed.blueprintId}</span> v{installed.blueprintVersion} is{" "}
                    <span className="font-medium">not a delete</span>. It moves this installation to REMOVED; the row and its history are
                    retained and remain visible in the list above.
                </p>
                <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={onConfirm} disabled={busy}>
                        {busy ? "Removing…" : "Remove installation"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
                        Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
