"use client"

import { useEffect, useState } from "react"
import { Download, Share2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { drawQrCard, type QrStyle } from "@/lib/qr-draw"
import { cn } from "@/lib/utils"

export function QrCard({
    name,
    slug,
    compact,
}: {
    name: string
    slug: string
    compact?: boolean
}) {
    const [src, setSrc] = useState<string | null>(null)
    const [style, setStyle] = useState<QrStyle>("cyan")
    const [copied, setCopied] = useState(false)
    const [url, setUrl] = useState("")

    useEffect(() => {
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        setUrl(`${origin}/${slug}?ref=qr`)
    }, [slug])

    useEffect(() => {
        if (!url) return
        let gone = false
        drawQrCard({ url, name, style, size: compact ? 720 : 1080 })
            .then((canvas) => {
                if (gone) return
                setSrc(canvas.toDataURL("image/png"))
            })
            .catch(() => toast.error("Could not draw QR"))
        return () => {
            gone = true
        }
    }, [url, name, style, compact])

    async function download() {
        if (!src) return
        const a = document.createElement("a")
        a.href = src
        a.download = `${slug}-qr.png`
        a.click()
        toast.success("QR saved")
    }

    async function share() {
        if (!url) return
        try {
            if (navigator.share) {
                const files = src ? [await dataUrlToFile(src, `${slug}-qr.png`)] : []
                const canFiles = files.length && navigator.canShare?.({ files })
                await navigator.share(canFiles ? { title: name, text: url, url, files } : { title: name, text: url, url })
                return
            }
        } catch (e) {
            if ((e as Error).name === "AbortError") return
        }
        await copyLink()
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success("Link copied")
            setTimeout(() => setCopied(false), 1600)
        } catch {
            toast.error(url)
        }
    }

    return (
        <div className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card", compact && "rounded-3xl")}>
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
                <p className="text-sm font-medium">QR card</p>
                <div className="flex gap-1">
                    {(["cyan", "ink", "glass"] as const).map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setStyle(id)}
                            className={cn(
                                "rounded-full px-2.5 py-1 text-[11px]",
                                style === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                            )}
                        >
                            {id === "cyan" ? "Cyan" : id === "ink" ? "Ink" : "Glass"}
                        </button>
                    ))}
                </div>
            </div>
            <div className="px-4 py-3">
                <div className="mx-auto max-w-[280px] overflow-hidden rounded-[1.6rem] bg-zinc-950 shadow-xl">
                    {src ? (
                        <img src={src} alt={`QR for ${name}`} className="block w-full" />
                    ) : (
                        <div className="aspect-square animate-pulse bg-zinc-900" />
                    )}
                </div>
                <p className="mt-2 truncate text-center text-xs text-muted-foreground">{url || `/${slug}`}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border/60 px-4 py-3">
                <Button type="button" variant="outline" className="h-10 rounded-full text-xs" onClick={() => void download()} disabled={!src}>
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Save
                </Button>
                <Button type="button" variant="outline" className="h-10 rounded-full text-xs" onClick={() => void share()}>
                    <Share2 className="mr-1 h-3.5 w-3.5" />
                    Share
                </Button>
                <Button type="button" variant="outline" className="h-10 rounded-full text-xs" onClick={() => void copyLink()}>
                    {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    URL
                </Button>
            </div>
        </div>
    )
}

async function dataUrlToFile(dataUrl: string, filename: string) {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return new File([blob], filename, { type: "image/png" })
}
