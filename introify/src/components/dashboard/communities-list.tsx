"use client"

import { useMemo, useState } from "react"
import { Community } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Copy, ExternalLink, Plus, Trash2, Users } from "lucide-react"
import { deleteCommunity } from "@/app/actions/communities"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { CatalogSearch } from "@/components/dashboard/catalog-chrome"
import { CommunityForm } from "@/components/dashboard/community-form"
import { useMoney } from "@/components/pricing-provider"
import { toast } from "sonner"

type Row = Community & { _count?: { members: number } }

export function CommunitiesList({
    profileId,
    slug,
    communities,
}: {
    profileId: string
    slug?: string
    communities: Row[]
}) {
    const [q, setQ] = useState("")
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<Row | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const money = useMoney()

    const rows = useMemo(() => {
        return communities.filter((c) => {
            if (!q.trim()) return true
            return `${c.name} ${c.platform}`.toLowerCase().includes(q.trim().toLowerCase())
        })
    }, [communities, q])

    return (
        <div className="space-y-3">
            <CatalogSearch value={q} onChange={setQ} />
            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Users />}
                        title={communities.length === 0 ? "No group yet" : "Nothing matches"}
                        description={communities.length === 0 ? "Telegram or Discord. Name, invite, price." : "Try another search."}
                    />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((c) => (
                        <div key={c.id} className="flex items-center gap-2.5 border-b border-border/50 px-3 py-2.5 last:border-b-0">
                            <button type="button" onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium">{c.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {c.platform === "DISCORD" ? "Discord" : "Telegram"} · {money(c.priceCents)}
                                    {c.billingCycle === "MONTHLY" ? "/mo" : c.billingCycle === "YEARLY" ? "/yr" : ""}
                                    {c._count?.members ? ` · ${c._count.members} members` : ""}
                                </p>
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={deletingId === c.id}
                                onClick={async () => {
                                    if (!confirm("Delete this community?")) return
                                    setDeletingId(c.id)
                                    try { await deleteCommunity(c.id) } finally { setDeletingId(null) }
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            <StudioDock>
                <DockTabs
                    tabs={[
                        {
                            id: "copy",
                            label: "Copy",
                            icon: <Copy />,
                            onClick: async () => {
                                const url = `${window.location.origin}/${slug || ""}`
                                try {
                                    await navigator.clipboard.writeText(url)
                                    toast.success("Profile link copied")
                                } catch {
                                    toast.error(url)
                                }
                            },
                        },
                        { id: "live", label: "Live", icon: <ExternalLink />, href: slug ? `/${slug}` : "/", target: "_blank" },
                    ]}
                />
                <Button className="shrink-0 rounded-full" onClick={() => { setEditing(null); setAdding(true) }}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
            </StudioDock>
            <CommunityForm
                open={adding || !!editing}
                onOpenChange={(next) => {
                    setAdding(next)
                    if (!next) setEditing(null)
                }}
                profileId={profileId}
                community={editing}
            />
        </div>
    )
}
