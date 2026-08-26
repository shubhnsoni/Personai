"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { applyImportBundle, ingestFile, ingestText, ingestUrl } from "@/app/actions/import"
import type { ImportBundle, ImportItem, ImportKind } from "@/lib/import-extract"
import { acceptForHint, placeholderForHint, type SourceHint } from "@/lib/import-classify"
import { fieldOn, hasSurface, shopNavLabel, type Surface } from "@/lib/surfaces"
import { cn } from "@/lib/utils"
import { FilterChips } from "@/components/dashboard/catalog-chrome"
import { Check, Upload, X } from "lucide-react"

const ALL_DESTINATIONS: { id: SourceHint; label: string; blurb: string; file: string; surface?: "shop" | "courses" | "services" | "events" }[] = [
    { id: "cv", label: "You", blurb: "CV, about page, or jobs", file: "PDF or TXT" },
    { id: "shop", label: "Shop / Menu", blurb: "CSV, paste, or a Google Business / Swiggy / Zomato / Uber Eats link", file: "CSV or TXT", surface: "shop" },
    { id: "course", label: "Courses", blurb: "Outline or course URL", file: "TXT", surface: "courses" },
    { id: "services", label: "Services", blurb: "Offers and prices", file: "TXT or CSV", surface: "services" },
    { id: "events", label: "Events", blurb: "Event list or calendar", file: "ICS or CSV", surface: "events" },
]

const ALL_KINDS: { id: ImportKind; label: string; surface?: Surface; pack?: "shopDigital" | "portfolio" }[] = [
    { id: "profile", label: "Profile" },
    { id: "experience", label: "Job", pack: "portfolio" },
    { id: "project", label: "Project", pack: "portfolio" },
    { id: "service", label: "Service", surface: "services" },
    { id: "product", label: "Product", surface: "shop" },
    { id: "course", label: "Course", surface: "courses" },
    { id: "event", label: "Event", surface: "events" },
    { id: "community", label: "Community", surface: "events" },
    { id: "leadMagnet", label: "Download", pack: "shopDigital" },
    { id: "knowledge", label: "Knowledge" },
]

export type ImportApplyCtl = {
    count: number
    applying: boolean
    label: string
    apply: () => void
    clear: () => void
} | null

const SCAN_STEPS = ["Opening page", "Scanning layout", "Reading copy", "Sorting items"]

function PageScan({ label, source }: { label: string; source?: string | null }) {
    const [step, setStep] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setStep((s) => (s + 1) % SCAN_STEPS.length), 900)
        return () => clearInterval(t)
    }, [])
    const widths = ["92%", "78%", "86%", "64%", "88%", "71%", "80%", "55%"]
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="px-4 pb-1 pt-3">
                <p className="text-sm font-medium">{SCAN_STEPS[step]}…</p>
                <p className="truncate text-xs text-muted-foreground">{source || label}</p>
            </div>
            <div className="relative mx-4 mb-4 mt-3 h-44 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                <div className="absolute inset-x-5 top-5 space-y-2.5">
                    {widths.map((w, i) => (
                        <div
                            key={i}
                            className="pl-scan-line h-2 rounded-full bg-foreground/15"
                            style={{ width: w, animationDelay: `${i * 90}ms` }}
                        />
                    ))}
                </div>
                <div className="pl-scan-beam pointer-events-none absolute inset-x-0 h-16">
                    <div className="h-full bg-gradient-to-b from-transparent via-foreground/35 to-transparent" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-foreground/80" />
                </div>
            </div>
        </div>
    )
}

function looksLikeUrl(raw: string) {
    const line = raw.trim().split(/\s+/)[0] || ""
    if (/^https?:\/\/\S+$/i.test(line)) return line
    if (/^(www\.)\S+\.\S+$/i.test(line) && !raw.includes("\n")) return line
    return null
}

function defaultHintFor(role?: string | null, initial?: SourceHint): SourceHint {
    if (initial) return initial
    if (role === "RESTAURANT" || role === "SHOP") return "shop"
    if (role === "COACH") return "course"
    if (role === "CONSULTANT" || role === "CA") return "services"
    return "cv"
}

