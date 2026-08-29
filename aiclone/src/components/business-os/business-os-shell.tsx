"use client"

import { useEffect, useMemo, useState } from "react"
import {
    Activity,
    Bot,
    CircleCheck,
    Clock3,
    Database,
    GitBranch,
    ListTodo,
    Play,
    RefreshCcw,
    ShieldCheck,
    Users,
    Workflow,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { ReservationsPanel } from "@/components/business-os/reservations-panel"
import { AppointmentsPanel } from "@/components/business-os/appointments-panel"
import { CasesPanel } from "@/components/business-os/cases-panel"
import { CohortsPanel } from "@/components/business-os/cohorts-panel"
import { CommercePanel } from "@/components/business-os/commerce-panel"
import { InventoryPanel } from "@/components/business-os/inventory-panel"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { businessEngineDescriptors } from "@/lib/business-os/engines"
import type { BusinessBlueprint, BusinessBlueprintStatus, EngineDescriptor } from "@/lib/business-os/types"
import type { ExecutionAuditEvent, ExecutionWorkflowRun } from "@/lib/copilot/execution"
import type { ApprovalReason } from "@/lib/copilot/runtime"

const APPROVAL_OPTIONS: ReadonlyArray<{ value: ApprovalReason; label: string }> = [
    { value: "financial_commitment", label: "Financial commitment" },
    { value: "external_communication", label: "External communication" },
    { value: "publish_change", label: "Publishing change" },
    { value: "sensitive_data", label: "Sensitive data" },
    { value: "bulk_change", label: "Bulk change" },
]

const EXECUTABLE_STATES = new Set(["queued", "planning", "awaiting_approval", "interrupted"])

type WorkspaceSummary = Readonly<{
    id: string
    profileId: string | null
    name: string
    slug: string
    role: string
    locationIds: readonly string[]
}>

type PersistedContactView = Readonly<{
    id: string
    workspaceId: string
    profileId: string | null
    displayName: string | null
    email: string | null
    phone: string | null
    confidence: string
    sources: readonly Readonly<{
        sourceKind: string
        sourceId: string
        profileId: string | null
        observedAt: string
    }>[]
    createdAt: string
    updatedAt: string
}>

type ActivityView = Readonly<{
    id: string
    contactId: string
    profileId: string | null
    type: string
    sourceKind: string
    sourceId: string
    occurredAt: string | null
    summary: string
    metadata: Readonly<Record<string, unknown>>
}>

type TaskView = Readonly<{
    id: string
    idempotencyKey: string | null
    payload: unknown
    state: string
    attempts: number
    maxAttempts: number
    nextAttemptAt: string
    leaseExpiresAt: string | null
    leaseToken: string | null
    lastError: string | null
    createdAt: string
    updatedAt: string
}>

type WorkspaceData = Readonly<{
    contacts: readonly PersistedContactView[]
    events: readonly ActivityView[]
    tasks: readonly TaskView[]
}>

type RunDetail = Readonly<{
    run: ExecutionWorkflowRun
    audit: readonly ExecutionAuditEvent[]
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

class ApiRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "ApiRequestError"
    }
}

async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = await response.json() as ApiEnvelope<T>
    } catch {
        throw new ApiRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new ApiRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError"
}

function statusVariant(status: BusinessBlueprintStatus) {
    if (status === "active") return "default" as const
    if (status === "deprecated") return "destructive" as const
    return "secondary" as const
}

function runVariant(state: string) {
    if (state === "completed") return "default" as const
    if (state === "failed" || state === "cancelled" || state === "interrupted") return "destructive" as const
    return "secondary" as const
}

function capabilityLabel(engineId: BusinessBlueprint["engines"][number]["engineId"], capabilityId: string) {
    const engine = businessEngineDescriptors[engineId]
    return engine.capabilities.find((capability) => capability.id === capabilityId)?.label ?? capabilityId
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "Not recorded"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "Invalid timestamp" : parsed.toLocaleString()
}

