"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Box, Check, CircleAlert, LoaderCircle, Sparkles } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getArStudio, pollArBatch, startArCheckout } from "@/app/actions/ar-builds"

type Studio = Awaited<ReturnType<typeof getArStudio>>
type Job = Awaited<ReturnType<typeof pollArBatch>>["items"][number]
const statusLabels: Record<string, string> = {
    DRAFT: "Awaiting review", PAID: "Awaiting payment review", QUEUED: "Queued · generation reserved",
    DISPATCHING: "Starting your generation", RUNNING: "Building your model", DELIVERY_RETRY: "Finishing delivery",
    UNKNOWN: "Checking generation outcome", HELD: "Needs review", READY: "Model ready", FAILED: "Generation stopped",
}
const settled = new Set(["READY", "FAILED", "HELD", "UNKNOWN"])

export function ArBuildSheet({ open, onOpenChange, batchId, initialIds = [] }: {
    open: boolean; onOpenChange: (open: boolean) => void; initialIds?: string[]; batchId?: string | null
}) {
    const [studio, setStudio] = useState<Studio | null>(null)
    const [selected, setSelected] = useState<string[]>([])
    const [startedBatch, setStartedBatch] = useState<string | null>(null)
    const [result, setResult] = useState<{ batchId: string; items: Job[]; error?: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [starting, setStarting] = useState(false)
    const [retry, setRetry] = useState(0)
    const request = useRef<{ key: string; fingerprint: string } | null>(null)
    const submitting = useRef(false)
    const initialSelection = initialIds.join("|")
    const activeBatch = startedBatch || (batchId && batchId !== "cancel" ? batchId : null)

    useEffect(() => {
        if (!open) return
        let stopped = false
        async function load() {
            try {
                const response = await getArStudio()
                if (stopped) return
                setStudio(response)
                setSelected(initialSelection.split("|").filter(id => response.items.some(item => item.id === id && item.canGenerate)))
                setLoading(false)
            } catch { if (!stopped) { setError("Couldn’t load your generation allowance. Try again before starting a model."); setLoading(false) } }
        }
        void load()
        return () => { stopped = true }
    }, [open, initialSelection, retry])

    useEffect(() => {
        if (!open || !activeBatch) return
        let stopped = false
        let timer: ReturnType<typeof setTimeout> | undefined
        async function poll() {
            try {
                const response = await pollArBatch(activeBatch!)
                if (stopped) return
                setResult({ batchId: activeBatch!, items: response.items })
                if (!response.items.every(job => settled.has(job.status))) timer = setTimeout(() => void poll(), 4000)
            } catch { if (!stopped) setResult({ batchId: activeBatch!, items: [], error: "Couldn’t load this batch. Please refresh its status." }) }
        }
        void poll()
        return () => { stopped = true; if (timer) clearTimeout(timer) }
    }, [open, activeBatch, retry])

    const available = studio ? studio.balance.monthly + studio.balance.trial + (studio.plan.id === "free" ? 0 : studio.balance.purchased) : 0
    const canStart = Boolean(studio?.access.available && studio.canGenerate && selected.length && selected.length <= 50 && selected.length <= available && !starting)
    const current = result?.batchId === activeBatch ? result : null

    async function generate() {
        if (!canStart || submitting.current) return
        submitting.current = true
        setStarting(true)
        setError(null)
        const productIds = [...selected].sort()
        const fingerprint = productIds.join("|")
        try {
            if (!request.current || request.current.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() }
            const response = await startArCheckout({ productIds, requestKey: request.current.key })
            if (response.error || !response.batchId) { setError(response.error || "The generation could not be confirmed. Retry the same selection to check the original request."); return }
            setStartedBatch(response.batchId)
            setSelected([])
            request.current = null
            const refreshed = await getArStudio()
            setStudio(refreshed)
        } catch {
            // Retain the key after an unknown response, so retrying checks the original request.
            setError("We couldn’t confirm the request. Retry the same selection to check its original status without reserving twice.")
        } finally { submitting.current = false; setStarting(false) }
    }

    return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] border-[#244536]/15 bg-[#f7f9f0] p-0 text-[#153a2b] dark:border-[#b9ed78]/15 dark:bg-[#0c241c] dark:text-[#f0f6e6]"><div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20" /><div className="mx-auto w-full max-w-2xl px-5 pb-7 pt-6 sm:px-9">
        <SheetHeader className="space-y-2 p-0 pr-8 text-left"><span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#8fbb59]/25 bg-[#b9ed78]/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em]"><Sparkles size={12} aria-hidden /> YOUR PRODUCTS, IN ANOTHER DIMENSION</span><SheetTitle className="text-2xl font-semibold tracking-tight text-inherit">Photoreal 3D</SheetTitle><SheetDescription className="max-w-md text-sm leading-relaxed text-[#526951] dark:text-[#bdcdb5]">Choose a product photo. Use one generation for each successfully delivered standard textured model.</SheetDescription></SheetHeader>
        <div className="my-5 flex items-center gap-4 rounded-2xl bg-[#123b2a] p-5 text-[#f0f6e6]"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#b9ed78] text-[#214829]"><Box size={30} strokeWidth={1.4} aria-hidden /></div><div className="min-w-0"><p className="text-xl font-semibold">{studio ? `${available} available` : "Your generation allowance"}</p><p className="mt-1 text-xs leading-relaxed text-[#c1d7b5]">{studio ? `${studio.plan.name} · ${studio.balance.monthly} monthly · ${studio.balance.purchased} purchased · ${studio.balance.trial} trial · ${studio.balance.reserved} reserved` : "Checking your account…"}</p></div></div>
        {loading ? <p className="text-sm">Loading your products and allowance…</p> : studio ? <>
            {!studio.access.available && <p className="mb-4 rounded-xl border border-current/15 p-4 text-sm leading-relaxed">{studio.access.message}</p>}
            {!studio.canGenerate && <p className="mb-4 text-sm leading-relaxed">A business owner, administrator or manager can start generations. You can view the progress below.</p>}
            <p className="mb-3 text-xs leading-relaxed text-[#526951] dark:text-[#bdcdb5]">Use an uploaded JPG or PNG under 10 MB. A clear photo of one object works best. Update a product’s photo in the product editor before generating. Results are not guaranteed exact replicas.</p>
            <fieldset disabled={!studio.access.available || !studio.canGenerate || starting} className="space-y-2"><legend className="mb-3 text-sm font-semibold">Choose products ({selected.length} selected)</legend>{studio.items.length ? studio.items.map(item => <label key={item.id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-current/15 p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#4e7425]" checked={selected.includes(item.id)} disabled={!item.canGenerate} onChange={event => { setSelected(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id)) }} /><span className="min-w-0"><span className="block break-words text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs text-[#526951] dark:text-[#bdcdb5]">{!item.canGenerate ? "Upload a JPG or PNG photo to this product first" : item.has3d ? "Already has 3D · another generation uses one unit" : "One generation"}</span></span></label>) : <p className="text-sm">Add a product with a photo to get started.</p>}</fieldset>
            {selected.length > available && <p role="status" className="mt-3 text-sm">This selection needs {selected.length} generations. You have {available} available. Choose fewer products or review packs in Billing.</p>}
            {selected.length > 50 && <p role="status" className="mt-3 text-sm">Choose up to 50 products in one batch.</p>}
            <button type="button" onClick={() => void generate()} disabled={!canStart} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#b9ed78] px-5 py-3 text-sm font-semibold text-[#143727] transition-colors hover:bg-[#cbf695] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current">{starting ? <><LoaderCircle size={16} className="motion-safe:animate-spin" /> Reserving generation…</> : `Generate ${selected.length || "selected"} ${selected.length === 1 ? "model" : "models"}`}</button>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#526951] dark:text-[#bdcdb5]">The selection is reserved together. Technical failure returns its unit. Work continues after this panel closes.</p>
        </> : null}
        {error && <div role="alert" className="mt-4 rounded-xl border border-current/20 p-4 text-sm leading-relaxed"><p>{error}</p><button type="button" className="mt-2 min-h-10 underline underline-offset-4" onClick={() => { setError(null); setRetry(value => value + 1) }}>Refresh status</button></div>}
        <Link href="/dashboard/billing" onClick={() => onOpenChange(false)} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">Plan, usage & extra packs <ArrowUpRight size={16} aria-hidden /></Link>
        {studio?.plan.id === "free" && <p className="mt-1 text-xs leading-relaxed text-[#526951] dark:text-[#bdcdb5]">One trial per eligible verified user across their accounts. Purchased packs pause on Free. Trial capacity is checked before a unit is reserved.</p>}
        {activeBatch && <section className="mt-7 border-t border-current/15 pt-5" aria-labelledby="photoreal-existing-batch"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="photoreal-existing-batch" className="text-sm font-semibold">Generation progress</h3><button type="button" className="min-h-10 text-xs underline underline-offset-4" onClick={() => setRetry(value => value + 1)}>Refresh progress</button></div><div className="mt-3 space-y-2" aria-live="polite">{!current ? <p className="text-sm">Loading batch status…</p> : current.error ? <p className="text-sm">{current.error}</p> : current.items.length ? current.items.map(job => <div key={job.id} className="flex items-start gap-3 rounded-xl border border-current/10 bg-white/40 px-3 py-3 dark:bg-white/5"><span className="mt-0.5 shrink-0" aria-hidden>{job.status === "READY" ? <Check size={16} /> : settled.has(job.status) ? <CircleAlert size={16} /> : <LoaderCircle size={16} className="motion-safe:animate-spin" />}</span><div className="min-w-0"><p className="break-words text-sm font-medium">{job.title || "3D model"}</p><p className="mt-0.5 break-words text-xs text-[#526951] dark:text-[#bdcdb5]">{job.error || statusLabels[job.status] || "Checking status"}</p></div></div>) : <p className="text-sm">No batch was found for this business.</p>}</div></section>}
        {studio && studio.recentBatchIds.some(id => id !== activeBatch) && <nav className="mt-5 border-t border-current/15 pt-4" aria-label="Recent generation batches"><p className="mb-2 text-xs font-semibold">Recent generations</p><div className="flex flex-wrap gap-2">{studio.recentBatchIds.filter(id => id !== activeBatch).map((id, index) => <button key={id} type="button" onClick={() => setStartedBatch(id)} className="min-h-10 rounded-full border border-current/20 px-4 text-xs">View batch {index + 1}</button>)}</div></nav>}
    </div></SheetContent></Sheet>
}