const MENU_LINKS = [
    { id: "google", label: "Google", placeholder: "https://maps.google.com/… or a Google Business listing" },
    { id: "swiggy", label: "Swiggy", placeholder: "https://www.swiggy.com/city/…" },
    { id: "zomato", label: "Zomato", placeholder: "https://www.zomato.com/…" },
    { id: "ubereats", label: "Uber Eats", placeholder: "https://www.ubereats.com/…" },
]

export function ImportStudio({
    profileId,
    onBindApply,
    role,
    extras,
    initialHint,
    lockHint,
    embedded,
}: {
    profileId: string
    onBindApply?: (ctl: ImportApplyCtl) => void
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
    initialHint?: SourceHint
    lockHint?: boolean
    embedded?: boolean
}) {
    const DESTINATIONS = ALL_DESTINATIONS
        .filter((d) => !d.surface || hasSurface(role, d.surface as Surface, extras))
        .map((d) => d.id === "shop" ? { ...d, label: shopNavLabel(role) } : d)
    const KINDS = ALL_KINDS.filter((k) => {
        if (k.surface && !hasSurface(role, k.surface, extras)) return false
        if (k.pack && !fieldOn(role, k.pack, extras)) return false
        return true
    })
    const router = useRouter()
    const fileRef = useRef<HTMLInputElement>(null)
    const draftRef = useRef<HTMLTextAreaElement>(null)
    const [hint, setHint] = useState<SourceHint>(defaultHintFor(role, initialHint))
    const [draft, setDraft] = useState("")
    const [linkFocus, setLinkFocus] = useState<string | null>(null)
    const [drag, setDrag] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const [reading, setReading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [bundle, setBundle] = useState<ImportBundle | null>(null)
    const [items, setItems] = useState<ImportItem[]>([])
    const [filter, setFilter] = useState<"all" | ImportKind>("all")
    const [openId, setOpenId] = useState<string | null>(null)
    const [applying, setApplying] = useState(false)

    const selected = items.filter((i) => i.selected)
    const dest = DESTINATIONS.find((d) => d.id === hint) || DESTINATIONS[0]
    const canRead = Boolean(draft.trim()) && !reading

    const apply = useCallback(async () => {
        if (!selected.length) return
        setApplying(true)
        try {
            const res = await applyImportBundle(profileId, items)
            toast.success(res.destinations.join(" · ") || "Imported")
            setBundle(null)
            setItems([])
            setDraft("")
            setFileName(null)
            router.refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Import failed")
        } finally {
            setApplying(false)
        }
    }, [items, profileId, router, selected.length])

    const clear = useCallback(() => {
        setBundle(null)
        setItems([])
        setError(null)
        setReading(null)
        setFileName(null)
    }, [])

    const takeBundle = (next: ImportBundle) => {
        const rows = Array.isArray(next?.items) ? next.items.filter((i) => i && i.title) : []
        setBundle({ ...next, items: rows })
        setItems(rows)
        setFilter("all")
        setError(null)
        if (next.warning) toast.message(next.warning)
        if (!rows.length) setError("Nothing we could map. Try a public URL or paste the text.")
    }

    const run = async (label: string, work: () => Promise<ImportBundle>) => {
        setReading(label)
        setError(null)
        try {
            takeBundle(await work())
        } catch (e) {
            setBundle(null)
            setItems([])
            const msg = e instanceof Error ? e.message : "Could not read that"
            setError(/internal|crash|undefined|exception/i.test(msg) ? "Could not read that link. Paste the page text instead." : msg)
        } finally {
            setReading(null)
        }
    }

    const readDraft = useCallback(() => {
        const text = draft.trim()
        if (!text || reading) return
        const url = looksLikeUrl(text)
        if (url && text.split(/\n/).filter(Boolean).length <= 1) {
            void run("Reading page…", () => ingestUrl(url))
            return
        }
        void run("Reading…", () => ingestText(text, hint))
    }, [draft, hint, reading])

    useEffect(() => {
        if (!onBindApply) return
        if (bundle) {
            onBindApply({
                count: selected.length,
                applying,
                label: applying ? "Importing..." : `Import ${selected.length}`,
                apply,
                clear,
            })
            return () => onBindApply(null)
        }
        onBindApply({
            count: canRead ? 1 : 0,
            applying: Boolean(reading),
            label: reading ? "Reading..." : "Read",
            apply: readDraft,
            clear,
        })
        return () => onBindApply(null)
    }, [onBindApply, bundle, selected.length, applying, apply, clear, canRead, reading, readDraft])

    const onFile = (file?: File) => {
        if (!file) return
        setFileName(file.name)
        const fd = new FormData()
        fd.append("file", file)
        void run(`Reading ${file.name}…`, () => ingestFile(fd, hint))
    }

    const visible = useMemo(
        () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
        [items, filter]
    )

    const kindCounts = useMemo(() => {
        const map = new Map<ImportKind, number>()
        for (const it of items) map.set(it.kind, (map.get(it.kind) || 0) + 1)
        return map
    }, [items])

    const patch = (id: string, update: Partial<ImportItem> | ((row: ImportItem) => ImportItem)) => {
        setItems((cur) => cur.map((row) => {
            if (row.id !== id) return row
            return typeof update === "function" ? update(row) : { ...row, ...update }
        }))
    }

    const setAll = (on: boolean) => {
        setItems((cur) => cur.map((row) => (
            filter === "all" || row.kind === filter ? { ...row, selected: on } : row
        )))
    }

    return (
        <div className={cn("space-y-3", !embedded && "pb-24")}>
            {!bundle && (
                <>
                    {!lockHint ? (
                        <FilterChips
                            value={hint}
                            onChange={(id) => { setHint(id); setError(null); setLinkFocus(null) }}
                            items={DESTINATIONS.map((d) => ({ id: d.id, label: d.label }))}
                        />
                    ) : null}

                    {hint === "shop" ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {MENU_LINKS.map((src) => (
                                <button
                                    key={src.id}
                                    type="button"
                                    onClick={() => {
                                        setLinkFocus(src.id)
                                        setHint("shop")
                                        setError(null)
                                        requestAnimationFrame(() => draftRef.current?.focus())
                                    }}
                                    className={cn(
                                        "rounded-2xl border px-2 py-3 text-center",
                                        linkFocus === src.id ? "border-foreground bg-muted/60" : "border-border/70 bg-card",
                                    )}
                                >
                                    <p className="text-sm font-medium">{src.label}</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">Paste the link</p>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {reading ? (
                        <PageScan
                            label={reading}
                            source={fileName || looksLikeUrl(draft) || dest.blurb}
                        />
                    ) : (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setDrag(false)
                            onFile(e.dataTransfer.files?.[0])
                        }}
                        className={cn(
                            "overflow-hidden rounded-2xl border bg-card",
                            drag ? "border-foreground ring-2 ring-foreground/15" : "border-border/70"
                        )}
                    >
                        <Textarea
                            ref={draftRef}
                            rows={8}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder={
                                linkFocus === "google"
                                    ? "Paste your Google Business or Maps listing…"
                                    : linkFocus === "swiggy"
                                        ? "Paste your Swiggy restaurant link…"
                                        : linkFocus === "zomato"
                                            ? "Paste your Zomato restaurant link…"
                                            : linkFocus === "ubereats"
                                                ? "Paste your Uber Eats store link…"
                                                : placeholderForHint(hint)
                            }
                            className="min-h-[10.5rem] resize-none rounded-none border-0 bg-transparent px-3.5 py-3.5 shadow-none focus-visible:ring-0"
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                    e.preventDefault()
                                    readDraft()
                                }
                            }}
                        />

                        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-3 py-2.5">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-sm font-medium text-background"
                            >
                                <Upload className="h-4 w-4" />
                                Upload file
                            </button>
                            {fileName ? (
                                <span className="inline-flex max-w-[11rem] items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs">
                                    <span className="truncate">{fileName}</span>
                                    <button type="button" onClick={() => setFileName(null)} aria-label="Clear file">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">{dest.file}</span>
                            )}
                            <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
                                {dest.blurb}
                            </span>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            className="sr-only"
                            accept={acceptForHint(hint)}
                            onChange={(e) => {
                                onFile(e.target.files?.[0])
                                e.target.value = ""
                            }}
                        />
                    </div>
                    )}
                </>
            )}

            {error && !bundle && (
                <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{error}</p>
            )}

            {bundle && (
                <div className="space-y-3">
                    {bundle.warning ? (
                        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                            {bundle.warning}
                        </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{bundle.sourceLabel}</p>
                            <p className="text-[11px] text-muted-foreground">{selected.length} of {items.length} selected</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs">
                            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setAll(true)}>
                                All
                            </button>
                            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setAll(false)}>
                                None
                            </button>
                            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={clear}>
                                Start over
                            </button>
                        </div>
                    </div>
                    <FilterChips
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { id: "all" as const, label: "All" },
                            ...KINDS.filter((k) => kindCounts.has(k.id)).map((k) => ({
                                id: k.id,
                                label: `${k.label} ${kindCounts.get(k.id)}`,
                            })),
                        ]}
                    />
                    <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
                        {visible.map((row) => (
                            <ReviewRow
                                key={row.id}
                                row={row}
                                kinds={KINDS}
                                open={openId === row.id}
                                onToggleOpen={() => setOpenId((id) => id === row.id ? null : row.id)}
                                onPatch={patch}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function ReviewRow({
    row,
    kinds,
    open,
    onToggleOpen,
    onPatch,
}: {
    row: ImportItem
    kinds: typeof ALL_KINDS
    open: boolean
    onToggleOpen: () => void
    onPatch: (id: string, update: Partial<ImportItem> | ((row: ImportItem) => ImportItem)) => void
}) {
    const f = row.fields
    const kindLabel = kinds.find((k) => k.id === row.kind)?.label || row.kind
    return (
        <div className={cn(!row.selected && "bg-muted/20")}>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => onPatch(row.id, { selected: !row.selected })}
                    className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        row.selected ? "border-foreground bg-foreground text-background" : "border-border bg-background"
                    )}
                    aria-label={row.selected ? "Deselect" : "Select"}
                >
                    {row.selected ? <Check className="h-3 w-3" /> : null}
                </button>
                <button type="button" onClick={onToggleOpen} className="min-w-0 flex-1 text-left">
                    <p className={cn("truncate text-sm font-medium", !row.selected && "text-muted-foreground")}>{row.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                        {kindLabel}
                        {typeof f.price === "number" ? ` · ${f.price === 0 ? "Free" : `$${f.price}`}` : ""}
                        {f.company ? ` · ${f.company}` : ""}
                    </p>
                </button>
            </div>
            {open ? (
                <div className="grid gap-2 border-t border-border/50 px-3 py-3 sm:grid-cols-2">
                    <label className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">Goes to</span>
                        <select
                            value={row.kind}
                            onChange={(e) => onPatch(row.id, { kind: e.target.value as ImportKind })}
                            className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-sm"
                        >
                            {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                    </label>
                    <Field label="Title" value={row.title} onChange={(v) => onPatch(row.id, { title: v })} />
                    {row.kind === "profile" ? (
                        <>
                            <Field label="Name" value={f.displayName || ""} onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, displayName: v } }))} />
                            <Field label="Headline" value={f.headline || ""} onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, headline: v } }))} />
                            <Field className="sm:col-span-2" label="Bio" area value={f.bio || ""} onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, bio: v } }))} />
                        </>
                    ) : null}
                    {row.kind === "experience" ? (
                        <>
                            <Field label="Role" value={f.role || ""} onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, role: v } }))} />
                            <Field label="Company" value={f.company || ""} onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, company: v } }))} />
                        </>
                    ) : null}
                    {["service", "product", "course", "event", "community", "leadMagnet"].includes(row.kind) ? (
                        <Field
                            label="Price"
                            type="number"
                            value={f.price == null ? "" : String(f.price)}
                            onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, price: v === "" ? 0 : Number(v) } }))}
                        />
                    ) : null}
                    <Field
                        className="sm:col-span-2"
                        label="Notes"
                        area
                        value={f.description || f.body || ""}
                        onChange={(v) => onPatch(row.id, (r) => ({ ...r, fields: { ...r.fields, description: v, body: row.kind === "knowledge" ? v : r.fields.body } }))}
                    />
                </div>
            ) : null}
        </div>
    )
}

function Field({
    label,
    value,
    onChange,
    area,
    type = "text",
    className,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    area?: boolean
    type?: string
    className?: string
}) {
    return (
        <label className={cn("space-y-1", className)}>
            <span className="text-[11px] text-muted-foreground">{label}</span>
            {area ? (
                <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl text-sm" />
            ) : (
                <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-xl text-sm" />
            )}
        </label>
    )
}
