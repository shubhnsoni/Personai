"use client"

import { Wrench } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    fieldJobErrorCopy,
    fieldJobRequest,
    formatWhen,
    isAbort,
    money,
    titleCase,
    type FieldAssignmentView,
    type FieldEventView,
    type FieldJobView,
    type FieldRequestView,
} from "./fieldjobs-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner surface for field jobs: inbound requests, and the jobs somebody committed to.
 *
 * The honesty requirements this panel carries are all about what "dispatch" does not do:
 *
 *   - assigning a technician tells nobody. No email, SMS or push is sent, and the copy says so
 *     beside the assign control rather than in a footnote;
 *   - no route is planned and no travel time is estimated, so the panel offers no ordering, no
 *     map and no ETA;
 *   - the visit window is what an owner typed, not a slot the system found;
 *   - inspection is not built, so there is nothing here about parts, assets or completion notes,
 *     and the panel says that outright instead of leaving an owner hunting for it.
 *
 * Every action button renders from server-computed allowedTransitions, so the UI cannot offer a
 * move the engine would refuse - including the ones with side conditions, which is why a refusal
 * like "a job cannot be dispatched without an accountable lead technician" is shown verbatim.
 */

type Detail = Readonly<{ assignments: readonly FieldAssignmentView[] }>

function Nothing({ label }: { label: string }) {
    return <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">{label}</p>
}

