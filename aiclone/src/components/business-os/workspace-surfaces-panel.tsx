"use client"

import { AlertTriangle, LayoutGrid, PackageX } from "lucide-react"
import { useEffect, useState } from "react"

import {
    isAbortError,
    sourceLabel,
    surfaceLabel,
    workspaceSurfacesErrorCopy,
    workspaceSurfacesRequest,
    type WorkspaceSurfaceResolution,
} from "./workspace-surfaces-shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The workspace-aware surfaces panel: which product surfaces this workspace's active blueprint
 * installation recorded, or the honest statement that none is installed.
 *
 * THE HONESTY PROBLEM THIS PANEL EXISTS TO SOLVE
 *
 * `forWorkspace` never falls back to profile surfaces (see
 * `docs/orchestration/WORKSPACE_SURFACES_DECISION.md`, CORRECTION section, and the invariants in
 * `workspace-surface-types.ts`). A workspace with no active installation resolves to an EXPLICITLY
 * EMPTY set with `source: "no-active-blueprint-installation"`. Today that is the state of EVERY
 * workspace in the product, because onboarding creates workspaces and installs nothing.
 *
 * So "nothing installed" is this panel's MAIN case, not an edge case, and it renders as a calm,
 * ordinary empty state - never as an error, and never phrased so a reader could conclude the
 * workspace is broken or misconfigured.
 *
 * `unknownSurfaces` is the frozen config naming surfaces this build does not recognise. They were
 * dropped from `surfaces` (fail-safe: an unrecognised string cannot be granted), and this panel says
 * so and shows which ones, framed as the config having outlived a product change - not as an error.
 *
 * `businessOs` is never installation-derived (contract invariant, `install-types.ts` /
 * `workspace-surface-types.ts`) and this panel never lists it, so it cannot imply the owner console
 * was turned on by a blueprint.
 *
 * Surfaces here are recorded product configuration, never a permission grant: the resolver returns
 * no permission field and this panel's copy does not imply the user gained or lost access to anything.
 *
 * 403 covers a foreign workspace AND a nonexistent workspace byte-identically (see shared module), so
 * this panel's 403 copy never says "not found".
 *
 * THE SECURITY-SENSITIVE PROPERTY THIS PANEL MUST PRESERVE
 *
 * A slow response for workspace A must never land in workspace B's view after the user switches the
 * selected workspace. State is stored WITH the workspace id it was fetched for (the same `Keyed<T>`
 * pattern `operations-panel.tsx`, `blueprint-install-panel.tsx` and `blueprint-preview-panel.tsx`
 * already use), and every render reads the value back out ONLY if its stored key still equals the
 * CURRENT `workspaceId` prop. A response for a workspace the user has since navigated away from is
 * still written to state (there is nothing unsafe in storing it), but it is never the value handed to
 * JSX, because the key comparison at read time discards it. The in-flight `AbortController` additionally
 * cancels the previous request on every workspace change, so the stale response typically never
 * resolves at all - the key check is the second, independent guarantee that holds even if a fetch
 * ignores its abort signal.
 */
type Keyed<T> = Readonly<{ key: string; value: T }>

export function WorkspaceSurfacesPanel({ workspaceId }: { workspaceId: string }) {
    const [loaded, setLoaded] = useState<Keyed<WorkspaceSurfaceResolution> | null>(null)
    const [failed, setFailed] = useState<Keyed<unknown> | null>(null)

    /**
     * Mount fetch written INLINE inside the effect, matching `operations-panel.tsx`'s documented fix
     * for `react-hooks/set-state-in-effect`: the rule fires on an effect that calls a named function
     * - reachable from elsewhere - which also sets state. A self-contained async closure is accepted
     * because the compiler can see the whole path in one place. No eslint-disable is used.
     *
     * The effect depends on `workspaceId` alone, so switching workspaces re-runs it: the cleanup
     * aborts the in-flight request for the OLD workspace before the new fetch starts.
     */
    useEffect(() => {
        const controller = new AbortController()
        const run = async () => {
            try {
                const data = await workspaceSurfacesRequest<WorkspaceSurfaceResolution>(
                    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/surfaces`,
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

    // Only this workspace's result counts. A value left over from a previous workspace is not this
    // one's answer, so the panel reads as loading rather than briefly showing the wrong workspace's
    // surfaces - this is the read-time half of the stale-response guarantee described above.
    const resolution = loaded !== null && loaded.key === workspaceId ? loaded.value : null
    const loadError = failed !== null && failed.key === workspaceId ? failed.value : null

    if (!workspaceId) {
        return (
            <EmptyState
                icon={<LayoutGrid aria-hidden="true" />}
                title="Select a workspace"
                description="Choose a workspace above to see its product surfaces."
            />
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    Workspace surfaces
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">
                    Product surfaces recorded for this workspace. This is configuration, not a permission -
                    it does not say what the user is allowed to do.
                </p>

                {loadError ? (
                    <div className="mt-3">
                        <ErrorState
                            title={workspaceSurfacesErrorCopy(loadError).title}
                            description={workspaceSurfacesErrorCopy(loadError).description}
                        >
                            {workspaceSurfacesErrorCopy(loadError).details ? (
                                <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-2 text-left text-xs">
                                    {JSON.stringify(workspaceSurfacesErrorCopy(loadError).details, null, 2)}
                                </pre>
                            ) : null}
                        </ErrorState>
                    </div>
                ) : null}

                {resolution === null && !loadError ? (
                    <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading workspace surfaces</span>
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : null}

                {resolution !== null ? (
                    <div className="mt-4 space-y-4" aria-live="polite">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={resolution.source === "active-blueprint-installation" ? "secondary" : "outline"}>
                                {sourceLabel(resolution.source)}
                            </Badge>
                            {resolution.blueprintId ? (
                                <Badge variant="outline">{resolution.blueprintId}</Badge>
                            ) : null}
                        </div>

                        {resolution.source === "no-active-blueprint-installation" ? (
                            <EmptyState
                                icon={<PackageX aria-hidden="true" />}
                                title="No blueprint installed"
                                description="This workspace has no active blueprint installation, so it has no blueprint-derived surfaces. This is the common state - most workspaces start this way, and it is not an error or a sign anything is misconfigured."
                            />
                        ) : (
                            <section aria-labelledby="workspace-surfaces-list-heading">
                                <h3 id="workspace-surfaces-list-heading" className="text-sm font-medium">
                                    Surfaces from{" "}
                                    {resolution.blueprintId ? (
                                        <span className="font-semibold">{resolution.blueprintId}</span>
                                    ) : (
                                        "this installation"
                                    )}
                                </h3>
                                {resolution.surfaces.length === 0 ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        The active installation recorded no surfaces.
                                    </p>
                                ) : (
                                    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Recorded surfaces">
                                        {resolution.surfaces.map((surface) => (
                                            <li key={surface}>
                                                <Badge variant="outline">{surfaceLabel(surface)}</Badge>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        )}

                        {resolution.unknownSurfaces.length > 0 ? (
                            <section aria-labelledby="workspace-surfaces-unknown-heading">
                                <h4
                                    id="workspace-surfaces-unknown-heading"
                                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
                                >
                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                    Some recorded surfaces are no longer recognised
                                </h4>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    The frozen configuration for this installation names surfaces this build does not
                                    recognise. They were dropped rather than shown or granted:{" "}
                                    <span className="font-medium">{resolution.unknownSurfaces.join(", ")}</span>. This
                                    means the configuration outlived a product change - it is not an error.
                                </p>
                            </section>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
