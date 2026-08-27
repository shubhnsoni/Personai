import { CircleCheck, GitBranch, ShieldCheck, Workflow } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { businessEngineDescriptors } from "@/lib/business-os/engines"
import type { BusinessBlueprint, BusinessBlueprintStatus, EngineDescriptor } from "@/lib/business-os/types"

function statusVariant(status: BusinessBlueprintStatus) {
    if (status === "active") return "default" as const
    if (status === "deprecated") return "destructive" as const
    return "secondary" as const
}

function capabilityLabel(engineId: BusinessBlueprint["engines"][number]["engineId"], capabilityId: string) {
    const engine = businessEngineDescriptors[engineId]
    return engine.capabilities.find((capability) => capability.id === capabilityId)?.label ?? capabilityId
}

export function BusinessOsShell({
    blueprints,
    engines,
}: {
    blueprints: BusinessBlueprint[]
    engines: EngineDescriptor[]
}) {
    const activeCount = blueprints.filter((blueprint) => blueprint.status === "active").length
    const workflowCount = blueprints.reduce((sum, blueprint) => sum + blueprint.workflows.length, 0)
    const approvalGates = blueprints.reduce(
        (sum, blueprint) =>
            sum +
            blueprint.workflows.reduce(
                (inner, workflow) => inner + workflow.actions.filter((action) => action.approval?.required).length,
                0,
            ),
        0,
    )
    const usage = new Map<string, number>()
    for (const blueprint of blueprints) {
        for (const engine of blueprint.engines) {
            usage.set(engine.engineId, (usage.get(engine.engineId) ?? 0) + 1)
        }
    }

    return (
        <div className="flex-1 space-y-6">
            <PageHeader
                title="Business OS"
                description="Versioned blueprints composed from the shared operating engines."
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Blueprints</CardTitle>
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{blueprints.length}</div>
                        <p className="text-xs text-muted-foreground">{activeCount} active</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Engines</CardTitle>
                        <CircleCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{usage.size}/{engines.length}</div>
                        <p className="text-xs text-muted-foreground">composed at least once</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Workflows</CardTitle>
                        <Workflow className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{workflowCount}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approval gates</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{approvalGates}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Engine coverage</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {engines.map((engine) => {
                            const used = usage.get(engine.id) ?? 0
                            return (
                                <div key={engine.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold">{engine.label}</p>
                                        <Badge variant={used > 0 ? "default" : "outline"}>
                                            {used > 0 ? `${used} blueprint${used === 1 ? "" : "s"}` : "unused"}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{engine.description}</p>
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                        {engine.capabilities.map((capability) => capability.label).join(" · ")}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Blueprints</CardTitle></CardHeader>
                <CardContent>
                    {blueprints.length === 0 ? (
                        <EmptyState
                            icon={<GitBranch />}
                            title="No blueprints yet"
                            description="A blueprint composes the shared engines into a vertical. None are registered."
                        />
                    ) : (
                        <div className="space-y-4">
                            {blueprints.map((blueprint) => (
                                <article key={blueprint.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold">{blueprint.name}</p>
                                                <Badge variant={statusVariant(blueprint.status)}>{blueprint.status}</Badge>
                                                <Badge variant="outline">v{blueprint.version}</Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">{blueprint.summary}</p>
                                            <p className="text-xs text-muted-foreground">{blueprint.vertical}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div className="rounded-xl bg-background/70 p-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Engines
                                            </p>
                                            <ul className="mt-2 space-y-2">
                                                {blueprint.engines.map((engine) => (
                                                    <li key={engine.engineId} className="text-sm">
                                                        <span className="font-medium">
                                                            {businessEngineDescriptors[engine.engineId].label}
                                                        </span>
                                                        {engine.required ? (
                                                            <Badge variant="outline" className="ml-2">required</Badge>
                                                        ) : null}
                                                        <span className="block text-xs text-muted-foreground">
                                                            {engine.capabilities
                                                                .map((capability) => capabilityLabel(engine.engineId, capability))
                                                                .join(" · ")}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="rounded-xl bg-background/70 p-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Workflows
                                            </p>
                                            <ul className="mt-2 space-y-2">
                                                {blueprint.workflows.map((workflow) => (
                                                    <li key={workflow.id} className="text-sm">
                                                        <span className="font-medium">{workflow.name}</span>
                                                        <span className="block text-xs text-muted-foreground">
                                                            on {workflow.trigger.event ?? workflow.trigger.kind} ·{" "}
                                                            {workflow.actions.length} action
                                                            {workflow.actions.length === 1 ? "" : "s"}
                                                            {workflow.actions.some((action) => action.approval?.required)
                                                                ? " · needs approval"
                                                                : ""}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {blueprint.ownerCopilotPrompts.length > 0 ? (
                                        <div className="mt-3">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Owner copilot prompts
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {blueprint.ownerCopilotPrompts.map((prompt) => (
                                                    <span
                                                        key={prompt}
                                                        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
                                                    >
                                                        {prompt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
