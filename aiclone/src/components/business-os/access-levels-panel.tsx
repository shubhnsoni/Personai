"use client"

import { KeyRound } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
    type AccessChangeView,
    type AccessConsoleView,
    type AccessCourseView,
    type AccessEventView,
    type AccessLevelView,
    cohortErrorCopy,
    cohortRequest,
    formatWhen,
    isAbort,
    tierPrice,
    titleCase,
} from "./cohorts-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing console for course access levels.
 *
 * Everything on this screen is a persisted row read through /api/platform/course-access. The
 * engine and the enforcement already existed; until now an owner had no way to define a tier or
 * grant an entitlement except by calling the engine directly.
 *
 * Three things this screen is careful to state rather than imply:
 *
 *   * A tier price DESCRIBES the tier. Nothing here or on the server charges anybody, and an
 *     upgrade is recorded after the owner has settled up somewhere else.
 *   * Visibility is computed on every read. There is no stored entitlement snapshot, because a
 *     cached answer would be a second source of truth about what a learner paid for.
 *   * Approving a tier change is not applying it. The entitlement does not move until apply runs.
 *
 * Every action button comes from the server's `allowedTransitions`. The panel never decides for
 * itself what is legal, and a record with no legal move says why instead of showing a dead button.
 */

const SELECT_CLASS = "h-8 rounded-md border border-border/70 bg-transparent px-2 text-sm"

/** Visible to everyone: the state every lesson starts in, and what removing a rule returns it to. */
const UNRESTRICTED = "__unrestricted__"

function grantVariant(state: string) {
    if (state === "ACTIVE") return "default" as const
    if (state === "REVOKED" || state === "EXPIRED") return "destructive" as const
    return "secondary" as const
}

function changeVariant(state: string) {
    if (state === "APPLIED") return "default" as const
    if (state === "REJECTED" || state === "CANCELLED") return "destructive" as const
    return "secondary" as const
}

