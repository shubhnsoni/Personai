"use client"

import { useCallback, useEffect, useState } from "react"

import {
    type AssignmentView,
    type CohortEventView,
    type CohortView,
    type MembershipView,
    type ProgressView,
    type SessionView,
    cohortErrorCopy,
    cohortRequest,
    formatWhen,
    isAbort,
    titleCase,
} from "./cohorts-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ATTENDANCE_STATUSES } from "@/lib/cohorts/lifecycle"

/**
 * Cohort detail: members, sessions with attendance, assignments, per-learner progress,
 * certificate state, renewal state and the append-only timeline.
 *
 * Everything shown is persisted. Progress percentages are the server's derived values,
 * not recomputed here, so the screen cannot disagree with the record. Action buttons come
 * from server-computed `allowedTransitions`, so the UI never offers a move the write
 * boundary would refuse — and when it still refuses (an unmet completion policy) the
 * reason is surfaced verbatim because it tells the owner exactly what is missing.
 */

type Bundle = Readonly<{
    memberships: readonly MembershipView[]
    sessions: readonly SessionView[]
    assignments: readonly AssignmentView[]
    events: readonly CohortEventView[]
}>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
            {children}
        </section>
    )
}

function Nothing({ label }: { label: string }) {
    return <p className="text-xs text-muted-foreground">{label}</p>
}

