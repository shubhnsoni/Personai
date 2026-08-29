"use client"

import { GraduationCap } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { CohortDetailPanel } from "./cohort-detail-panel"
import {
    type CohortView,
    cohortErrorCopy,
    cohortRequest,
    formatWhen,
    isAbort,
    titleCase,
} from "./cohorts-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing cohort console.
 *
 * Every row is a persisted Cohort read through /api/platform/cohorts. Cohorts are runs of
 * the programs that already exist as Courses; this screen does not invent a course, a
 * learner or a progress figure. An empty workspace renders the empty state.
 *
 * Refusals are shown rather than swallowed. A foreign or nonexistent cohort produces the
 * same 403 copy, matching the non-enumerating server refusal.
 */

function statusVariant(status: string) {
    if (status === "RUNNING" || status === "COMPLETED") return "default" as const
    if (status === "CANCELLED") return "destructive" as const
    return "secondary" as const
}

export function CohortsPanel({ workspaceId }: { workspaceId: string }) {
    const [cohorts, setCohorts] = useState<readonly CohortView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [selectedId, setSelectedId] = useState("")
    const [revision, setRevision] = useState(0)

    const reload = useCallback(() => setRevision((value) => value + 1), [])

    useEffect(() => {
        if (!workspaceId) {
            setCohorts(null)
            return
        }
        const controller = new AbortController()
        setCohorts(null)
        setError(null)
        cohortRequest<{ cohorts: readonly CohortView[] }>(
            `/api/platform/cohorts?workspaceId=${encodeURIComponent(workspaceId)}`,
            { signal: controller.signal },
        )
            .then((data) => setCohorts(data.cohorts))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    const transition = useCallback(
        async (cohortId: string, status: string) => {
            setBusy(cohortId)
            setActionError(null)
            try {
                await cohortRequest(`/api/platform/cohorts/${encodeURIComponent(cohortId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, status }),
                })
                reload()
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy("")
            }
        },
        [reload, workspaceId],
    )

    if (error) {
        const copy = cohortErrorCopy(error)
        return (
            <Card>
                <CardContent>
                    <ErrorState title={copy.title} description={copy.description} />
                </CardContent>
            </Card>
        )
    }

    const selected = cohorts?.find((record) => record.id === selectedId) ?? null

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Cohorts and batches</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Dated runs of the programs you already publish. Learners, lessons and progress come from the
                    existing course records; a cohort adds the schedule, attendance, assignments, certificates and
                    renewal state around them.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {!workspaceId ? (
                    <EmptyState
                        icon={<GraduationCap aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its cohorts."
                    />
                ) : null}

                {workspaceId && cohorts === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading cohorts</span>
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState
                        title={cohortErrorCopy(actionError).title}
                        description={cohortErrorCopy(actionError).description}
                    />
                ) : null}

                {cohorts?.length === 0 ? (
                    <EmptyState
                        icon={<GraduationCap aria-hidden="true" />}
                        title="No cohorts yet"
                        description="A cohort is a dated run of one of your courses. None have been created, and no sample cohorts are shown."
                    />
                ) : null}

                {cohorts && cohorts.length > 0 ? (
                    <ul className="space-y-2">
                        {cohorts.map((record) => (
                            <li key={record.id} className="rounded-xl border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {record.code} · {record.title}
                                    </span>
                                    <Badge variant={statusVariant(record.status)}>{titleCase(record.status)}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {record.startsOn ? `Starts ${formatWhen(record.startsOn)}` : "No start date set"} ·{" "}
                                    {record.capacity === null ? "no capacity limit" : `${record.capacity} places`} ·{" "}
                                    {record.timezone}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {record.allowedTransitions.map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === record.id}
                                            onClick={() => transition(record.id, next)}
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-expanded={selectedId === record.id}
                                        onClick={() => setSelectedId(selectedId === record.id ? "" : record.id)}
                                    >
                                        {selectedId === record.id ? "Hide detail" : "Show detail"}
                                    </Button>
                                </div>
                                {record.allowedTransitions.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        This cohort is {record.status.toLowerCase()} and cannot change.
                                    </p>
                                ) : null}
                                {selected && selected.id === record.id ? (
                                    <div className="mt-3 border-t border-border/70 pt-3">
                                        <CohortDetailPanel
                                            workspaceId={workspaceId}
                                            record={selected}
                                            onChanged={reload}
                                        />
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </CardContent>
        </Card>
    )
}
