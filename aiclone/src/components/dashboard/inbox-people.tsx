"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Bookmark, ChevronLeft, Search, Send } from "lucide-react"
import { sendOwnerMessage, respondLiveChat, endLiveChat } from "@/app/actions/inbox"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { updateLeadStatus } from "@/app/actions/leads"
import { addContent } from "@/app/actions/content"
import { LEAD_STATUSES, leadStatusLabel, normalizeLeadStatus } from "@/lib/lead-status"
import { ResendLibraryLink } from "@/components/dashboard/resend-library-link"
import { toast } from "sonner"
import { ChatMarkdown } from "@/components/chat/chat-markdown"

export type InboxMessage = { id: string; role: string; text: string; createdAt?: string; senderType?: string }
export type InboxConv = {
    id: string
    visitorName: string | null
    visitorEmail: string | null
    lastMessageAt: string | Date
    mode?: string
    messages: InboxMessage[]
}
export type InboxLead = {
    id: string
    name: string
    email: string
    company: string | null
    budgetRange: string | null
    status: string
    createdAt: string | Date
}
export type InboxMember = {
    email: string
    name: string | null
    purchases: string[]
    courses: string[]
    lastAt?: number
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function relTime(date: string | Date) {
    const diffMs = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(diffMs / 3600000)
    const days = Math.floor(diffMs / 86400000)
    if (mins < 1) return "now"
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
    return (
        <div
            className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-aurora/15 font-medium text-aurora",
                size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm"
            )}
        >
            {initials(name)}
        </div>
    )
}

type PersonRow = {
    key: string
    name: string
    email?: string
    kinds: Set<string>
    lastAt: number
    preview: string
    threadLabel?: string
    conv?: InboxConv
    lead?: InboxLead
    member?: InboxMember
}

