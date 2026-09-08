"use client"

import { useEffect, useMemo, useState } from "react"
import { ProfileDocument } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Brain, FileText, Link as LinkIcon, MessageCircle, Pencil, Trash2, Upload } from "lucide-react"
import { addContent, deleteContent, syncKnowledgeFromChats, updateContent } from "@/app/actions/content"
import { ImportStudio } from "@/components/dashboard/import-studio"
import type { SurfaceExtras } from "@/lib/surfaces"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Filter = "all" | "notes" | "links" | "chats" | "import"

export function ContentManager({
    profileId,
    documents,
    onBindAdd,
    role,
    extras,
}: {
    profileId: string
    documents: ProfileDocument[]
    onBindAdd?: (open: () => void) => void
    role?: string | null
    extras?: SurfaceExtras | null
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<ProfileDocument | null>(null)
    const [kind, setKind] = useState<"text" | "url">("text")
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [filter, setFilter] = useState<Filter>("all")
    const [busy, setBusy] = useState(false)
    const [syncing, setSyncing] = useState(false)

    const openCreate = () => {
        setEditing(null)
        setKind("text")
        setTitle("")
        setContent("")
        setIsOpen(true)
    }

    useEffect(() => {
        onBindAdd?.(openCreate)
    }, [onBindAdd])

    const rows = useMemo(() => {
        return documents.filter((d) => {
            if (d.type === "VISITOR_MEMORY") return false
            if (filter === "notes") return d.sourceType !== "URL" && d.sourceType !== "CHAT_SUMMARY"
            if (filter === "links") return d.sourceType === "URL"
            if (filter === "chats") return d.sourceType === "CHAT_SUMMARY"
            return true
        })
    }, [documents, filter])

    const openEdit = (doc: ProfileDocument) => {
        setEditing(doc)
        setKind(doc.sourceType === "URL" ? "url" : "text")
        setTitle(doc.title)
        setContent(doc.sourceType === "URL" ? (doc.url || doc.rawText || "") : (doc.rawText || ""))
        setIsOpen(true)
    }

    const handleSave = async () => {
        if (!title || !content) return
        setBusy(true)
        try {
            if (editing) {
                await updateContent(editing.id, { title, content, sourceType: kind === "url" ? "URL" : "TEXT" })
            } else {
                await addContent(profileId, { type: kind === "url" ? "URL" : "TEXT", title, content })
            }
            setIsOpen(false)
        } catch {
            toast.error("Could not save")
        } finally {
            setBusy(false)
        }
    }

    const syncChats = async () => {
        setSyncing(true)
        try {
            const res = await syncKnowledgeFromChats(profileId)
            if (!res.added) toast.message("No chat notes yet")
            else toast.success(`Pulled ${res.count} conversations`)
        } catch {
            toast.error("Could not sync chats")
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-medium">What your AI knows</p>
                <p className="text-xs text-muted-foreground">Notes, links, imports, and chat. This is what it can answer from.</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {([
                    ["all", "All"],
                    ["notes", "Notes"],
                    ["links", "Links"],
                    ["chats", "Chats"],
                    ["import", "Import"],
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setFilter(id)}
                        className={cn(
                            "h-8 rounded-full px-3 text-xs font-medium",
                            filter === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {filter === "import" ? (
                <ImportStudio profileId={profileId} role={role} extras={extras} />
            ) : (
                <>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="h-9 rounded-full" onClick={syncChats} disabled={syncing}>
                            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                            {syncing ? "Syncing…" : "Sync from chat"}
                        </Button>
                        <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => setFilter("import")}>
                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                            Import
                        </Button>
                    </div>

                    {rows.length === 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                            <EmptyState
                                icon={<Brain />}
                                title="Nothing in the brain yet"
                                description="Add a note, paste a URL, import a file, or sync what people already asked in chat."
                            />
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                            {rows.map((doc) => (
                                <div key={doc.id} className="flex items-start gap-3 border-b border-border/50 px-3 py-3 last:border-b-0">
                                    <span className="mt-0.5 text-muted-foreground">
                                        {doc.sourceType === "CHAT_SUMMARY" ? <MessageCircle className="h-4 w-4" /> : doc.sourceType === "URL" ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                    </span>
                                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(doc)}>
                                        <p className="truncate text-sm font-medium">{doc.title}</p>
                                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                            {doc.sourceType === "URL" ? doc.url : doc.rawText}
                                        </p>
                                    </button>
                                    <button type="button" className="p-1 text-muted-foreground hover:text-foreground" onClick={() => openEdit(doc)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Remove this?")) void deleteContent(doc.id) }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="rounded-t-3xl sm:rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit note" : "Add to the brain"}</DialogTitle>
                        <DialogDescription>Text or a link. Your chat can use this.</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-1.5">
                        {(["text", "url"] as const).map((id) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setKind(id)}
                                className={cn("h-8 rounded-full px-3 text-xs font-medium", kind === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
                            >
                                {id === "text" ? "Note" : "Link"}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "url" ? "Portfolio" : "How I work"} className="h-11 rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                        <Label>{kind === "url" ? "URL" : "Note"}</Label>
                        {kind === "url" ? (
                            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="https://" className="h-11 rounded-2xl" />
                        ) : (
                            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} placeholder="Paste anything the AI should know." className="rounded-2xl" />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="rounded-full" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button className="rounded-full" onClick={() => void handleSave()} disabled={busy || !title || !content}>
                            {busy ? "Saving…" : editing ? "Save" : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
