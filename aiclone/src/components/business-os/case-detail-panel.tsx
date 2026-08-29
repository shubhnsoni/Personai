"use client"

import { useCallback, useEffect, useState } from "react"

import {
    type ApprovalView,
    type BriefView,
    type CaseEventView,
    type CaseView,
    type DeliverableView,
    type DocumentRequestView,
    type InvoiceView,
    type MilestoneView,
    type TaskView,
    caseErrorCopy,
    caseRequest,
    formatWhen,
    isAbort,
    money,
    titleCase,
} from "./cases-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    deliverableFlow,
    documentRequestFlow,
    invoiceFlow,
    milestoneFlow,
} from "@/lib/cases/lifecycle"

/**
 * Case/project detail: brief, milestones, document requests, deliverables, tasks,
 * approvals, billing state and the append-only timeline.
 *
 * Every list is persisted data fetched from /api/platform/cases/**. Allowed next
 * states come from the same lifecycle tables the server enforces, so the UI never
 * offers a transition the write boundary would refuse — and when it still refuses
 * (approval gating, missing document) the refusal is surfaced instead of hidden.
 */

type Bundle = Readonly<{
    brief: BriefView | null
    milestones: readonly MilestoneView[]
    documents: readonly DocumentRequestView[]
    deliverables: readonly DeliverableView[]
    tasks: readonly TaskView[]
    approvals: readonly ApprovalView[]
    invoices: readonly InvoiceView[]
    events: readonly CaseEventView[]
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

export function CaseDetailPanel({
    workspaceId,
    record,
    onChanged,
}: {
    workspaceId: string
    record: CaseView
    onChanged: () => void
}) {
    const [bundle, setBundle] = useState<Bundle | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [revision, setRevision] = useState(0)
    const [objectives, setObjectives] = useState("")

    const caseId = record.id
    const query = `workspaceId=${encodeURIComponent(workspaceId)}`
    const base = `/api/platform/cases/${encodeURIComponent(caseId)}`

    useEffect(() => {
        const controller = new AbortController()
        const options = { signal: controller.signal }
        setBundle(null)
        setError(null)
        Promise.all([
            caseRequest<{ brief: BriefView | null }>(`${base}/brief?${query}`, options),
            caseRequest<{ milestones: readonly MilestoneView[] }>(`${base}/milestones?${query}`, options),
            caseRequest<{ requests: readonly DocumentRequestView[] }>(`${base}/documents?${query}`, options),
            caseRequest<{ deliverables: readonly DeliverableView[] }>(`${base}/deliverables?${query}`, options),
            caseRequest<{ tasks: readonly TaskView[] }>(`${base}/tasks?${query}`, options),
            caseRequest<{ approvals: readonly ApprovalView[] }>(`${base}/approvals?${query}`, options),
            caseRequest<{ invoices: readonly InvoiceView[] }>(`${base}/invoices?${query}`, options),
            caseRequest<{ events: readonly CaseEventView[] }>(`${base}/timeline?${query}`, options),
        ])
            .then(([brief, milestones, documents, deliverables, tasks, approvals, invoices, timeline]) =>
                setBundle({
                    brief: brief.brief,
                    milestones: milestones.milestones,
                    documents: documents.requests,
                    deliverables: deliverables.deliverables,
                    tasks: tasks.tasks,
                    approvals: approvals.approvals,
                    invoices: invoices.invoices,
                    events: timeline.events,
                }),
            )
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [base, query, revision])

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
        const copy = caseErrorCopy(error)
        return <ErrorState title={copy.title} description={copy.description} />
    }

    if (!bundle) {
        return (
            <div className="space-y-2" aria-live="polite" aria-busy="true">
                <span className="sr-only">Loading case detail</span>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-5" aria-live="polite" aria-busy={busy ? "true" : "false"}>
            {actionError ? (
                <ErrorState
                    title={caseErrorCopy(actionError).title}
                    description={caseErrorCopy(actionError).description}
                />
            ) : null}

            <Section title="Brief">
                {bundle.brief ? (
                    <div className="rounded-lg border border-border/70 p-3 text-sm">
                        <p>{bundle.brief.objectives}</p>
                        {bundle.brief.scope ? (
                            <p className="mt-1 text-xs text-muted-foreground">Scope: {bundle.brief.scope}</p>
                        ) : null}
                        {bundle.brief.constraints ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Constraints: {bundle.brief.constraints}
                            </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                            {bundle.brief.agreedAt ? `Agreed ${formatWhen(bundle.brief.agreedAt)}` : "Not yet agreed"}
                        </p>
                    </div>
                ) : (
                    <Nothing label="No brief has been captured for this case yet." />
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1">
                        <Label htmlFor={`case-brief-${caseId}`}>Objectives</Label>
                        <Input
                            id={`case-brief-${caseId}`}
                            value={objectives}
                            onChange={(event) => setObjectives(event.target.value)}
                            placeholder={bundle.brief ? bundle.brief.objectives : "What must this engagement achieve?"}
                        />
                    </div>
                    <Button
                        size="sm"
                        disabled={busy === "brief" || !objectives.trim()}
                        onClick={() =>
                            mutate("brief", `${base}/brief`, "PUT", {
                                objectives,
                                scope: bundle.brief?.scope ?? null,
                                constraints: bundle.brief?.constraints ?? null,
                                agreed: Boolean(bundle.brief?.agreedAt),
                            })
                        }
                    >
                        {bundle.brief ? "Update brief" : "Capture brief"}
                    </Button>
                </div>
            </Section>

            <Section title="Milestones">
                {bundle.milestones.length === 0 ? (
                    <Nothing label="No milestones recorded." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.milestones.map((milestone) => (
                            <li key={milestone.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        {milestone.ordinal}. {milestone.title}
                                    </span>
                                    <Badge variant="secondary">{titleCase(milestone.status)}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">Due {formatWhen(milestone.dueAt)}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {milestoneFlow.allowedFrom(milestone.status as never).map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `milestone:${milestone.id}`}
                                            onClick={() =>
                                                mutate(
                                                    `milestone:${milestone.id}`,
                                                    `${base}/milestones/${encodeURIComponent(milestone.id)}`,
                                                    "PATCH",
                                                    { status: next },
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Document requests">
                {bundle.documents.length === 0 ? (
                    <Nothing label="No documents have been requested." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.documents.map((doc) => (
                            <li key={doc.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{doc.title}</span>
                                    <Badge variant="secondary">{titleCase(doc.status)}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Due {formatWhen(doc.dueAt)}
                                    {doc.documentId ? " · document attached" : " · no document attached"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {documentRequestFlow.allowedFrom(doc.status as never).map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `doc:${doc.id}` || (next === "RECEIVED" && !doc.documentId)}
                                            onClick={() =>
                                                mutate(
                                                    `doc:${doc.id}`,
                                                    `${base}/documents/${encodeURIComponent(doc.id)}`,
                                                    "PATCH",
                                                    { status: next, documentId: doc.documentId },
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                </div>
                                {doc.status === "REQUESTED" && !doc.documentId ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Marking this received needs an uploaded document; the server refuses an empty
                                        receipt.
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Deliverables">
                {bundle.deliverables.length === 0 ? (
                    <Nothing label="No deliverables recorded." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.deliverables.map((item) => (
                            <li key={item.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{item.title}</span>
                                    <Badge variant={item.status === "DELIVERED" ? "default" : "secondary"}>
                                        {titleCase(item.status)}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {item.deliveredAt ? `Delivered ${formatWhen(item.deliveredAt)}` : "Not delivered"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {deliverableFlow.allowedFrom(item.status as never).map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `deliverable:${item.id}`}
                                            onClick={() =>
                                                mutate(
                                                    `deliverable:${item.id}`,
                                                    `${base}/deliverables/${encodeURIComponent(item.id)}`,
                                                    "PATCH",
                                                    { status: next, documentId: item.documentId },
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                </div>
                                {item.status === "APPROVED" ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Delivery requires an approved approval record on this case.
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Linked tasks">
                {bundle.tasks.length === 0 ? (
                    <Nothing label="No background tasks are linked to this case." />
                ) : (
                    <ul className="space-y-1 text-sm">
                        {bundle.tasks.map((task) => (
                            <li key={task.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-xs">{task.id}</span>
                                <span className="text-xs text-muted-foreground">
                                    {task.state} · attempt {task.attempts}/{task.maxAttempts}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Approvals">
                {bundle.approvals.length === 0 ? (
                    <Nothing label="No approvals have been requested." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.approvals.map((approval) => (
                            <li key={approval.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{approval.reason ?? "Approval"}</span>
                                    <Badge variant={approval.state === "approved" ? "default" : "secondary"}>
                                        {approval.state}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Requested by {approval.requestedBy}
                                    {approval.decidedBy ? ` · decided by ${approval.decidedBy}` : ""}
                                </p>
                                {approval.state === "pending" ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {(["approved", "rejected"] as const).map((decision) => (
                                            <Button
                                                key={decision}
                                                size="sm"
                                                variant="outline"
                                                disabled={busy === `approval:${approval.id}`}
                                                onClick={() =>
                                                    mutate(
                                                        `approval:${approval.id}`,
                                                        `${base}/approvals/${encodeURIComponent(approval.id)}`,
                                                        "PATCH",
                                                        { decision, decidedBy: approval.requestedBy },
                                                    )
                                                }
                                            >
                                                {titleCase(decision)}
                                            </Button>
                                        ))}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Billing state">
                <p className="text-sm">
                    Case billing state: <Badge variant="secondary">{titleCase(record.invoiceState)}</Badge>
                </p>
                {bundle.invoices.length === 0 ? (
                    <Nothing label="No invoices recorded. No money is moved from this screen." />
                ) : (
                    <ul className="space-y-2">
                        {bundle.invoices.map((invoice) => (
                            <li key={invoice.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        {invoice.reference} · {money(invoice.amountCents, invoice.currency)}
                                    </span>
                                    <Badge variant={invoice.state === "PAID" ? "default" : "secondary"}>
                                        {titleCase(invoice.state)}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {invoice.paymentId
                                        ? `Linked payment ${invoice.paymentId}`
                                        : "No payment record linked"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {invoiceFlow.allowedFrom(invoice.state as never).map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `invoice:${invoice.id}`}
                                            onClick={() =>
                                                mutate(
                                                    `invoice:${invoice.id}`,
                                                    `${base}/invoices/${encodeURIComponent(invoice.id)}`,
                                                    "PATCH",
                                                    { state: next, paymentId: invoice.paymentId },
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
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