export function CohortDetailPanel({
    workspaceId,
    record,
    onChanged,
}: {
    workspaceId: string
    record: CohortView
    onChanged: () => void
}) {
    const [bundle, setBundle] = useState<Bundle | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [revision, setRevision] = useState(0)
    const [openMember, setOpenMember] = useState("")
    const [progress, setProgress] = useState<ProgressView | null>(null)

    const query = `workspaceId=${encodeURIComponent(workspaceId)}`
    const base = `/api/platform/cohorts/${encodeURIComponent(record.id)}`

    useEffect(() => {
        const controller = new AbortController()
        const options = { signal: controller.signal }
        setBundle(null)
        setError(null)
        Promise.all([
            cohortRequest<{ memberships: readonly MembershipView[] }>(`${base}/memberships?${query}`, options),
            cohortRequest<{ sessions: readonly SessionView[] }>(`${base}/sessions?${query}`, options),
            cohortRequest<{ assignments: readonly AssignmentView[] }>(`${base}/assignments?${query}`, options),
            cohortRequest<{ events: readonly CohortEventView[] }>(`${base}/timeline?${query}`, options),
        ])
            .then(([memberships, sessions, assignments, timeline]) =>
                setBundle({
                    memberships: memberships.memberships,
                    sessions: sessions.sessions,
                    assignments: assignments.assignments,
                    events: timeline.events,
                }),
            )
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [base, query, revision])

    useEffect(() => {
        if (!openMember) {
            setProgress(null)
            return
        }
        const controller = new AbortController()
        setProgress(null)
        cohortRequest<{ progress: ProgressView }>(
            `${base}/memberships/${encodeURIComponent(openMember)}/progress?${query}`,
            { signal: controller.signal },
        )
            .then((data) => setProgress(data.progress))
            .catch((cause) => {
                if (isAbort(cause)) return
                setActionError(cause)
            })
        return () => controller.abort()
    }, [base, query, openMember, revision])

    const mutate = useCallback(
        async (key: string, url: string, method: string, payload: Record<string, unknown>) => {
            setBusy(key)
            setActionError(null)
            try {
                await cohortRequest(url, {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, ...payload }),
                })
                setRevision((value) => value + 1)
                onChanged()
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy("")
            }
        },
        [onChanged, workspaceId],
    )

    if (error) {
        const copy = cohortErrorCopy(error)
        return <ErrorState title={copy.title} description={copy.description} />
    }

    if (!bundle) {
        return (
            <div className="space-y-2" aria-live="polite" aria-busy="true">
                <span className="sr-only">Loading cohort detail</span>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    const liveMembers = bundle.memberships.filter((m) => m.status !== "WITHDRAWN")

    return (
        <div className="space-y-5" aria-live="polite" aria-busy={busy ? "true" : "false"}>
            {actionError ? (
                <ErrorState
                    title={cohortErrorCopy(actionError).title}
                    description={cohortErrorCopy(actionError).description}
                />
            ) : null}

            <Section title="Completion policy">
                <p className="text-xs text-muted-foreground">
                    {record.requireAllLessons ? "All lessons required" : "Lessons not required"} ·{" "}
                    {record.requireAllAssignments ? "All assignments required" : "Assignments not required"} ·{" "}
                    {record.attendanceThresholdPct > 0
                        ? `${record.attendanceThresholdPct}% attendance required`
                        : "No attendance requirement"}
                </p>
                <p className="text-xs text-muted-foreground">
                    {record.capacity === null
                        ? "No capacity limit"
                        : `${liveMembers.length} of ${record.capacity} places taken`}
                </p>
            </Section>

            <Section title="Members">
                {bundle.memberships.length === 0 ? (
                    <Nothing label="Nobody has joined this cohort yet. Enrol a learner on the program first, then add them here." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.memberships.map((member) => (
                            <li key={member.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{member.enrollment.visitorName ?? member.enrollment.visitorEmail}</span>
                                    <Badge variant={member.status === "COMPLETED" ? "default" : "secondary"}>
                                        {titleCase(member.status)}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {member.enrollment.visitorEmail} · joined {formatWhen(member.joinedAt)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Renewal {titleCase(member.renewalState)}
                                    {member.renewalDueAt ? ` · due ${formatWhen(member.renewalDueAt)}` : ""}
                                    {member.renewalTaskJobId
                                        ? " · reminder queued"
                                        : " · no reminder queued"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {member.allowedTransitions.map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `member:${member.id}`}
                                            onClick={() =>
                                                mutate(
                                                    `member:${member.id}`,
                                                    `${base}/memberships/${encodeURIComponent(member.id)}`,
                                                    "PATCH",
                                                    { status: next },
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-expanded={openMember === member.id}
                                        onClick={() => setOpenMember(openMember === member.id ? "" : member.id)}
                                    >
                                        {openMember === member.id ? "Hide progress" : "Show progress"}
                                    </Button>
                                </div>
                                {openMember === member.id ? (
                                    <div className="mt-2 border-t border-border/70 pt-2">
                                        {progress === null ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading learner progress</span>
                                                <Skeleton className="h-6 w-full" />
                                            </div>
                                        ) : (
                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                <p>
                                                    Lessons {progress.lessons.completedLessons}/
                                                    {progress.lessons.totalLessons} ({progress.lessons.percent}%) ·
                                                    assignments accepted {progress.assignments.acceptedSubmissions}/
                                                    {progress.assignments.totalAssignments} · attendance{" "}
                                                    {progress.attendance.creditedSessions}/
                                                    {progress.attendance.attendableSessions} (
                                                    {progress.attendance.percent}%)
                                                </p>
                                                <p>
                                                    {progress.eligible
                                                        ? "Meets the completion policy."
                                                        : `Not eligible: ${progress.reasons.join("; ")}`}
                                                </p>
                                                <p>
                                                    These figures are computed from recorded lesson completions,
                                                    accepted submissions and attendance. Nothing is estimated.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Sessions">
                {bundle.sessions.length === 0 ? (
                    <Nothing label="No sessions scheduled." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.sessions.map((session) => (
                            <li key={session.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        {session.ordinal}. {session.title}
                                    </span>
                                    <Badge variant={session.status === "HELD" ? "default" : "secondary"}>
                                        {titleCase(session.status)}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {formatWhen(session.startsAt)} – {formatWhen(session.endsAt)}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {session.allowedTransitions.map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `session:${session.id}`}
                                            onClick={() =>
                                                mutate(
                                                    `session:${session.id}`,
                                                    `${base}/sessions/${encodeURIComponent(session.id)}`,
                                                    "PATCH",
                                                    { status: next },
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                </div>
                                {session.status === "SCHEDULED" ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Attendance opens once this session is started; a session that has not happened
                                        cannot have attendance.
                                    </p>
                                ) : null}
                                {(session.status === "IN_PROGRESS" || session.status === "HELD") &&
                                liveMembers.length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                        {liveMembers.map((member) => (
                                            <div key={member.id} className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs">{member.enrollment.visitorEmail}</span>
                                                {ATTENDANCE_STATUSES.map((mark) => (
                                                    <Button
                                                        key={mark}
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy === `att:${session.id}:${member.id}`}
                                                        onClick={() =>
                                                            mutate(
                                                                `att:${session.id}:${member.id}`,
                                                                `${base}/sessions/${encodeURIComponent(session.id)}/attendance`,
                                                                "PUT",
                                                                { membershipId: member.id, status: mark },
                                                            )
                                                        }
                                                    >
                                                        {titleCase(mark)}
                                                    </Button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Assignments">
                {bundle.assignments.length === 0 ? (
                    <Nothing label="No assignments set." />
                ) : (
                    <ul className="space-y-1 text-sm">
                        {bundle.assignments.map((assignment) => (
                            <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                    {assignment.ordinal}. {assignment.title}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    due {formatWhen(assignment.dueAt)} · {assignment.maxPoints} points
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-xs text-muted-foreground">
                    Only an accepted submission counts towards completion. A draft or returned submission does not.
                </p>
            </Section>

            <Section title="Timeline">
                {bundle.events.length === 0 ? (
                    <Nothing label="No events recorded yet." />
                ) : (
                    <ol className="space-y-1 text-xs text-muted-foreground">
                        {bundle.events.map((event) => (
                            <li key={event.id}>
                                <span className="font-mono">#{event.seq}</span> {titleCase(event.kind)}{" "}
                                {event.from ? `${event.from} → ` : ""}
                                {event.to} · {event.actor} · {formatWhen(event.at)}
                            </li>
                        ))}
                    </ol>
                )}
            </Section>
        </div>
    )
}
