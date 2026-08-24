"use client"

import { useMemo, useState } from "react"
import { ShortLink } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Copy, Link2, Plus, Trash2 } from "lucide-react"
import { deleteShortLink } from "@/app/actions/short-links"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { CatalogSearch } from "@/components/dashboard/catalog-chrome"
import { ShortLinkForm } from "@/components/dashboard/short-link-form"
import { toast } from "sonner"

export function ShortLinksList({
    profileId,
    shortLinks,
}: {
    profileId: string
    shortLinks: ShortLink[]
}) {
    const [q, setQ] = useState("")
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<ShortLink | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const rows = useMemo(() => {
        return shortLinks.filter((l) => !q.trim() || `${l.title || ""} ${l.code} ${l.targetUrl}`.toLowerCase().includes(q.trim().toLowerCase()))
    }, [shortLinks, q])

    return (
        <div className="space-y-3">
            <CatalogSearch value={q} onChange={setQ} />
            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Link2 />}
                        title={shortLinks.length === 0 ? "No short links" : "Nothing matches"}
                        description={shortLinks.length === 0 ? "Paste a URL. We make a short one." : "Try another search."}
                    />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((l) => (
                        <div key={l.id} className="flex items-center gap-2.5 border-b border-border/50 px-3 py-2.5 last:border-b-0">
                            <button type="button" onClick={() => setEditing(l)} className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium">{l.title || l.code}</p>
                                <p className="truncate text-[11px] text-muted-foreground">/l/{l.code} · {l.clicks || 0} taps</p>
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={async () => {
                                    const url = `${window.location.origin}/l/${l.code}`
                                    try {
                                        await navigator.clipboard.writeText(url)
                                        toast.success("Copied")
                                    } catch {
                                        toast.error(url)
                                    }
                                }}
                            >
                                <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={deletingId === l.id}
                                onClick={async () => {
                                    if (!confirm("Delete this link?")) return
                                    setDeletingId(l.id)
                                    try { await deleteShortLink(l.id) } finally { setDeletingId(null) }
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
            <ShortLinkForm
                open={adding || !!editing}
                onOpenChange={(next) => {
                    setAdding(next)
                    if (!next) setEditing(null)
                }}
                profileId={profileId}
                shortLink={editing}
            />
        </div>
    )
}