export function FieldJobsPanel({ workspaceId }: { workspaceId: string }) {
    const [requests, setRequests] = useState<readonly FieldRequestView[] | null>(null)
    const [jobs, setJobs] = useState<readonly FieldJobView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [openJobId, setOpenJobId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Detail | null>(null)
    const [events, setEvents] = useState<readonly FieldEventView[] | null>(null)
    const [showEvents, setShowEvents] = useState(false)
    const [busy, setBusy] = useState(false)

    const [source, setSource] = useState("")
    const [summary, setSummary] = useState("")
    const [site, setSite] = useState("")
    const [resourceId, setResourceId] = useState("")

    const load = useCallback(
        async (signal?: AbortSignal) => {
            if (!workspaceId) {
                setRequests(null)
                setJobs(null)
                return
            }
            const query = `workspaceId=${encodeURIComponent(workspaceId)}`
            try {
                setError(null)
                const [r, j] = await Promise.all([
                    fieldJobRequest<{ requests: readonly FieldRequestView[] }>(`/api/platform/field-job-requests?${query}`, { signal }),
                    fieldJobRequest<{ jobs: readonly FieldJobView[] }>(`/api/platform/field-jobs?${query}`, { signal }),
                ])
                setRequests(r.requests)
                setJobs(j.jobs)
            } catch (cause) {
                if (isAbort(cause)) return
                setRequests(null)
                setJobs(null)
                setError(cause)
            }
        },
        [workspaceId],
    )

    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])

    const loadDetail = useCallback(
        async (jobId: string, signal?: AbortSignal) => {
            try {
                setActionError(null)
                const data = await fieldJobRequest<{ assignments: readonly FieldAssignmentView[] }>(
                    `/api/platform/field-jobs/${encodeURIComponent(jobId)}/assignments?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { signal },
                )
                setDetail({ assignments: data.assignments })
            } catch (cause) {
                if (isAbort(cause)) return
                setDetail(null)
                setActionError(cause)
            }
        },
        [workspaceId],
    )

    useEffect(() => {
        if (!openJobId) {
            setDetail(null)
            setEvents(null)
            setShowEvents(false)
            return
        }
        const controller = new AbortController()
        void loadDetail(openJobId, controller.signal)
        return () => controller.abort()
    }, [openJobId, loadDetail])

    const act = useCallback(
        async (run: () => Promise<unknown>) => {
            setBusy(true)
            setActionError(null)
            try {
                await run()
                await load()
                if (openJobId) await loadDetail(openJobId)
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy(false)
            }
        },
        [load, loadDetail, openJobId],
    )

    if (!workspaceId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h3>Field jobs</h3>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <EmptyState
                        icon={<Wrench aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its field work."
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Field jobs</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Requests, jobs and job cards. Assigning a technician records the assignment and tells nobody — no
                    email, SMS or push is sent. No route is planned and no travel time is estimated; the visit window is
                    what you type here. Inspection, parts and completion notes are not built yet, so nothing on this
                    panel covers them.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? <ErrorState title={fieldJobErrorCopy(error).title} description={fieldJobErrorCopy(error).description} /> : null}
                {actionError ? (
                    <ErrorState title={fieldJobErrorCopy(actionError).title} description={fieldJobErrorCopy(actionError).description} />
                ) : null}

                {requests === null && jobs === null && !error ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading requests and jobs</span>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}

                {/* ---- requests ---- */}
                {requests !== null ? (
                    <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requests</h5>
                        {requests.length === 0 ? (
                            <div className="mt-1">
                                <Nothing label="No requests yet, and no sample requests are shown." />
                            </div>
                        ) : (
                            <ul className="mt-1 space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                                {requests.map((request) => (
                                    <li key={request.id} className="rounded-md border border-border/70 p-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm">{request.summary}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    via {request.source} · {request.siteAddress ?? "no site address given"} ·{" "}
                                                    {request.estimateCents === null
                                                        ? "not quoted"
                                                        : `quoted ${money(request.estimateCents, request.currency)}`}
                                                </p>
                                            </div>
                                            <Badge variant="secondary">{titleCase(request.status)}</Badge>
                                        </div>
                                        {request.declineReason ? (
                                            <p className="mt-1 text-xs text-muted-foreground">Declined: {request.declineReason}</p>
                                        ) : null}
                                        <div className="mt-1 flex flex-wrap gap-2">
                                            {request.allowedTransitions
                                                .filter((next) => next !== "CONVERTED")
                                                .map((next) => (
                                                    <Button
                                                        key={next}
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void act(() =>
                                                                fieldJobRequest(
                                                                    `/api/platform/field-job-requests/${encodeURIComponent(request.id)}`,
                                                                    {
                                                                        method: "PATCH",
                                                                        headers: { "content-type": "application/json" },
                                                                        body: JSON.stringify({
                                                                            workspaceId,
                                                                            status: next,
                                                                            ...(next === "DECLINED" ? { reason: "Declined by owner" } : {}),
                                                                        }),
                                                                    },
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        {titleCase(next)}
                                                    </Button>
                                                ))}
                                            {request.status === "ACCEPTED" ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={busy || !request.siteAddress}
                                                    onClick={() =>
                                                        void act(() =>
                                                            fieldJobRequest(
                                                                `/api/platform/field-job-requests/${encodeURIComponent(request.id)}/convert`,
                                                                {
                                                                    method: "POST",
                                                                    headers: { "content-type": "application/json" },
                                                                    body: JSON.stringify({
                                                                        workspaceId,
                                                                        reference: `J-${request.id.slice(-6).toUpperCase()}`,
                                                                        title: request.summary.slice(0, 80),
                                                                    }),
                                                                },
                                                            ),
                                                        )
                                                    }
                                                >
                                                    Convert to a job
                                                </Button>
                                            ) : null}
                                            {request.status === "ACCEPTED" && !request.siteAddress ? (
                                                <p className="text-xs text-muted-foreground">
                                                    This request has no site address, so it cannot be converted until one is
                                                    recorded — a job with no address cannot be visited.
                                                </p>
                                            ) : null}
                                            {request.allowedTransitions.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">
                                                    This request is {request.status.toLowerCase()} and cannot change.
                                                </p>
                                            ) : null}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}

                {/* ---- jobs ---- */}
                {jobs !== null ? (
                    <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</h5>
                        {jobs.length === 0 ? (
                            <div className="mt-1">
                                <EmptyState
                                    icon={<Wrench aria-hidden="true" />}
                                    title="No jobs yet"
                                    description="A job is work somebody committed to. None exist, and no sample jobs are shown."
                                />
                            </div>
                        ) : (
                            <ul className="mt-1 space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                                {jobs.map((job) => (
                                    <li key={job.id} className="rounded-md border border-border/70 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {job.reference} · {job.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {job.siteAddress} ·{" "}
                                                    {job.isScheduled
                                                        ? `${formatWhen(job.scheduledStartAt)} to ${formatWhen(job.scheduledEndAt)}`
                                                        : "no visit window set"}
                                                    {job.estimateCents === null ? "" : ` · ${money(job.estimateCents, job.currency)}`}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{titleCase(job.priority)}</Badge>
                                                <Badge variant={job.status === "COMPLETED" ? "secondary" : "default"}>
                                                    {titleCase(job.status)}
                                                </Badge>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-expanded={openJobId === job.id}
                                                    onClick={() => setOpenJobId(openJobId === job.id ? null : job.id)}
                                                >
                                                    {openJobId === job.id ? "Hide" : "Open"}
                                                </Button>
                                            </div>
                                        </div>

                                        {!job.isScheduled ? (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                A job needs a visit window before it can be scheduled or dispatched —
                                                dispatching an undated job tells nobody when to turn up.
                                            </p>
                                        ) : null}
                                        {job.cancelReason ? (
                                            <p className="mt-1 text-xs text-muted-foreground">Cancelled: {job.cancelReason}</p>
                                        ) : null}

                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {job.allowedTransitions.map((next) => (
                                                <Button
                                                    key={next}
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void act(() =>
                                                            fieldJobRequest(`/api/platform/field-jobs/${encodeURIComponent(job.id)}`, {
                                                                method: "PATCH",
                                                                headers: { "content-type": "application/json" },
                                                                body: JSON.stringify({
                                                                    workspaceId,
                                                                    status: next,
                                                                    ...(next === "CANCELLED" ? { reason: "Cancelled by owner" } : {}),
                                                                }),
                                                            }),
                                                        )
                                                    }
                                                >
                                                    {titleCase(next)}
                                                </Button>
                                            ))}
                                            {job.allowedTransitions.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">
                                                    This job is {job.status.toLowerCase()} and cannot change.
                                                </p>
                                            ) : null}
                                        </div>

                                        {openJobId === job.id ? (
                                            <div className="mt-3 border-t border-border/70 pt-3">
                                                {detail === null && !actionError ? (
                                                    <div aria-live="polite" aria-busy="true">
                                                        <span className="sr-only">Loading job cards</span>
                                                        <Skeleton className="h-8 w-full" />
                                                    </div>
                                                ) : null}

                                                {detail ? (
                                                    <>
                                                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                            Job cards
                                                        </h5>
                                                        <div className="mt-1 space-y-2">
                                                            {detail.assignments.length === 0 ? (
                                                                <Nothing label="Nobody is assigned to this job yet." />
                                                            ) : (
                                                                detail.assignments.map((assignment) => (
                                                                    <div key={assignment.id} className="rounded-md border border-border/70 p-2">
                                                                        <p className="text-xs">
                                                                            {assignment.resourceName} · {titleCase(assignment.role)} ·{" "}
                                                                            {titleCase(assignment.state)} · assigned{" "}
                                                                            {formatWhen(assignment.assignedAt)}
                                                                        </p>
                                                                        {assignment.declineReason ? (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Declined: {assignment.declineReason}
                                                                            </p>
                                                                        ) : null}
                                                                        {assignment.releaseReason ? (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Released: {assignment.releaseReason}
                                                                            </p>
                                                                        ) : null}
                                                                        <div className="mt-1 flex flex-wrap gap-2">
                                                                            {assignment.allowedTransitions.map((next) => (
                                                                                <Button
                                                                                    key={next}
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    disabled={busy}
                                                                                    onClick={() =>
                                                                                        void act(() =>
                                                                                            fieldJobRequest(
                                                                                                `/api/platform/field-jobs/${encodeURIComponent(job.id)}/assignments/${encodeURIComponent(assignment.id)}`,
                                                                                                {
                                                                                                    method: "PATCH",
                                                                                                    headers: { "content-type": "application/json" },
                                                                                                    body: JSON.stringify({
                                                                                                        workspaceId,
                                                                                                        state: next,
                                                                                                        ...(next === "DECLINED" || next === "RELEASED"
                                                                                                            ? { reason: "Recorded by the office" }
                                                                                                            : {}),
                                                                                                    }),
                                                                                                },
                                                                                            ),
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {titleCase(next)}
                                                                                </Button>
                                                                            ))}
                                                                            {assignment.allowedTransitions.length === 0 ? (
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    This card is {assignment.state.toLowerCase()} and cannot
                                                                                    change.
                                                                                </p>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>

                                                        {job.allowedTransitions.length > 0 ? (
                                                            <div className="mt-3">
                                                                <Label htmlFor={`assign-${job.id}`} className="text-xs">
                                                                    Assign a technician by resource id
                                                                </Label>
                                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                    <Input
                                                                        id={`assign-${job.id}`}
                                                                        value={resourceId}
                                                                        onChange={(e) => setResourceId(e.target.value)}
                                                                        className="h-8 w-64"
                                                                    />
                                                                    {(["LEAD", "HELPER"] as const).map((role) => (
                                                                        <Button
                                                                            key={role}
                                                                            type="button"
                                                                            size="sm"
                                                                            disabled={busy || !resourceId.trim()}
                                                                            onClick={() =>
                                                                                void act(async () => {
                                                                                    await fieldJobRequest(
                                                                                        `/api/platform/field-jobs/${encodeURIComponent(job.id)}/assignments`,
                                                                                        {
                                                                                            method: "POST",
                                                                                            headers: { "content-type": "application/json" },
                                                                                            body: JSON.stringify({
                                                                                                workspaceId,
                                                                                                resourceId: resourceId.trim(),
                                                                                                role,
                                                                                            }),
                                                                                        },
                                                                                    )
                                                                                    setResourceId("")
                                                                                })
                                                                            }
                                                                        >
                                                                            Assign as {titleCase(role)}
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    A technician is an existing staff resource, so nobody is created
                                                                    here. Assigning records the job card and notifies nobody — the
                                                                    technician has to be told some other way. One lead per job,
                                                                    because two leads means nobody is accountable.
                                                                </p>
                                                            </div>
                                                        ) : null}

                                                        <div className="mt-3">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                aria-expanded={showEvents}
                                                                onClick={() => {
                                                                    const next = !showEvents
                                                                    setShowEvents(next)
                                                                    if (next && events === null) {
                                                                        void fieldJobRequest<{ events: readonly FieldEventView[] }>(
                                                                            `/api/platform/field-jobs/${encodeURIComponent(job.id)}/timeline?workspaceId=${encodeURIComponent(workspaceId)}`,
                                                                        )
                                                                            .then((d) => setEvents(d.events))
                                                                            .catch((cause) => setActionError(cause))
                                                                    }
                                                                }}
                                                            >
                                                                {showEvents ? "Hide history" : "Show history"}
                                                            </Button>
                                                            {showEvents ? (
                                                                events === null ? (
                                                                    <div aria-live="polite" aria-busy="true">
                                                                        <span className="sr-only">Loading job history</span>
                                                                        <Skeleton className="h-6 w-full" />
                                                                    </div>
                                                                ) : events.length === 0 ? (
                                                                    <Nothing label="No history recorded." />
                                                                ) : (
                                                                    <div className="mt-1 space-y-1">
                                                                        {events.map((event) => (
                                                                            <p key={event.id} className="text-xs text-muted-foreground">
                                                                                #{event.seq} · {event.subjectType} ·{" "}
                                                                                {event.from ? `${event.from} → ` : ""}
                                                                                {event.to} · {event.actor} · {formatWhen(event.at)}
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                )
                                                            ) : null}
                                                        </div>
                                                    </>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}

                {/* ---- new request ---- */}
                <div className="border-t border-border/70 pt-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New request</h5>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div>
                            <Label htmlFor="fj-source" className="text-xs">
                                Source
                            </Label>
                            <Input id="fj-source" value={source} onChange={(e) => setSource(e.target.value)} className="h-8 w-32" />
                        </div>
                        <div>
                            <Label htmlFor="fj-summary" className="text-xs">
                                Summary
                            </Label>
                            <Input id="fj-summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="h-8 w-56" />
                        </div>
                        <div>
                            <Label htmlFor="fj-site" className="text-xs">
                                Site address
                            </Label>
                            <Input id="fj-site" value={site} onChange={(e) => setSite(e.target.value)} className="h-8 w-56" />
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy || !source.trim() || !summary.trim()}
                            onClick={() =>
                                void act(async () => {
                                    await fieldJobRequest("/api/platform/field-job-requests", {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({
                                            workspaceId,
                                            source: source.trim(),
                                            summary: summary.trim(),
                                            ...(site.trim() ? { siteAddress: site.trim() } : {}),
                                        }),
                                    })
                                    setSource("")
                                    setSummary("")
                                    setSite("")
                                })
                            }
                        >
                            Record request
                        </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        A request is not a job. It stays a record whether it is declined or converted, so declining one
                        does not erase that somebody asked.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