function taskLabel(task: TaskView): string {
    if (task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)) {
        const title = (task.payload as Record<string, unknown>).title
        if (typeof title === "string" && title.trim()) return title
        const kind = (task.payload as Record<string, unknown>).kind
        if (typeof kind === "string" && kind.trim()) return kind
    }
    return "Durable task"
}

function errorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof ApiRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) return { title: "Business OS access required", description: error.message }
        return { title: `${error.code} (${error.status})`, description: error.message }
    }
    return { title: "Business OS data is unavailable", description: "The persisted APIs could not be reached." }
}

function LoadingRows({ label }: { label: string }) {
    return (
        <div className="space-y-2 py-3" aria-busy="true" aria-label={label}>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-4/5 rounded-xl" />
        </div>
    )
}

export function BusinessOsShell({
    blueprints,
    engines,
    activeProfileId = null,
}: {
    blueprints: BusinessBlueprint[]
    engines: EngineDescriptor[]
    activeProfileId?: string | null
}) {
    const [revision, setRevision] = useState(0)
    const [workspaces, setWorkspaces] = useState<readonly WorkspaceSummary[] | null>(null)
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
    const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null)
    const [runs, setRuns] = useState<readonly ExecutionWorkflowRun[] | null>(null)
    const [selectedRunId, setSelectedRunId] = useState("")
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null)
    const [selectedContactId, setSelectedContactId] = useState("")
    const [fatalError, setFatalError] = useState<unknown>(null)
    const [workspaceError, setWorkspaceError] = useState<unknown>(null)
    const [runError, setRunError] = useState<unknown>(null)
    const [busyAction, setBusyAction] = useState("")
    const [taskTitle, setTaskTitle] = useState("")
    const [approvalNote, setApprovalNote] = useState("")
    const [approvalReason, setApprovalReason] = useState<ApprovalReason>("external_communication")

    const workflowOptions = useMemo(
        () => blueprints.flatMap((blueprint) =>
            blueprint.workflows.map((workflow) => ({
                key: `${blueprint.id}/${workflow.id}`,
                blueprint,
                workflow,
                requiresApproval: workflow.actions.some((action) => action.approval?.required),
            })),
        ),
        [blueprints],
    )
    const [selectedWorkflowKey, setSelectedWorkflowKey] = useState(workflowOptions[0]?.key ?? "")
    const selectedWorkflow = workflowOptions.find((option) => option.key === selectedWorkflowKey) ?? workflowOptions[0]

    const usage = useMemo(() => {
        const counts = new Map<string, number>()
        for (const blueprint of blueprints) {
            for (const engine of blueprint.engines) {
                counts.set(engine.engineId, (counts.get(engine.engineId) ?? 0) + 1)
            }
        }
        return counts
    }, [blueprints])

    useEffect(() => {
        const controller = new AbortController()
        setFatalError(null)
        Promise.all([
            apiRequest<{ workspaces: readonly WorkspaceSummary[] }>("/api/platform/workspaces", { signal: controller.signal }),
            apiRequest<{ runs: readonly ExecutionWorkflowRun[] }>("/api/copilot/runs", { signal: controller.signal }),
        ]).then(([workspaceResponse, runResponse]) => {
            setWorkspaces(workspaceResponse.workspaces)
            setRuns(runResponse.runs)
            setSelectedWorkspaceId((current) => {
                if (current && workspaceResponse.workspaces.some((workspace) => workspace.id === current)) return current
                return workspaceResponse.workspaces.find((workspace) => workspace.profileId === activeProfileId)?.id
                    ?? workspaceResponse.workspaces[0]?.id
                    ?? ""
            })
            setSelectedRunId((current) => {
                if (current && runResponse.runs.some((run) => run.id === current)) return current
                return runResponse.runs[0]?.id ?? ""
            })
        }).catch((error: unknown) => {
            if (!isAbortError(error)) setFatalError(error)
        })
        return () => controller.abort()
    }, [activeProfileId, revision])

    useEffect(() => {
        if (!selectedWorkspaceId) {
            setWorkspaceData({ contacts: [], events: [], tasks: [] })
            return
        }
        const controller = new AbortController()
        setWorkspaceData(null)
        setWorkspaceError(null)
        const query = encodeURIComponent(selectedWorkspaceId)
        Promise.all([
            apiRequest<{ contacts: readonly PersistedContactView[] }>(`/api/platform/contacts?workspaceId=${query}`, { signal: controller.signal }),
            apiRequest<{ events: readonly ActivityView[] }>(`/api/platform/activities?workspaceId=${query}`, { signal: controller.signal }),
            apiRequest<{ tasks: readonly TaskView[] }>(`/api/platform/tasks?workspaceId=${query}`, { signal: controller.signal }),
        ]).then(([contactResponse, activityResponse, taskResponse]) => {
            setWorkspaceData({
                contacts: contactResponse.contacts,
                events: activityResponse.events,
                tasks: taskResponse.tasks,
            })
            setSelectedContactId((current) => {
                if (current && contactResponse.contacts.some((contact) => contact.id === current)) return current
                return contactResponse.contacts[0]?.id ?? ""
            })
        }).catch((error: unknown) => {
            if (!isAbortError(error)) setWorkspaceError(error)
        })
        return () => controller.abort()
    }, [revision, selectedWorkspaceId])

    useEffect(() => {
        if (!selectedRunId) {
            setRunDetail(null)
            return
        }
        const controller = new AbortController()
        setRunDetail(null)
        setRunError(null)
        apiRequest<RunDetail>(`/api/copilot/runs/${encodeURIComponent(selectedRunId)}`, { signal: controller.signal })
            .then(setRunDetail)
            .catch((error: unknown) => {
                if (!isAbortError(error)) setRunError(error)
            })
        return () => controller.abort()
    }, [revision, selectedRunId])

    async function perform(name: string, operation: () => Promise<void>) {
        setBusyAction(name)
        try {
            await operation()
        } catch (error) {
            setRunError(error)
        } finally {
            setBusyAction("")
        }
    }

    async function createTask() {
        if (!selectedWorkspaceId || !taskTitle.trim()) return
        await perform("task", async () => {
            await apiRequest<{ task: TaskView }>("/api/platform/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    workspaceId: selectedWorkspaceId,
                    payload: {
                        kind: "OWNER_FOLLOW_UP",
                        title: taskTitle.trim(),
                        source: "business-os-console",
                    },
                    idempotencyKey: `business-os:${crypto.randomUUID()}`,
                    maxAttempts: 3,
                }),
            })
            setTaskTitle("")
            setRevision((value) => value + 1)
        })
    }

    async function startWorkflow() {
        if (!selectedWorkflow) return
        await perform("start", async () => {
            const data = await apiRequest<{ created: boolean; run: ExecutionWorkflowRun }>("/api/copilot/runs", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    workflowKey: selectedWorkflow.key,
                    workflowName: selectedWorkflow.workflow.name,
                    idempotencyKey: `business-os:${crypto.randomUUID()}`,
                    ...(selectedWorkflow.requiresApproval ? { approvalReason } : {}),
                }),
            })
            setRuns((current) => [data.run, ...(current ?? []).filter((run) => run.id !== data.run.id)])
            setSelectedRunId(data.run.id)
            setRevision((value) => value + 1)
        })
    }

    async function decideApproval(runId: string, approvalId: string, decision: "grant" | "reject") {
        await perform(`approval:${approvalId}`, async () => {
            await apiRequest<{ run: ExecutionWorkflowRun }>(
                `/api/copilot/runs/${encodeURIComponent(runId)}/approvals/${encodeURIComponent(approvalId)}`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ decision, note: approvalNote.trim() || undefined }),
                },
            )
            setApprovalNote("")
            setRevision((value) => value + 1)
        })
    }

    async function executeAuditStep(run: ExecutionWorkflowRun) {
        const workspace = workspaces?.find((candidate) => candidate.id === selectedWorkspaceId)
        await perform(`execute:${run.id}`, async () => {
            await apiRequest(`/api/copilot/runs/${encodeURIComponent(run.id)}/execute`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    actionKey: "recordAudit",
                    agentKey: "business-os-owner-copilot",
                    stepLabel: "Record owner-reviewed workflow run",
                    toolName: "recordAudit",
                    input: {
                        workspaceId: workspace?.id ?? null,
                        workspaceName: workspace?.name ?? null,
                        workflowKey: run.workflowKey,
                        source: "business-os-console",
                    },
                }),
            })
            setRevision((value) => value + 1)
        })
    }

    const selectedWorkspace = workspaces?.find((workspace) => workspace.id === selectedWorkspaceId)
    const selectedContact = workspaceData?.contacts.find((contact) => contact.id === selectedContactId)
    const visibleEvents = selectedContactId
        ? workspaceData?.events.filter((event) => event.contactId === selectedContactId) ?? []
        : workspaceData?.events ?? []
    const selectedRun = runDetail?.run
    const pendingApprovals = selectedRun?.approvals.filter((approval) => approval.state === "pending") ?? []
    const canExecute = Boolean(selectedRun
        && EXECUTABLE_STATES.has(selectedRun.state)
        && pendingApprovals.length === 0
        && !selectedRun.approvals.some((approval) => approval.state === "rejected"))

    const fatalCopy = fatalError ? errorCopy(fatalError) : null
    const workspaceCopy = workspaceError ? errorCopy(workspaceError) : null
    const runCopy = runError ? errorCopy(runError) : null

    return (
        <div className="flex-1 space-y-6">
            <PageHeader
                title="Business OS"
                description="Persisted workspaces, customer context, durable tasks, and owner-reviewed Copilot runs."
                actions={
                    <Button type="button" variant="outline" onClick={() => setRevision((value) => value + 1)}>
                        <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Refresh
                    </Button>
                }
            />

            <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                Workspace counts and run history below come from persisted APIs. Built-in blueprints remain declared
                configuration and are not executed yet as full automation; this console can create durable run records,
                decide approval gates, and execute only the server-owned <code>recordAudit</code> action.
            </p>

            {fatalCopy ? (
                <Card>
                    <CardContent>
                        <ErrorState
                            title={fatalCopy.title}
                            description={fatalCopy.description}
                            action={<Button onClick={() => setRevision((value) => value + 1)}>Try again</Button>}
                        />
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Persisted workspaces", value: workspaces?.length, detail: "authorized memberships", icon: Database },
                            { label: "Persisted contacts", value: workspaceData?.contacts.length, detail: selectedWorkspace?.name ?? "select a workspace", icon: Users },
                            { label: "Durable tasks", value: workspaceData?.tasks.length, detail: "tenant-scoped queue records", icon: ListTodo },
                            { label: "Copilot runs", value: runs?.length, detail: "active profile provenance", icon: Bot },
                        ].map((stat) => (
                            <Card key={stat.label}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium"><h3>{stat.label}</h3></CardTitle>
                                    <stat.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value ?? "—"}</div>
                                    <p className="text-xs text-muted-foreground">{stat.detail}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle><h3>Workspace scope</h3></CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">Every collection below is fetched through membership and permission checks.</p>
                            </div>
                            {workspaces && workspaces.length > 0 ? (
                                <div className="space-y-1.5">
                                    <Label htmlFor="business-os-workspace">Workspace</Label>
                                    <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                                        <SelectTrigger id="business-os-workspace" className="w-full min-w-56 sm:w-72">
                                            <SelectValue placeholder="Choose a workspace" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {workspaces.map((workspace) => (
                                                <SelectItem key={workspace.id} value={workspace.id}>
                                                    {workspace.name} · {workspace.role.toLowerCase()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : null}
                        </CardHeader>
                        <CardContent>
                            {workspaces === null ? <LoadingRows label="Loading persisted workspaces" /> : null}
                            {workspaces?.length === 0 ? (
                                <EmptyState
                                    icon={<Database aria-hidden="true" />}
                                    title="No persisted workspace yet"
                                    description="Complete authenticated onboarding to create an owner workspace. No sample workspace is shown in its place."
                                />
                            ) : null}
                            {selectedWorkspace ? (
                                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                    <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{selectedWorkspace.name}</dd></div>
                                    <div><dt className="text-muted-foreground">Slug</dt><dd className="font-mono text-xs">{selectedWorkspace.slug}</dd></div>
                                    <div><dt className="text-muted-foreground">Role</dt><dd className="font-medium">{selectedWorkspace.role}</dd></div>
                                    <div><dt className="text-muted-foreground">Locations</dt><dd className="font-medium">{selectedWorkspace.locationIds.length || "All workspace"}</dd></div>
                                </dl>
                            ) : null}
                        </CardContent>
                    </Card>

                    {workspaceCopy ? (
                        <Card><CardContent><ErrorState title={workspaceCopy.title} description={workspaceCopy.description} /></CardContent></Card>
                    ) : selectedWorkspace ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle><h3>Contacts</h3></CardTitle>
                                    <p className="text-sm text-muted-foreground">Resolved from persisted tenant-owned sources.</p>
                                </CardHeader>
                                <CardContent>
                                    {workspaceData === null ? <LoadingRows label="Loading persisted contacts" /> : null}
                                    {workspaceData?.contacts.length === 0 ? (
                                        <EmptyState icon={<Users aria-hidden="true" />} title="No contacts yet" description="Contacts appear after a real booking, order, conversation, enrollment, member, or profile source is ingested." />
                                    ) : null}
                                    <div className="space-y-2">
                                        {workspaceData?.contacts.map((contact) => (
                                            <button
                                                key={contact.id}
                                                type="button"
                                                onClick={() => setSelectedContactId(contact.id)}
                                                aria-pressed={selectedContactId === contact.id}
                                                className="w-full rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:bg-muted/40 aria-pressed:border-primary"
                                            >
                                                <span className="block font-medium">{contact.displayName || contact.email || contact.phone || "Unnamed contact"}</span>
                                                <span className="block text-xs text-muted-foreground">{contact.email || "No email"} · {contact.sources.length} source{contact.sources.length === 1 ? "" : "s"}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedContact ? (
                                        <dl className="mt-4 grid gap-2 rounded-xl bg-muted/30 p-3 text-xs sm:grid-cols-2">
                                            <div><dt className="text-muted-foreground">Confidence</dt><dd>{selectedContact.confidence}</dd></div>
                                            <div><dt className="text-muted-foreground">Updated</dt><dd>{formatDate(selectedContact.updatedAt)}</dd></div>
                                            <div className="sm:col-span-2"><dt className="text-muted-foreground">Source types</dt><dd>{selectedContact.sources.map((source) => source.sourceKind).join(" · ")}</dd></div>
                                        </dl>
                                    ) : null}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle><h3>Activity timeline</h3></CardTitle>
                                    <p className="text-sm text-muted-foreground">{selectedContact ? `Filtered to ${selectedContact.displayName || selectedContact.email || "selected contact"}.` : "Select a contact to filter."}</p>
                                </CardHeader>
                                <CardContent>
                                    {workspaceData === null ? <LoadingRows label="Loading persisted activity" /> : null}
                                    {workspaceData && visibleEvents.length === 0 ? (
                                        <EmptyState icon={<Activity aria-hidden="true" />} title="No activity recorded" description="No persisted events match this workspace and contact scope." />
                                    ) : null}
                                    <ol className="space-y-3">
                                        {visibleEvents.map((event) => (
                                            <li key={event.id} className="border-l-2 border-border pl-3">
                                                <p className="text-sm font-medium">{event.summary}</p>
                                                <p className="text-xs text-muted-foreground">{event.type} · {formatDate(event.occurredAt)}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle><h3>Durable tasks</h3></CardTitle>
                                    <p className="text-sm text-muted-foreground">Queue records are persisted; this view does not claim a worker is running.</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <div className="flex-1 space-y-1.5">
                                            <Label htmlFor="business-os-task">Follow-up task</Label>
                                            <Input id="business-os-task" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Call the customer about…" />
                                        </div>
                                        <Button className="sm:self-end" onClick={createTask} disabled={!taskTitle.trim() || busyAction === "task"}>
                                            Queue task
                                        </Button>
                                    </div>
                                    {workspaceData === null ? <LoadingRows label="Loading durable tasks" /> : null}
                                    {workspaceData?.tasks.length === 0 ? (
                                        <EmptyState icon={<ListTodo aria-hidden="true" />} title="No durable tasks" description="Queue a real owner follow-up; no sample tasks are inserted." />
                                    ) : null}
                                    <ul className="space-y-2">
                                        {workspaceData?.tasks.map((task) => (
                                            <li key={task.id} className="rounded-xl border border-border/70 p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="font-medium">{taskLabel(task)}</span>
                                                    <Badge variant={task.state === "SUCCEEDED" ? "default" : task.state === "DEAD_LETTERED" ? "destructive" : "secondary"}>{task.state}</Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">attempt {task.attempts}/{task.maxAttempts} · updated {formatDate(task.updatedAt)}</p>
                                                {task.lastError ? <p className="mt-1 text-xs text-destructive">{task.lastError}</p> : null}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            <ReservationsPanel workspaceId={selectedWorkspaceId} />

                            <AppointmentsPanel workspaceId={selectedWorkspaceId} />

                            <CasesPanel workspaceId={selectedWorkspaceId} />

                            <CohortsPanel workspaceId={selectedWorkspaceId} />

                            <InventoryPanel workspaceId={selectedWorkspaceId} />

                            <CommercePanel
                                workspaceId={selectedWorkspaceId}
                                locationId={selectedWorkspace?.locationIds[0] ?? ""}
                            />

                            <Card>
                                <CardHeader>
                                    <CardTitle><h3>Create a Copilot run record</h3></CardTitle>
                                    <p className="text-sm text-muted-foreground">This persists workflow intent and approval provenance; it does not execute unsupported blueprint actions.</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {workflowOptions.length === 0 ? (
                                        <EmptyState icon={<Workflow aria-hidden="true" />} title="No declared workflows" description="No blueprint workflow is available to record." />
                                    ) : (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="business-os-workflow">Declared workflow</Label>
                                                <Select value={selectedWorkflow?.key} onValueChange={setSelectedWorkflowKey}>
                                                    <SelectTrigger id="business-os-workflow" className="w-full">
                                                        <SelectValue placeholder="Choose a workflow" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {workflowOptions.map((option) => (
                                                            <SelectItem key={option.key} value={option.key}>{option.blueprint.name} · {option.workflow.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {selectedWorkflow?.requiresApproval ? (
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="business-os-approval-reason">Approval reason</Label>
                                                    <Select value={approvalReason} onValueChange={(value) => setApprovalReason(value as ApprovalReason)}>
                                                        <SelectTrigger id="business-os-approval-reason" className="w-full"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {APPROVAL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : null}
                                            <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                                                Declared actions: {selectedWorkflow?.workflow.actions.map((action) => action.label).join(" · ")}
                                            </div>
                                            <Button onClick={startWorkflow} disabled={busyAction === "start" || !selectedWorkflow}>
                                                <Workflow className="mr-2 h-4 w-4" aria-hidden="true" />
                                                Create durable run
                                            </Button>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle><h3>Copilot runs and audit provenance</h3></CardTitle>
                            <p className="text-sm text-muted-foreground">Runs are profile-scoped and every approval, agent, step, tool call, and state transition is persisted.</p>
                        </CardHeader>
                        <CardContent>
                            {runs === null ? <LoadingRows label="Loading Copilot runs" /> : null}
                            {runs?.length === 0 ? (
                                <EmptyState icon={<Bot aria-hidden="true" />} title="No Copilot runs" description="Create a durable run from a declared workflow. No demo history is shown." />
                            ) : null}
                            {runs && runs.length > 0 ? (
                                <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,2fr)]">
                                    <div className="space-y-2" aria-label="Persisted Copilot runs">
                                        {runs.map((run) => (
                                            <button
                                                key={run.id}
                                                type="button"
                                                onClick={() => setSelectedRunId(run.id)}
                                                aria-pressed={selectedRunId === run.id}
                                                className="w-full rounded-xl border border-border/70 p-3 text-left aria-pressed:border-primary aria-pressed:bg-muted/40"
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="font-medium">{run.workflowName}</span>
                                                    <Badge variant={runVariant(run.state)}>{run.state}</Badge>
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="min-w-0 rounded-xl border border-border/70 p-4">
                                        {runError && runCopy ? <ErrorState title={runCopy.title} description={runCopy.description} /> : null}
                                        {!runError && selectedRunId && !runDetail ? <LoadingRows label="Loading run provenance" /> : null}
                                        {selectedRun ? (
                                            <div className="space-y-5">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <h4 className="font-semibold">{selectedRun.workflowName}</h4>
                                                        <p className="font-mono text-xs text-muted-foreground">{selectedRun.id}</p>
                                                    </div>
                                                    <Badge variant={runVariant(selectedRun.state)}>{selectedRun.state}</Badge>
                                                </div>

                                                {selectedRun.approvals.length > 0 ? (
                                                    <section aria-labelledby="business-os-approvals" className="space-y-3">
                                                        <h5 id="business-os-approvals" className="text-sm font-semibold">Approvals</h5>
                                                        <div className="space-y-2">
                                                            {selectedRun.approvals.map((approval) => (
                                                                <div key={approval.id} className="rounded-xl bg-muted/30 p-3">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <span className="text-sm font-medium">{approval.reason.replaceAll("_", " ")}</span>
                                                                        <Badge variant={approval.state === "granted" ? "default" : approval.state === "rejected" ? "destructive" : "secondary"}>{approval.state}</Badge>
                                                                    </div>
                                                                    <p className="mt-1 text-xs text-muted-foreground">requested {formatDate(approval.requestedAt)}{approval.decidedAt ? ` · decided ${formatDate(approval.decidedAt)}` : ""}</p>
                                                                    {approval.state === "pending" ? (
                                                                        <div className="mt-3 space-y-2">
                                                                            <Label htmlFor={`approval-note-${approval.id}`}>Decision note (optional)</Label>
                                                                            <Input id={`approval-note-${approval.id}`} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} />
                                                                            <div className="flex flex-wrap gap-2">
                                                                                <Button size="sm" onClick={() => decideApproval(selectedRun.id, approval.id, "grant")} disabled={busyAction === `approval:${approval.id}`}>Grant</Button>
                                                                                <Button size="sm" variant="destructive" onClick={() => decideApproval(selectedRun.id, approval.id, "reject")} disabled={busyAction === `approval:${approval.id}`}>Reject</Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                ) : null}

                                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                                    <p className="text-sm font-medium">Server-owned execution boundary</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">This button records one audited <code>recordAudit</code> tool call. It does not send notifications, charge money, publish content, or execute other declared actions.</p>
                                                    <Button className="mt-3" size="sm" onClick={() => executeAuditStep(selectedRun)} disabled={!canExecute || busyAction === `execute:${selectedRun.id}`}>
                                                        <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                                                        Record audited execution
                                                    </Button>
                                                    {pendingApprovals.length > 0 ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Grant every pending approval before execution.</p> : null}
                                                </div>

                                                <section aria-labelledby="business-os-run-steps">
                                                    <h5 id="business-os-run-steps" className="text-sm font-semibold">Execution records</h5>
                                                    {selectedRun.steps.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No executable step has run.</p> : (
                                                        <ol className="mt-2 space-y-2">
                                                            {selectedRun.steps.map((step) => (
                                                                <li key={step.id} className="rounded-xl bg-muted/30 p-3 text-sm">
                                                                    <div className="flex items-center justify-between gap-2"><span>{step.ordinal}. {step.label}</span><Badge variant={step.state === "completed" ? "default" : step.state === "failed" ? "destructive" : "secondary"}>{step.state}</Badge></div>
                                                                    <p className="mt-1 text-xs text-muted-foreground">{step.toolCalls.length} tool call{step.toolCalls.length === 1 ? "" : "s"}</p>
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    )}
                                                </section>

                                                <section aria-labelledby="business-os-audit">
                                                    <h5 id="business-os-audit" className="text-sm font-semibold">Append-only audit trail</h5>
                                                    <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
                                                        {runDetail.audit.map((event) => (
                                                            <li key={event.id} className="rounded-xl border border-border/60 p-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <span className="text-sm font-medium">#{event.sequence} {event.eventType}</span>
                                                                    <span className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</span>
                                                                </div>
                                                                <p className="mt-1 text-xs text-muted-foreground">{event.actorType}{event.actorId ? ` · ${event.actorId}` : ""}</p>
                                                                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 text-[11px]">{JSON.stringify(event.payload, null, 2)}</pre>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </section>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </>
            )}

            <Card>
                <CardHeader>
                    <CardTitle><h3>Engine coverage</h3></CardTitle>
                    <p className="text-sm text-muted-foreground">Registry configuration only, not yet run as full automation.</p>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {engines.map((engine) => {
                            const used = usage.get(engine.id) ?? 0
                            return (
                                <div key={engine.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold">{engine.label}</p>
                                        <Badge variant={used > 0 ? "default" : "outline"}>{used > 0 ? `${used} blueprint${used === 1 ? "" : "s"}` : "unused"}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{engine.description}</p>
                                    <p className="mt-2 text-[11px] text-muted-foreground">{engine.capabilities.map((capability) => capability.label).join(" · ")}</p>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle><h3>Blueprint registry</h3></CardTitle>
                    <p className="text-sm text-muted-foreground">Declared templates remain separate from persisted workspace and run data.</p>
                </CardHeader>
                <CardContent>
                    {blueprints.length === 0 ? (
                        <EmptyState icon={<GitBranch aria-hidden="true" />} title="No blueprints yet" description="No built-in blueprint is registered; no sample blueprint is substituted." />
                    ) : (
                        <div className="space-y-4">
                            {blueprints.map((blueprint) => (
                                <article key={blueprint.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-semibold">{blueprint.name}</h4>
                                                <Badge variant={statusVariant(blueprint.status)}>{blueprint.status}</Badge>
                                                <Badge variant="outline">v{blueprint.version}</Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">{blueprint.summary}</p>
                                            <p className="text-xs text-muted-foreground">{blueprint.vertical}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div className="rounded-xl bg-background/70 p-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Engines</p>
                                            <ul className="mt-2 space-y-2">
                                                {blueprint.engines.map((engine) => (
                                                    <li key={engine.engineId} className="text-sm">
                                                        <span className="font-medium">{businessEngineDescriptors[engine.engineId].label}</span>
                                                        {engine.required ? <Badge variant="outline" className="ml-2">required</Badge> : null}
                                                        <span className="block text-xs text-muted-foreground">{engine.capabilities.map((capability) => capabilityLabel(engine.engineId, capability)).join(" · ")}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="rounded-xl bg-background/70 p-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Workflows</p>
                                            <ul className="mt-2 space-y-2">
                                                {blueprint.workflows.map((workflow) => (
                                                    <li key={workflow.id} className="text-sm">
                                                        <span className="font-medium">{workflow.name}</span>
                                                        <span className="block text-xs text-muted-foreground">on {workflow.trigger.event ?? workflow.trigger.kind} · {workflow.actions.length} action{workflow.actions.length === 1 ? "" : "s"}{workflow.actions.some((action) => action.approval?.required) ? " · needs approval" : ""}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    {blueprint.ownerCopilotPrompts.length > 0 ? (
                                        <div className="mt-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Owner copilot prompts (example text, not interactive)</p>
                                            <ul className="mt-2 space-y-1.5" aria-label="Example owner copilot prompts">
                                                {blueprint.ownerCopilotPrompts.map((prompt) => (
                                                    <li key={prompt} className="rounded-lg border-l-2 border-border bg-background px-3 py-1.5 text-xs italic text-muted-foreground">&ldquo;{prompt}&rdquo;</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                API authorization is enforced server-side; UI state is not an access-control boundary.
                <Clock3 className="ml-2 h-4 w-4" aria-hidden="true" />
                Timestamps are rendered from persisted records.
                <CircleCheck className="ml-2 h-4 w-4" aria-hidden="true" />
                No sample operational data is injected.
            </p>
        </div>
    )
}
