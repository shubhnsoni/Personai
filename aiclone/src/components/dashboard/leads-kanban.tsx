"use client"

import { VisitorLead } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateLeadStatus } from "@/app/actions/leads"
import { useTransition } from "react"
import { useRouter } from "next/navigation"

interface LeadsKanbanProps {
    leads: VisitorLead[]
}

const COLUMNS = [
    { id: "NEW", label: "New Leads", color: "bg-blue-500/10 border-blue-500/20" },
    { id: "CONTACTED", label: "Contacted", color: "bg-yellow-500/10 border-yellow-500/20" },
    { id: "QUALIFIED", label: "Qualified", color: "bg-green-500/10 border-green-500/20" },
    { id: "CLOSED", label: "Closed", color: "bg-purple-500/10 border-purple-500/20" },
]

export function LeadsKanban({ leads }: LeadsKanbanProps) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleStatusChange = (leadId: string, newStatus: string) => {
        startTransition(async () => {
            await updateLeadStatus(leadId, newStatus)
            // router.refresh() // handled by revalidatePath
        })
    }

    return (
        <div className="flex h-full gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => {
                const columnLeads = leads.filter(l => (l.status || "NEW") === column.id)

                return (
                    <div key={column.id} className={`flex-1 min-w-[300px] flex flex-col rounded-xl border ${column.color} p-4`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold">{column.label}</h3>
                            <Badge variant="secondary">{columnLeads.length}</Badge>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto">
                            {columnLeads.map((lead) => (
                                <Card key={lead.id} className="bg-card">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-medium flex justify-between items-start">
                                            <span className="truncate">{lead.name}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-2 space-y-3">
                                        <div className="text-xs text-muted-foreground">
                                            {lead.company && <div className="font-medium text-foreground mb-1">{lead.company}</div>}
                                            <div className="truncate">{lead.email}</div>
                                            <div className="mt-1">Budget: {lead.budgetRange || "N/A"}</div>
                                        </div>

                                        <Select
                                            defaultValue={lead.status}
                                            onValueChange={(val) => handleStatusChange(lead.id, val)}
                                            disabled={isPending}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COLUMNS.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="text-[10px] text-muted-foreground text-right">
                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(lead.createdAt))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {columnLeads.length === 0 && (
                                <div className="text-center py-8 text-sm text-muted-foreground opacity-50">
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
