"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ShortLink } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { createShortLink, updateShortLink, type ShortLinkData } from "@/app/actions/short-links"
import { OfferFooter, OfferSheet, LiveRow } from "@/components/dashboard/offer-sheet"

export function ShortLinkForm({
    profileId,
    shortLink,
    open,
    onOpenChange,
    embedded,
}: {
    profileId: string
    shortLink?: ShortLink | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    embedded?: boolean
}) {
    const router = useRouter()
    const editing = !!shortLink
    const [title, setTitle] = useState("")
    const [targetUrl, setTargetUrl] = useState("")
    const [code, setCode] = useState("")
    const [live, setLive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!embedded && !open) return
        setTitle(shortLink?.title || "")
        setTargetUrl(shortLink?.targetUrl || "")
        setCode(shortLink?.code || "")
        setLive(shortLink?.isActive ?? true)
        setError(null)
    }, [open, shortLink, embedded])

    async function save() {
        if (!targetUrl.trim()) return
        setBusy(true)
        setError(null)
        try {
            const data: ShortLinkData = {
                title: title.trim() || undefined,
                targetUrl: targetUrl.trim(),
                code: code.trim() || undefined,
                isActive: live,
            }
            if (editing && shortLink) await updateShortLink(shortLink.id, data)
            else await createShortLink(profileId, data)
            toast.success(editing ? "Saved" : "Link live")
            onOpenChange?.(false)
            router.refresh()
            if (embedded) router.push("/dashboard/links")
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not save"
            setError(msg)
            toast.error(msg)
        } finally {
            setBusy(false)
        }
    }

    const fields = (
        <>
            <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://…" autoFocus={!embedded} className="h-12 rounded-2xl border-border/70 text-base" />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label (optional)" className="h-12 rounded-2xl border-border/70 text-base" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Short code (optional)" className="h-12 rounded-2xl border-border/70 text-base" />
            <LiveRow checked={live} onChange={setLive} />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </>
    )

    const footer = (
        <OfferFooter
            onCancel={() => (embedded ? router.push("/dashboard/links") : onOpenChange?.(false))}
            busy={busy}
            disabled={!targetUrl.trim()}
            label={editing ? "Save" : "Add link"}
        />
    )

    if (embedded) {
        return (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
                {footer}
            </form>
        )
    }

    return (
        <OfferSheet
            open={Boolean(open)}
            onOpenChange={(next) => onOpenChange?.(next)}
            title={editing ? "Edit link" : "Short link"}
            description="Paste a URL. We make a short one."
            footer={<form onSubmit={(e) => { e.preventDefault(); void save() }}>{footer}</form>}
        >
            <form className="space-y-4 pb-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
            </form>
        </OfferSheet>
    )
}
