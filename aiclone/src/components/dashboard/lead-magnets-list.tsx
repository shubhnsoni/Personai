"use client"

import { useMemo, useState } from "react"
import { LeadMagnet } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Gift, Plus, Trash2 } from "lucide-react"
import { deleteLeadMagnet } from "@/app/actions/lead-magnets"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { CatalogSearch } from "@/components/dashboard/catalog-chrome"
import { LeadMagnetForm } from "@/components/dashboard/lead-magnet-form"

type Row = LeadMagnet & { _count?: { submissions: number } }

export function LeadMagnetsList({
    profileId,
    leadMagnets,
}: {
    profileId: string
    leadMagnets: Row[]
}) {
    const [q, setQ] = useState("")
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<Row | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const rows = useMemo(() => {
        return leadMagnets.filter((m) => !q.trim() || `${m.title} ${m.type}`.toLowerCase().includes(q.trim().toLowerCase()))
    }, [leadMagnets, q])

    return (
        <div className="space-y-3">
            <CatalogSearch value={q} onChange={setQ} />
            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Gift />}
                        title={leadMagnets.length === 0 ? "No free download yet" : "Nothing matches"}
                        description={leadMagnets.length === 0 ? "A file for an email. Live in one tap." : "Try another search."}
                    />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5 border-b border-border/50 px-3 py-2.5 last:border-b-0">
                            <button type="button" onClick={() => setEditing(m)} className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium">{m.title}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {m.type === "FORM" ? "Form" : m.type === "GIVEAWAY" ? "Giveaway" : "File"}
                                    {m._count?.submissions ? ` · ${m._count.submissions} leads` : ""}
                                    {m.isActive ? "" : " · Off"}
                                </p>
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={deletingId === m.id}
                                onClick={async () => {
                                    if (!confirm("Delete this download?")) return
                                    setDeletingId(m.id)
                                    try { await deleteLeadMagnet(m.id) } finally { setDeletingId(null) }
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            <StudioDock>
                <Button className="shrink-0 rounded-full" onClick={() => { setEditing(null); setAdding(true) }}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
            </StudioDock>
            <LeadMagnetForm
                open={adding || !!editing}
                onOpenChange={(next) => {
                    setAdding(next)
                    if (!next) setEditing(null)
                }}
                profileId={profileId}
                leadMagnet={editing}
            />
        </div>
    )
}
