"use client"

import { VisitorLead } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface LeadsListProps {
    leads: VisitorLead[]
}

export function LeadsList({ leads }: LeadsListProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
                <Card key={lead.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {lead.name}
                        </CardTitle>
                        <Badge variant={lead.status === "NEW" ? "default" : "secondary"}>
                            {lead.status}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{lead.budgetRange || "N/A"}</div>
                        <p className="text-xs text-muted-foreground">
                            {lead.company ? `${lead.company} • ` : ""}
                            {lead.email}
                        </p>
                        <div className="mt-4 text-xs text-muted-foreground">
                            Captured {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.createdAt))}
                        </div>
                    </CardContent>
                </Card>
            ))}
            {leads.length === 0 && (
                <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                    No leads captured yet.
                </div>
            )}
        </div>
    )
}
