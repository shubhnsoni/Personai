"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Box, Check, ImagePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { catalogArItems, pollArBatch, quoteArBuilds, startArCheckout } from "@/app/actions/ar-builds"
import { useMoney } from "@/components/pricing-provider"
import { cn } from "@/lib/utils"

type Item = {
    id: string
    title: string
    photo: string | null
    has3d: boolean
    live?: boolean
}

type Job = {
    id: string
    productId: string
    status: string
    error: string | null
    title?: string
}

export function ArBuildSheet({
    open,
    onOpenChange,
    initialIds,
    batchId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialIds?: string[]
    batchId?: string | null
}) {
    const money = useMoney()
    const [pending, start] = useTransition()
    const [items, setItems] = useState<Item[]>([])
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const [photos, setPhotos] = useState<Record<string, string>>({})
    const [uploading, setUploading] = useState<string | null>(null)
    const [quote, setQuote] = useState({ items: 0, itemCents: 0, totalCents: 0 })
    const [studioReady, setStudioReady] = useState(true)
    const [jobs, setJobs] = useState<Job[]>([])
    const [activeBatch, setActiveBatch] = useState<string | null>(batchId || null)

    useEffect(() => {
        if (!open) return
        start(async () => {
            const rows = await catalogArItems()
            setItems(rows)
            const next = new Set(initialIds?.length ? initialIds : rows.filter((r) => !r.has3d && r.photo).map((r) => r.id))
            setPicked(next)
        })
    }, [open, initialIds])

    useEffect(() => {
        if (!open || !picked.size) {
            setQuote({ items: 0, itemCents: 0, totalCents: 0 })
            return
        }
        start(async () => {
            const q = await quoteArBuilds([...picked], photos)
            setQuote(q.quote)
            setStudioReady(q.studioReady)
            setItems((prev) => prev.map((row) => {
                const hit = q.items.find((i) => i.id === row.id)
                return hit ? { ...row, photo: hit.photo, has3d: hit.has3d } : row
            }))
        })
    }, [open, picked, photos])

    useEffect(() => {
        if (!open || !activeBatch) return
        let stop = false
        async function loop() {
            while (!stop) {
                const res = await pollArBatch(activeBatch!)
                setJobs(res.items)
                const done = res.items.every((j) => j.status === "READY" || j.status === "FAILED")
                if (done) break
                await new Promise((r) => setTimeout(r, 4000))
            }
        }
        void loop()
        return () => { stop = true }
    }, [open, activeBatch])

    const selected = useMemo(() => items.filter((i) => picked.has(i.id)), [items, picked])
    const missing = selected.filter((i) => !(photos[i.id] || i.photo))

    function toggle(id: string) {
        setPicked((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    async function upload(id: string, file: File) {
        setUploading(id)
        try {
            const data = new FormData()
            data.append("file", file)
            const res = await fetch("/api/upload", { method: "POST", body: data })
            const json = await res.json() as { url?: string; error?: string }
            if (!res.ok || !json.url) throw new Error(json.error || "Upload failed")
            setPhotos((p) => ({ ...p, [id]: json.url! }))
            setPicked((prev) => new Set(prev).add(id))
        } catch {
            toast.error("Could not add that photo")
        } finally {
            setUploading(null)
        }
    }

    async function pay() {
        if (!selected.length) return toast.error("Pick at least one item")
        if (missing.length) return toast.error("Every selected item needs a photo")
        if (!studioReady) return toast.error("3D studio isn’t connected yet.")
        start(async () => {
            try {
                const res = await startArCheckout({
                    productIds: selected.map((i) => i.id),
                    photos,
                })
                if (res.checkoutUrl) {
                    window.location.href = res.checkoutUrl
                    return
                }
                setActiveBatch(res.batchId)
                toast.success("Building 3D…")
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not start")
            }
        })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[1.75rem] border-border/70 p-0"
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-3 pb-4">
                        <SheetHeader className="space-y-1 p-0 text-left">
                            <SheetTitle className="text-lg">Photoreal 3D</SheetTitle>
                            <SheetDescription>
                                One clear photo per item. Guests put it on their table. {money(quote.itemCents, "USD")} each.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium" onClick={() => setPicked(new Set(items.map((i) => i.id)))}>
                                All
                            </button>
                            <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium" onClick={() => setPicked(new Set(items.filter((i) => !i.has3d).map((i) => i.id)))}>
                                Missing 3D
                            </button>
                            <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium" onClick={() => setPicked(new Set())}>
                                None
                            </button>
                        </div>

                        <div className="space-y-2">
                            {items.map((item) => {
                                const on = picked.has(item.id)
                                const photo = photos[item.id] || item.photo
                                const job = jobs.find((j) => j.productId === item.id)
                                return (
                                    <div key={item.id} className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2", on ? "border-cyan-400/50 bg-cyan-400/5" : "border-border/70")}>
                                        <button type="button" onClick={() => toggle(item.id)} className={cn("flex h-6 w-6 items-center justify-center rounded-full border", on ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-border")}>
                                            {on ? <Check className="h-3.5 w-3.5" /> : null}
                                        </button>
                                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                                            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="m-auto h-4 w-4 text-muted-foreground" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{item.title}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {job?.status === "RUNNING" || job?.status === "PAID" ? "Building…"
                                                    : job?.status === "READY" ? "Ready"
                                                        : job?.status === "FAILED" ? (job.error || "Couldn’t build")
                                                            : item.has3d ? "Already has 3D"
                                                                : photo ? "Photo ready"
                                                                    : "Needs a photo"}
                                            </p>
                                        </div>
                                        <label className="text-[11px] font-medium text-cyan-600">
                                            {uploading === item.id ? "…" : "Photo"}
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="sr-only"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    e.target.value = ""
                                                    if (file) void upload(item.id, file)
                                                }}
                                            />
                                        </label>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{quote.items} selected</span>
                            <span className="font-semibold tabular-nums">{money(quote.totalCents, "USD")}</span>
                        </div>
                        <Button
                            type="button"
                            className="h-12 w-full rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                            disabled={pending || !quote.items || Boolean(missing.length)}
                            onClick={() => void pay()}
                        >
                            <Box className="mr-1.5 h-4 w-4" />
                            {pending ? "Starting…" : jobs.length ? "Building…" : `Pay · ${money(quote.totalCents, "USD")}`}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