export function AccessLevelsPanel({ workspaceId }: { workspaceId: string }) {
    const [courses, setCourses] = useState<readonly AccessCourseView[] | null>(null)
    const [courseId, setCourseId] = useState("")
    const [levels, setLevels] = useState<readonly AccessLevelView[] | null>(null)
    const [board, setBoard] = useState<AccessConsoleView | null>(null)
    const [events, setEvents] = useState<readonly AccessEventView[] | null>(null)
    const [changes, setChanges] = useState<readonly AccessChangeView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [openEnrolment, setOpenEnrolment] = useState("")
    const [revision, setRevision] = useState(0)

    const [tierKey, setTierKey] = useState("")
    const [tierLabel, setTierLabel] = useState("")
    const [tierRank, setTierRank] = useState("")
    const [tierPriceCents, setTierPriceCents] = useState("")

    const reload = useCallback(() => setRevision((value) => value + 1), [])

    useEffect(() => {
        if (!workspaceId) {
            setCourses(null)
            return
        }
        const controller = new AbortController()
        setCourses(null)
        setError(null)
        cohortRequest<{ courses: readonly AccessCourseView[] }>(
            `/api/platform/course-access/courses?workspaceId=${encodeURIComponent(workspaceId)}`,
            { signal: controller.signal },
        )
            .then((data) => setCourses(data.courses))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId])

    useEffect(() => {
        if (!workspaceId || !courseId) {
            setLevels(null)
            setBoard(null)
            setEvents(null)
            return
        }
        const controller = new AbortController()
        const scope = `workspaceId=${encodeURIComponent(workspaceId)}&courseId=${encodeURIComponent(courseId)}`
        setLevels(null)
        setBoard(null)
        setEvents(null)
        setActionError(null)
        cohortRequest<{ levels: readonly AccessLevelView[] }>(
            `/api/platform/course-access/levels?${scope}`,
            { signal: controller.signal },
        )
            .then((data) => setLevels(data.levels))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        cohortRequest<{ console: AccessConsoleView }>(`/api/platform/course-access/console?${scope}`, {
            signal: controller.signal,
        })
            .then((data) => setBoard(data.console))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        cohortRequest<{ events: readonly AccessEventView[] }>(
            `/api/platform/course-access/timeline?${scope}`,
            { signal: controller.signal },
        )
            .then((data) => setEvents(data.events))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, courseId, revision])

    const act = useCallback(
        async (token: string, run: () => Promise<unknown>) => {
            setBusy(token)
            setActionError(null)
            try {
                await run()
                reload()
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy("")
            }
        },
        [reload],
    )

    // Memoised so the action callbacks below do not get a fresh dependency on every render.
    const scope = useMemo(() => ({ workspaceId, courseId }), [workspaceId, courseId])

    const defineTier = useCallback(
        () =>
            act("define-tier", async () => {
                await cohortRequest("/api/platform/course-access/levels", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        ...scope,
                        key: tierKey,
                        label: tierLabel,
                        rank: Number(tierRank),
                        priceCents: tierPriceCents === "" ? null : Number(tierPriceCents),
                    }),
                })
                setTierKey("")
                setTierLabel("")
                setTierRank("")
                setTierPriceCents("")
            }),
        [act, scope, tierKey, tierLabel, tierRank, tierPriceCents],
    )

    const retireTier = useCallback(
        (levelId: string) =>
            act(`retire-${levelId}`, () =>
                cohortRequest(
                    `/api/platform/course-access/levels/${encodeURIComponent(levelId)}?workspaceId=${encodeURIComponent(workspaceId)}&courseId=${encodeURIComponent(courseId)}`,
                    { method: "DELETE" },
                ),
            ),
        [act, workspaceId, courseId],
    )

    const setRule = useCallback(
        (lessonId: string, value: string) =>
            act(`rule-${lessonId}`, () =>
                cohortRequest("/api/platform/course-access/lesson-rules", {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        ...scope,
                        lessonId,
                        accessLevelId: value === UNRESTRICTED ? null : value,
                    }),
                }),
            ),
        [act, scope],
    )

    const grantTier = useCallback(
        (enrollmentId: string, accessLevelId: string) =>
            act(`grant-${enrollmentId}`, () =>
                cohortRequest("/api/platform/course-access/grants", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ ...scope, enrollmentId, accessLevelId }),
                }),
            ),
        [act, scope],
    )

    const moveGrant = useCallback(
        (grantId: string, state: string) =>
            act(`grant-state-${grantId}`, () =>
                cohortRequest(`/api/platform/course-access/grants/${encodeURIComponent(grantId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ ...scope, state }),
                }),
            ),
        [act, scope],
    )

    const requestChange = useCallback(
        (grantId: string, toAccessLevelId: string) =>
            act(`change-${grantId}`, () =>
                cohortRequest(
                    `/api/platform/course-access/grants/${encodeURIComponent(grantId)}/changes`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ ...scope, toAccessLevelId }),
                    },
                ),
            ),
        [act, scope],
    )

    const decideChange = useCallback(
        (changeId: string, decision: string) =>
            act(`decide-${changeId}`, () =>
                cohortRequest(`/api/platform/course-access/changes/${encodeURIComponent(changeId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ ...scope, decision }),
                }),
            ),
        [act, scope],
    )

    const applyChange = useCallback(
        (changeId: string) =>
            act(`apply-${changeId}`, () =>
                cohortRequest(
                    `/api/platform/course-access/changes/${encodeURIComponent(changeId)}/apply`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(scope),
                    },
                ),
            ),
        [act, scope],
    )

    const openChanges = useCallback(
        async (enrollmentId: string, grantId: string | null) => {
            const next = openEnrolment === enrollmentId ? "" : enrollmentId
            setOpenEnrolment(next)
            setChanges(null)
            if (!next || !grantId) return
            try {
                const data = await cohortRequest<{ changes: readonly AccessChangeView[] }>(
                    `/api/platform/course-access/grants/${encodeURIComponent(grantId)}/changes?workspaceId=${encodeURIComponent(workspaceId)}&courseId=${encodeURIComponent(courseId)}`,
                )
                setChanges(data.changes)
            } catch (cause) {
                setActionError(cause)
            }
        },
        [openEnrolment, workspaceId, courseId],
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

    const activeLevels = levels?.filter((level) => level.isActive) ?? []

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Course access levels</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Tiers decide which lessons a learner may see. A lesson with no tier is visible to everyone, which
                    is where every lesson starts. A tier price describes the tier so you can label it — nothing here
                    charges anybody, and an upgrade is recorded after you have settled up somewhere else.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {!workspaceId ? (
                    <EmptyState
                        icon={<KeyRound aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to configure course access."
                    />
                ) : null}

                {workspaceId && courses === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading courses</span>
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : null}

                {courses?.length === 0 ? (
                    <EmptyState
                        icon={<KeyRound aria-hidden="true" />}
                        title="No courses yet"
                        description="Access levels attach to a course. None have been published in this workspace, and no sample courses are shown."
                    />
                ) : null}

                {courses && courses.length > 0 ? (
                    <div className="flex flex-wrap items-end gap-2">
                        <div>
                            <Label htmlFor="access-course" className="text-xs">
                                Course
                            </Label>
                            <select
                                id="access-course"
                                value={courseId}
                                onChange={(event) => {
                                    setCourseId(event.target.value)
                                    setOpenEnrolment("")
                                }}
                                className={SELECT_CLASS}
                            >
                                <option value="">Select a course</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title} — {course.lessonCount} lessons, {course.enrollmentCount} enrolled
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState
                        title={cohortErrorCopy(actionError).title}
                        description={cohortErrorCopy(actionError).description}
                    />
                ) : null}

                {courseId && (levels === null || board === null) ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading tiers, lessons and entitlements</span>
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : null}

                {/* ---- tiers ---------------------------------------------------- */}
                {courseId && levels ? (
                    <section className="space-y-3">
                        <h5 className="text-sm font-semibold">Tiers</h5>
                        {levels.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No tiers defined for this course, and no sample tiers are shown. Until you define one,
                                every lesson is visible to every enrolled learner.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {levels.map((level) => (
                                    <li key={level.id} className="rounded-xl border border-border/70 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-medium">
                                                {level.label} · rank {level.rank}
                                            </span>
                                            <Badge variant={level.isActive ? "default" : "secondary"}>
                                                {level.isActive ? "Offered" : "Retired"}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Key {level.key} · {tierPrice(level.priceCents, level.currency)}
                                            {level.description ? ` · ${level.description}` : ""}
                                        </p>
                                        {level.isActive ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy === `retire-${level.id}`}
                                                    onClick={() => retireTier(level.id)}
                                                >
                                                    Retire tier
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                This tier is retired and cannot be granted. Existing entitlements still
                                                resolve against it.
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Retiring a tier is refused while a learner still holds it, because removing it would either
                            orphan them or silently change what they can see.
                        </p>
                        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 p-3">
                            <div>
                                <Label htmlFor="tier-key" className="text-xs">
                                    Key
                                </Label>
                                <Input
                                    id="tier-key"
                                    value={tierKey}
                                    onChange={(event) => setTierKey(event.target.value)}
                                    className="h-8 w-28"
                                />
                            </div>
                            <div>
                                <Label htmlFor="tier-label" className="text-xs">
                                    Label
                                </Label>
                                <Input
                                    id="tier-label"
                                    value={tierLabel}
                                    onChange={(event) => setTierLabel(event.target.value)}
                                    className="h-8 w-36"
                                />
                            </div>
                            <div>
                                <Label htmlFor="tier-rank" className="text-xs">
                                    Rank
                                </Label>
                                <Input
                                    id="tier-rank"
                                    value={tierRank}
                                    onChange={(event) => setTierRank(event.target.value)}
                                    className="h-8 w-20"
                                />
                            </div>
                            <div>
                                <Label htmlFor="tier-price" className="text-xs">
                                    Price in cents (optional)
                                </Label>
                                <Input
                                    id="tier-price"
                                    value={tierPriceCents}
                                    onChange={(event) => setTierPriceCents(event.target.value)}
                                    className="h-8 w-32"
                                />
                            </div>
                            <Button
                                size="sm"
                                disabled={busy === "define-tier" || !tierKey || !tierLabel || !tierRank}
                                onClick={defineTier}
                            >
                                Define tier
                            </Button>
                            <p className="w-full text-xs text-muted-foreground">
                                Rank is what makes an upgrade and a downgrade derivable from the data, so it must be a
                                whole number of 1 or more and no two tiers on a course may share one.
                            </p>
                        </div>
                    </section>
                ) : null}

                {/* ---- lesson visibility --------------------------------------- */}
                {courseId && board ? (
                    <section className="space-y-3">
                        <h5 className="text-sm font-semibold">Lesson visibility</h5>
                        {board.modules.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                This course has no lessons yet, so there is nothing to gate. No sample lessons are
                                shown.
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {board.modules.map((module) => (
                                    <li key={module.id}>
                                        <p className="text-xs font-medium">{module.title}</p>
                                        {module.lessons.length === 0 ? (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                No lessons in this module.
                                            </p>
                                        ) : (
                                            <ul className="mt-1 space-y-1">
                                                {module.lessons.map((lesson) => (
                                                    <li
                                                        key={lesson.lessonId}
                                                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-2 py-1"
                                                    >
                                                        <span className="text-sm">{lesson.title}</span>
                                                        <span className="flex items-center gap-2">
                                                            <Label
                                                                htmlFor={`rule-${lesson.lessonId}`}
                                                                className="sr-only"
                                                            >
                                                                Minimum tier for {lesson.title}
                                                            </Label>
                                                            <select
                                                                id={`rule-${lesson.lessonId}`}
                                                                value={lesson.accessLevelId ?? UNRESTRICTED}
                                                                disabled={busy === `rule-${lesson.lessonId}`}
                                                                onChange={(event) =>
                                                                    setRule(lesson.lessonId, event.target.value)
                                                                }
                                                                className={SELECT_CLASS}
                                                            >
                                                                <option value={UNRESTRICTED}>
                                                                    Visible to everyone
                                                                </option>
                                                                {activeLevels.map((level) => (
                                                                    <option key={level.id} value={level.id}>
                                                                        {level.label} and above
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Visibility is computed on every read, not stored, so a change here takes effect immediately
                            and there is no snapshot to go stale.
                        </p>
                    </section>
                ) : null}

                {/* ---- entitlements ------------------------------------------- */}
                {courseId && board ? (
                    <section className="space-y-3">
                        <h5 className="text-sm font-semibold">Learner entitlements</h5>
                        {board.enrolments.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Nobody is enrolled on this course yet, and no sample learners are shown.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {board.enrolments.map((enrolment) => (
                                    <li
                                        key={enrolment.enrollmentId}
                                        className="rounded-xl border border-border/70 p-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-medium">
                                                {enrolment.visitorName ?? enrolment.visitorEmail}
                                            </span>
                                            {enrolment.grant ? (
                                                <Badge variant={grantVariant(enrolment.grant.state)}>
                                                    {enrolment.grant.accessLevelKey} ·{" "}
                                                    {titleCase(enrolment.grant.state)}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">No tier granted</Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Enrolment {titleCase(enrolment.status)}
                                            {enrolment.grant
                                                ? ` · ${enrolment.grant.entitles ? "entitled now" : "not entitled right now"}`
                                                : ""}
                                        </p>

                                        {!enrolment.grant && enrolment.entitlable && activeLevels.length > 0 ? (
                                            <div className="mt-2 flex flex-wrap items-end gap-2">
                                                <Label
                                                    htmlFor={`grant-${enrolment.enrollmentId}`}
                                                    className="sr-only"
                                                >
                                                    Tier to grant
                                                </Label>
                                                <select
                                                    id={`grant-${enrolment.enrollmentId}`}
                                                    defaultValue=""
                                                    disabled={busy === `grant-${enrolment.enrollmentId}`}
                                                    onChange={(event) =>
                                                        event.target.value &&
                                                        grantTier(enrolment.enrollmentId, event.target.value)
                                                    }
                                                    className={SELECT_CLASS}
                                                >
                                                    <option value="">Grant a tier…</option>
                                                    {activeLevels.map((level) => (
                                                        <option key={level.id} value={level.id}>
                                                            {level.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="text-xs text-muted-foreground">
                                                    Granting records the entitlement and notifies nobody.
                                                </span>
                                            </div>
                                        ) : null}

                                        {!enrolment.grant && !enrolment.entitlable ? (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                This enrolment is {titleCase(enrolment.status).toLowerCase()}, so a tier
                                                cannot be granted against it yet.
                                            </p>
                                        ) : null}

                                        {!enrolment.grant && enrolment.entitlable && activeLevels.length === 0 ? (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                Define a tier above before granting one.
                                            </p>
                                        ) : null}

                                        {enrolment.grant ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {enrolment.grant.allowedTransitions.map((next) => (
                                                    <Button
                                                        key={next}
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy === `grant-state-${enrolment.grant?.id ?? ""}`}
                                                        onClick={() =>
                                                            enrolment.grant && moveGrant(enrolment.grant.id, next)
                                                        }
                                                    >
                                                        {titleCase(next)}
                                                    </Button>
                                                ))}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    aria-expanded={openEnrolment === enrolment.enrollmentId}
                                                    onClick={() =>
                                                        openChanges(
                                                            enrolment.enrollmentId,
                                                            enrolment.grant?.id ?? null,
                                                        )
                                                    }
                                                >
                                                    {openEnrolment === enrolment.enrollmentId
                                                        ? "Hide tier changes"
                                                        : "Tier changes"}
                                                </Button>
                                            </div>
                                        ) : null}

                                        {enrolment.grant && enrolment.grant.allowedTransitions.length === 0 ? (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                This entitlement is {enrolment.grant.state.toLowerCase()} and cannot
                                                change.
                                            </p>
                                        ) : null}

                                        {openEnrolment === enrolment.enrollmentId && enrolment.grant ? (
                                            <div className="mt-3 border-t border-border/70 pt-3">
                                                {changes === null ? (
                                                    <div aria-live="polite" aria-busy="true">
                                                        <span className="sr-only">Loading tier changes</span>
                                                        <Skeleton className="h-10 w-full" />
                                                    </div>
                                                ) : changes.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        No tier changes requested yet.
                                                    </p>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {changes.map((change) => (
                                                            <li key={change.id} className="text-xs">
                                                                <span className="flex flex-wrap items-center gap-2">
                                                                    <Badge variant={changeVariant(change.state)}>
                                                                        {titleCase(change.direction)} ·{" "}
                                                                        {titleCase(change.state)}
                                                                    </Badge>
                                                                    {change.state === "REQUESTED" ? (
                                                                        <>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={
                                                                                    busy === `decide-${change.id}`
                                                                                }
                                                                                onClick={() =>
                                                                                    decideChange(
                                                                                        change.id,
                                                                                        "APPROVED",
                                                                                    )
                                                                                }
                                                                            >
                                                                                Approve
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={
                                                                                    busy === `decide-${change.id}`
                                                                                }
                                                                                onClick={() =>
                                                                                    decideChange(
                                                                                        change.id,
                                                                                        "REJECTED",
                                                                                    )
                                                                                }
                                                                            >
                                                                                Reject
                                                                            </Button>
                                                                        </>
                                                                    ) : null}
                                                                    {change.state === "APPROVED" ? (
                                                                        <Button
                                                                            size="sm"
                                                                            disabled={busy === `apply-${change.id}`}
                                                                            onClick={() => applyChange(change.id)}
                                                                        >
                                                                            Apply
                                                                        </Button>
                                                                    ) : null}
                                                                </span>
                                                                {change.decidedBy ? (
                                                                    <span className="mt-1 block text-muted-foreground">
                                                                        Decided by {change.decidedBy}{" "}
                                                                        {formatWhen(change.decidedAt)}
                                                                    </span>
                                                                ) : null}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {activeLevels.length > 1 ? (
                                                    <div className="mt-2 flex flex-wrap items-end gap-2">
                                                        <Label
                                                            htmlFor={`change-${enrolment.enrollmentId}`}
                                                            className="sr-only"
                                                        >
                                                            Tier to move to
                                                        </Label>
                                                        <select
                                                            id={`change-${enrolment.enrollmentId}`}
                                                            defaultValue=""
                                                            disabled={
                                                                busy === `change-${enrolment.grant?.id ?? ""}`
                                                            }
                                                            onChange={(event) =>
                                                                event.target.value &&
                                                                enrolment.grant &&
                                                                requestChange(
                                                                    enrolment.grant.id,
                                                                    event.target.value,
                                                                )
                                                            }
                                                            className={SELECT_CLASS}
                                                        >
                                                            <option value="">Request a move to…</option>
                                                            {activeLevels
                                                                .filter(
                                                                    (level) =>
                                                                        level.id !== enrolment.grant?.accessLevelId,
                                                                )
                                                                .map((level) => (
                                                                    <option key={level.id} value={level.id}>
                                                                        {level.label}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                ) : null}
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Whether a move is an upgrade or a downgrade is worked out from the
                                                    tier ranks by the server, not chosen here. Approving is not
                                                    applying: the entitlement does not move until you apply the
                                                    approved change, and applying records an invoice reference rather
                                                    than taking a payment.
                                                </p>
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : null}

                {/* ---- history ------------------------------------------------ */}
                {courseId ? (
                    <section className="space-y-2">
                        <h5 className="text-sm font-semibold">Access history</h5>
                        {events === null ? (
                            <div aria-live="polite" aria-busy="true">
                                <span className="sr-only">Loading access history</span>
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : events.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No access history recorded yet.</p>
                        ) : (
                            <ul className="space-y-1">
                                {events.map((event) => (
                                    <li key={event.id} className="text-xs text-muted-foreground">
                                        {titleCase(event.kind)} · {event.subjectType} ·{" "}
                                        {event.from ? `${event.from} → ` : ""}
                                        {event.to} · {formatWhen(event.at)}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-xs text-muted-foreground">
                            The history is append-only and enforced by the database, so nothing on this screen can
                            rewrite it.
                        </p>
                    </section>
                ) : null}
            </CardContent>
        </Card>
    )
}
