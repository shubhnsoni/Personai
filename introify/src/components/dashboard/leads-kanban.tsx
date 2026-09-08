"use client"

import { VisitorLead } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateLeadStatus } from "@/app/actions/leads"
import { LEAD_STATUSES, normalizeLeadStatus } from "@/lib/lead-status"
import { useTransition } from "react"

interface LeadsKanbanProps {
    leads: VisitorLead[]
}

const COLUMNS = LEAD_STATUSES.map((s) => ({
    id: s.id,
    label: s.label,
    color:
        s.id === "NEW"
            ? "bg-blue-500/10 border-blue-500/20"
            : s.id === "CONTACTED"
                ? "bg-amber-500/10 border-amber-500/20"
                : s.id === "CLOSED"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-red-500/10 border-red-500/20",
}))

export function LeadsKanban({ leads }: LeadsKanbanProps) {
    const [isPending, startTransition] = useTransition()

    const handleStatusChange = (leadId: string, newStatus: string) => {
        startTransition(async () => {
            await updateLeadStatus(leadId, newStatus)
        })
    }

    return (
        <div className="flex h-full gap-3 overflow-x-auto pb-4">
            {COLUMNS.map((column) => {
                const columnLeads = leads.filter((l) => normalizeLeadStatus(l.status) === column.id)

                return (
                    <div key={column.id} className={`flex min-w-[240px] flex-1 flex-col rounded-2xl border p-3 ${column.color}`}>
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">{column.label}</h3>
                            <Badge variant="secondary">{columnLeads.length}</Badge>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto">
                            {columnLeads.map((lead) => (
                                <Card key={lead.id} className="bg-card">
                                    <CardHeader className="p-3 pb-1">
                                        <CardTitle className="flex items-start justify-between text-sm font-medium">
                                            <span className="truncate">{lead.name}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 p-3 pt-1">
                                        <div className="text-xs text-muted-foreground">
                                            {lead.company && <div className="mb-1 font-medium text-foreground">{lead.company}</div>}
                                            <div className="truncate">{lead.email}</div>
                                            <div className="mt-1">Budget: {lead.budgetRange || "N/A"}</div>
                                        </div>

                                        <Select
                                            defaultValue={normalizeLeadStatus(lead.status)}
                                            onValueChange={(val) => handleStatusChange(lead.id, val)}
                                            disabled={isPending}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LEAD_STATUSES.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="text-right text-[10px] text-muted-foreground">
                                            {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(lead.createdAt))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {columnLeads.length === 0 && (
                                <div className="py-8 text-center text-sm text-muted-foreground/50">
                                    No leads
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