export function InboxPeople({
    profileId,
    conversations,
    leads,
    members,
    mode = "all",
    initialSelected = null,
}: {
    profileId: string
    conversations: InboxConv[]
    leads: InboxLead[]
    members: InboxMember[]
    mode?: "all" | "chats"
    initialSelected?: string | null
}) {
    const [filter, setFilter] = useState<"all" | "chat" | "lead" | "buyer">(mode === "chats" ? "chat" : "all")
    const filterLabel = { all: "All", chat: "Chats", lead: "Leads", buyer: "Customers" } as const
    const chatsOnly = mode === "chats"
    const [q, setQ] = useState("")
    const [selected, setSelected] = useState<string | null>(initialSelected)
    const [draft, setDraft] = useState("")
    const [pending, startTransition] = useTransition()
    const threadRef = useRef<HTMLDivElement>(null)

    const people = useMemo(() => {
        const leadByEmail = new Map(leads.map((l) => [l.email.toLowerCase(), l]))
        const memberByEmail = new Map(members.map((m) => [m.email.toLowerCase(), m]))

        if (chatsOnly) {
            const byEmail = new Map<string, InboxConv[]>()
            for (const c of conversations) {
                if (!c.visitorEmail) continue
                const k = c.visitorEmail.toLowerCase()
                const list = byEmail.get(k) || []
                list.push(c)
                byEmail.set(k, list)
            }

            return conversations
                .map((c) => {
                    const last = c.messages[c.messages.length - 1]
                    const email = c.visitorEmail?.toLowerCase()
                    const siblings = email ? (byEmail.get(email) || []).slice().sort((a, b) => +new Date(a.lastMessageAt) - +new Date(b.lastMessageAt)) : [c]
                    const idx = siblings.findIndex((s) => s.id === c.id)
                    return {
                        key: c.id,
                        name: c.visitorName || "Visitor",
                        email: c.visitorEmail || undefined,
                        kinds: new Set(["chat"]),
                        lastAt: +new Date(c.lastMessageAt),
                        preview: last?.text || "Chat",
                        threadLabel: siblings.length > 1 ? `${idx + 1} of ${siblings.length}` : undefined,
                        conv: c,
                        lead: email ? leadByEmail.get(email) : undefined,
                        member: email ? memberByEmail.get(email) : undefined,
                    } satisfies PersonRow
                })
                .filter((p) => {
                    if (!q.trim()) return true
                    const hay = `${p.name} ${p.email || ""} ${p.preview}`.toLowerCase()
                    return hay.includes(q.trim().toLowerCase())
                })
                .sort((a, b) => b.lastAt - a.lastAt)
        }

        const map = new Map<string, PersonRow>()
        const upsert = (key: string, patch: { name?: string; email?: string; lastAt?: number; preview?: string; kind?: string }) => {
            const cur = map.get(key) || { key, name: patch.name || "Visitor", kinds: new Set<string>(), lastAt: 0, preview: "" }
            if (patch.name) cur.name = patch.name
            if (patch.email) cur.email = patch.email
            if (patch.kind) cur.kinds.add(patch.kind)
            if (patch.lastAt && patch.lastAt > cur.lastAt) {
                cur.lastAt = patch.lastAt
                if (patch.preview) cur.preview = patch.preview
            } else if (patch.preview && !cur.preview) cur.preview = patch.preview
            map.set(key, cur)
            return cur
        }

        for (const c of conversations) {
            const key = (c.visitorEmail || c.id).toLowerCase()
            const last = c.messages[c.messages.length - 1]
            const row = upsert(key, {
                name: c.visitorName || "Visitor",
                email: c.visitorEmail || undefined,
                kind: "chat",
                lastAt: +new Date(c.lastMessageAt),
                preview: last?.text || "Chat",
            })
            if (!row.conv || +new Date(c.lastMessageAt) >= +new Date(row.conv.lastMessageAt)) row.conv = c
        }
        for (const l of leads) {
            const key = l.email.toLowerCase()
            const row = upsert(key, {
                name: l.name,
                email: l.email,
                kind: "lead",
                lastAt: +new Date(l.createdAt),
                preview: l.company || l.email,
            })
            row.lead = l
        }
        for (const m of members) {
            const key = m.email.toLowerCase()
            const row = upsert(key, {
                name: m.name || m.email,
                email: m.email,
                kind: "buyer",
                lastAt: m.lastAt || 0,
                preview: [...m.purchases, ...m.courses].join(" · ") || "Customer",
            })
            row.member = m
        }

        return [...map.values()]
            .filter((p) => filter === "all" || p.kinds.has(filter))
            .filter((p) => {
                if (!q.trim()) return true
                const hay = `${p.name} ${p.email || ""} ${p.preview}`.toLowerCase()
                return hay.includes(q.trim().toLowerCase())
            })
            .sort((a, b) => b.lastAt - a.lastAt)
    }, [conversations, leads, members, filter, q, chatsOnly])

    const active = people.find((p) => p.key === selected) || null

    useEffect(() => {
        const el = threadRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [selected, active?.conv?.messages.length])

    const counts = useMemo(() => {
        const all = new Set<string>()
        const chat = new Set<string>()
        const lead = new Set<string>()
        const buyer = new Set<string>()
        for (const c of conversations) {
            const k = (c.visitorEmail || c.id).toLowerCase()
            all.add(k); chat.add(k)
        }
        for (const l of leads) {
            const k = l.email.toLowerCase()
            all.add(k); lead.add(k)
        }
        for (const m of members) {
            const k = m.email.toLowerCase()
            all.add(k); buyer.add(k)
        }
        return { all: all.size, chat: chat.size, lead: lead.size, buyer: buyer.size }
    }, [conversations, leads, members])

    const saveNote = async (text: string, name: string) => {
        await addContent(profileId, {
            type: "TEXT",
            title: `From chat with ${name}`,
            content: text,
        })
        toast.success("Saved to knowledge")
    }

    return (
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden md:grid-cols-[minmax(16rem,20rem)_1fr] md:rounded-none xl:grid-cols-[20rem_1fr]">
            <div className={cn("flex min-h-0 flex-col overflow-hidden border-r border-white/8", active && "hidden md:flex")}>
                <div className="space-y-2 border-b border-border/60 p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={chatsOnly ? "Search chats" : "Search people"}
                            className="h-9 rounded-full pl-8"
                        />
                    </div>
                    {!chatsOnly && (
                        <div className="flex gap-1 overflow-x-auto">
                            {(["all", "chat", "lead", "buyer"] as const).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={cn(
                                        "shrink-0 rounded-full px-2.5 py-1 text-xs",
                                        filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {filterLabel[f]}
                                    <span className="ml-1 tabular-nums opacity-70">{counts[f]}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                    {people.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setSelected(p.key)}
                            className={cn(
                                "relative flex min-h-12 w-full items-start gap-3 border-b border-white/6 px-3 py-3 text-left last:border-b-0",
                                selected === p.key ? "bg-cyan-400/8" : "hover:bg-white/[0.04]"
                            )}
                        >
                            {selected === p.key ? (
                                <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-[#00D7FF]" />
                            ) : null}
                            <Avatar name={p.name} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-sm font-medium">{p.name}</span>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                        {p.threadLabel ? `${p.threadLabel} · ` : ""}
                                        {p.lastAt ? relTime(new Date(p.lastAt)) : ""}
                                    </span>
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{p.preview}</p>
                            </div>
                        </button>
                    ))}
                    {people.length === 0 && (
                        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                            {chatsOnly ? "No chats yet." : "No people yet."}
                        </p>
                    )}
                </div>
            </div>

            <div className={cn("flex min-h-0 flex-col overflow-hidden", !active && "hidden md:flex")}>
                {!active ? (
                    <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                        Pick a chat to read the thread
                    </div>
                ) : (
                    <>
                        <div className="shrink-0 border-b border-border/60">
                            <div className="flex items-center gap-2 px-2 py-2.5 md:px-3">
                                <button
                                    type="button"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted md:hidden"
                                    onClick={() => setSelected(null)}
                                    aria-label="Back to chats"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <Avatar name={active.name} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium leading-tight">{active.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {active.email || "No email"}
                                        {active.conv?.mode && active.conv.mode !== "AI" ? ` · ${active.conv.mode === "LIVE" ? "Live" : "Waiting"}` : ""}
                                    </p>
                                </div>
                                {active.conv?.mode === "LIVE_REQUESTED" && (
                                    <div className="flex shrink-0 gap-1">
                                        <button
                                            type="button"
                                            className="rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background"
                                            disabled={pending}
                                            onClick={() => startTransition(async () => { await respondLiveChat(active.conv!.id, true) })}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-full bg-muted px-2.5 py-1 text-[11px]"
                                            disabled={pending}
                                            onClick={() => startTransition(async () => { await respondLiveChat(active.conv!.id, false) })}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )}
                                {active.conv?.mode === "LIVE" && (
                                    <button
                                        type="button"
                                        className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px]"
                                        disabled={pending}
                                        onClick={() => startTransition(async () => { await endLiveChat(active.conv!.id) })}
                                    >
                                        End live
                                    </button>
                                )}
                            </div>
                            {(active.lead || active.member) && (
                                <div className="space-y-2 border-t border-border/40 px-3 py-2">
                                    {active.lead && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {LEAD_STATUSES.map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className={cn(
                                                        "rounded-full px-2.5 py-1 text-[11px]",
                                                        normalizeLeadStatus(active.lead?.status) === s.id
                                                            ? "bg-foreground text-background"
                                                            : "bg-muted text-muted-foreground"
                                                    )}
                                                    disabled={pending}
                                                    onClick={() => {
                                                        startTransition(async () => {
                                                            await updateLeadStatus(active.lead!.id, s.id)
                                                            toast.success(`Marked ${s.label}`)
                                                        })
                                                    }}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                            {active.lead.company && (
                                                <span className="text-[11px] text-muted-foreground">{active.lead.company}</span>
                                            )}
                                        </div>
                                    )}
                                    {active.member && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {[...active.member.courses, ...active.member.purchases].map((item) => (
                                                <span key={item} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                                    {item}
                                                </span>
                                            ))}
                                            {active.email && <ResendLibraryLink email={active.email} />}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
                            {active.conv?.messages.map((m) => {
                                const fromVisitor = m.role === "user"
                                const fromOwner = m.senderType === "OWNER"
                                return (
                                    <div key={m.id} className={cn("flex", fromVisitor ? "justify-end" : "justify-start")}>
                                        <div className={cn("max-w-[88%] space-y-1", fromVisitor && "items-end")}>
                                            {!fromVisitor && (
                                                <p className={cn("px-1 text-[10px] font-medium uppercase tracking-wide", fromOwner ? "text-aurora" : "text-muted-foreground")}>
                                                    {fromOwner ? "You" : "AI"}
                                                </p>
                                            )}
                                            <div
                                                className={cn(
                                                    "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                                                    fromVisitor
                                                        ? "rounded-br-md bg-foreground text-background"
                                                        : fromOwner
                                                            ? "rounded-bl-md bg-aurora/20 text-foreground ring-1 ring-aurora/50"
                                                            : "rounded-bl-md border border-border/70 bg-card text-foreground"
                                                )}
                                            >
                                                {fromVisitor ? (
                                                    <span className="whitespace-pre-wrap">{m.text}</span>
                                                ) : (
                                                    <ChatMarkdown text={m.text} />
                                                )}
                                            </div>
                                            <div className={cn("flex items-center gap-2 px-0.5", fromVisitor ? "justify-end" : "justify-start")}>
                                                {m.createdAt && (
                                                    <span className="text-[10px] text-muted-foreground">{relTime(m.createdAt)}</span>
                                                )}
                                                {!fromVisitor && m.text && (
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                                        onClick={() => saveNote(m.text, active.name)}
                                                    >
                                                        <Bookmark className="h-3 w-3" />
                                                        Save
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {!active.conv && (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    {active.lead ? `Lead · ${leadStatusLabel(active.lead.status)}` : "No messages yet."}
                                    {active.lead?.budgetRange ? ` · ${active.lead.budgetRange}` : ""}
                                </p>
                            )}
                        </div>
                        {active.conv && (
                            <form
                                className="flex shrink-0 items-center gap-2 border-t border-border/60 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const text = draft.trim()
                                    if (!text || !active.conv) return
                                    setDraft("")
                                    startTransition(async () => {
                                        try {
                                            await sendOwnerMessage(active.conv!.id, text)
                                            toast.success("Sent")
                                        } catch {
                                            toast.error("Could not send")
                                        }
                                    })
                                }}
                            >
                                <Input
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="Reply as you…"
                                    className="h-10 rounded-full"
                                />
                                <button
                                    type="submit"
                                    disabled={pending || !draft.trim()}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
                                    aria-label="Send"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
