"use client"

import { Briefcase } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { CaseDetailPanel } from "./case-detail-panel"
import {
    type CaseView,
    type IntakeView,
    caseErrorCopy,
    caseRequest,
    formatWhen,
    isAbort,
    titleCase,
} from "./cases-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { intakeFlow } from "@/lib/cases/lifecycle"

/**
 * Owner-facing cases/projects panel.
 *
 * Every row is a persisted CaseIntake or CaseProject read through
 * /api/platform/case-intakes and /api/platform/cases. There is no sample case: an
 * empty workspace renders the empty state.
 *
 * Refusals are shown rather than swallowed. A foreign or nonexistent case produces
 * the same 403 copy, matching the non-enumerating server refusal.
 */

function statusVariant(status: string) {
    if (status === "CLOSED" || status === "DELIVERED" || status === "ACTIVE") return "default" as const
    if (status === "CANCELLED" || status === "DECLINED") return "destructive" as const
    return "secondary" as const
}

export function CasesPanel({ workspaceId }: { workspaceId: string }) {
    const [cases, setCases] = useState<readonly CaseView[] | null>(null)
    const [intakes, setIntakes] = useState<readonly IntakeView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [selectedId, setSelectedId] = useState("")
    const [revision, setRevision] = useState(0)
    const [intakeSource, setIntakeSource] = useState("")
    const [intakeSummary, setIntakeSummary] = useState("")

    const reload = useCallback(() => setRevision((value) => value + 1), [])

    useEffect(() => {
        if (!workspaceId) {
            setCases(null)
            setIntakes(null)
            return
        }
        const controller = new AbortController()
        const options = { signal: controller.signal }
        const query = `workspaceId=${encodeURIComponent(workspaceId)}`
        setCases(null)
        setIntakes(null)
        setError(null)
        Promise.all([
            caseRequest<{ cases: readonly CaseView[] }>(`/api/platform/cases?${query}`, options),
            caseRequest<{ intakes: readonly IntakeView[] }>(`/api/platform/case-intakes?${query}`, options),
        ])
            .then(([caseData, intakeData]) => {
                setCases(caseData.cases)
                setIntakes(intakeData.intakes)
            })
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    const mutate = useCallback(
        async (key: string, url: string, method: string, payload: Record<string, unknown>) => {
            setBusy(key)
            setActionError(null)
            try {
                await caseRequest(url, {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, ...payload }),
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

    const createIntake = useCallback(async () => {
        await mutate("intake:new", "/api/platform/case-intakes", "POST", {
            source: intakeSource,
            summary: intakeSummary,
        })
        setIntakeSource("")
        setIntakeSummary("")
    }, [intakeSource, intakeSummary, mutate])

    if (error) {
        const copy = caseErrorCopy(error)
        return (
            <Card>
                <CardContent>
                    <ErrorState title={copy.title} description={copy.description} />
                </CardContent>
            </Card>
        )
    }

    const selected = cases?.find((record) => record.id === selectedId) ?? null

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Cases and projects</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Persisted intakes, engagements, milestones, document requests, deliverables, approvals and
                    billing state. Tasks, approvals, documents and payments reuse the existing platform
                    records rather than a parallel copy.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {!workspaceId ? (
                    <EmptyState
                        icon={<Briefcase aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its cases and intakes."
                    />
                ) : null}

                {workspaceId && cases === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading cases and intakes</span>
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState
                        title={caseErrorCopy(actionError).title}
                        description={caseErrorCopy(actionError).description}
                    />
                ) : null}

                {intakes ? (
                    <section className="space-y-2">
                        <h4 className="text-sm font-semibold">Intakes</h4>
                        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                            <div className="space-y-1">
                                <Label htmlFor="case-intake-source">Source</Label>
                                <Input
                                    id="case-intake-source"
                                    value={intakeSource}
                                    onChange={(event) => setIntakeSource(event.target.value)}
                                    placeholder="referral"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="case-intake-summary">Summary</Label>
                                <Input
                                    id="case-intake-summary"
                                    value={intakeSummary}
                                    onChange={(event) => setIntakeSummary(event.target.value)}
                                    placeholder="What does this prospect need?"
                                />
                            </div>
                            <Button
                                disabled={busy === "intake:new" || !intakeSource.trim() || !intakeSummary.trim()}
                                onClick={createIntake}
                            >
                                Record intake
                            </Button>
                        </div>
                        {intakes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No intakes recorded. Nothing is shown until a real enquiry is captured.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {intakes.map((intake) => (
                                    <li key={intake.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span>{intake.summary}</span>
                                            <Badge variant={statusVariant(intake.status)}>
                                                {titleCase(intake.status)}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {intake.source} · {formatWhen(intake.createdAt)}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {intakeFlow
                                                .allowedFrom(intake.status as never)
                                                .filter((next) => next !== "CONVERTED")
                                                .map((next) => (
                                                    <Button
                                                        key={next}
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy === `intake:${intake.id}`}
                                                        onClick={() =>
                                                            mutate(
                                                                `intake:${intake.id}`,
                                                                `/api/platform/case-intakes/${encodeURIComponent(intake.id)}`,
                                                                "PATCH",
                                                                { status: next },
                                                            )
                                                        }
                                                    >
                                                        {titleCase(next)}
                                                    </Button>
                                                ))}
                                            {intake.status === "ACCEPTED" ? (
                                                <Button
                                                    size="sm"
                                                    disabled={busy === `intake:${intake.id}`}
                                                    onClick={() =>
                                                        mutate(
                                                            `intake:${intake.id}`,
                                                            `/api/platform/case-intakes/${encodeURIComponent(intake.id)}/convert`,
                                                            "POST",
                                                            {
                                                                reference: `CASE-${intake.id.slice(0, 8)}`,
                                                                title: intake.summary.slice(0, 120),
                                                            },
                                                        )
                                                    }
                                                >
                                                    Convert to case
                                                </Button>
                                            ) : null}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : null}

                {cases?.length === 0 ? (
                    <EmptyState
                        icon={<Briefcase aria-hidden="true" />}
                        title="No cases yet"
                        description="Cases appear here once an accepted intake is converted or a case is created directly. No sample cases are shown."
                    />
                ) : null}

                {cases && cases.length > 0 ? (
                    <section className="space-y-2">
                        <h4 className="text-sm font-semibold">Cases</h4>
                        <ul className="space-y-2">
                            {cases.map((record) => (
                                <li key={record.id} className="rounded-xl border border-border/70 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium">
                                            {record.reference} · {record.title}
                                        </span>
                                        <Badge variant={statusVariant(record.status)}>
                                            {titleCase(record.status)}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Billing {titleCase(record.invoiceState)} · opened{" "}
                                        {formatWhen(record.openedAt)}
                                        {record.contactId ? " · client linked" : " · no client linked"}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {record.allowedTransitions.map((next) => (
                                            <Button
                                                key={next}
                                                size="sm"
                                                variant="outline"
                                                disabled={busy === `case:${record.id}`}
                                                onClick={() =>
                                                    mutate(
                                                        `case:${record.id}`,
                                                        `/api/platform/cases/${encodeURIComponent(record.id)}`,
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
                                            aria-expanded={selectedId === record.id}
                                            onClick={() =>
                                                setSelectedId(selectedId === record.id ? "" : record.id)
                                            }
                                        >
                                            {selectedId === record.id ? "Hide detail" : "Show detail"}
                                        </Button>
                                    </div>
                                    {selected && selected.id === record.id ? (
                                        <div className="mt-3 border-t border-border/70 pt-3">
                                            <CaseDetailPanel
                                                workspaceId={workspaceId}
                                                record={selected}
                                                onChanged={reload}
                                            />
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </CardContent>
        </Card>
    )
}
