"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Download, Share2 } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { drawQrCard, QR_LOOKS, type QrStyle } from "@/lib/qr-draw"
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
    const [look, setLook] = useState<QrStyle | null>(null)
    const [copied, setCopied] = useState(false)
    const [url, setUrl] = useState("")
    const { resolvedTheme } = useTheme()
    const picked = useRef(false)

    useEffect(() => {
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        setUrl(`${origin}/${slug}?ref=qr`)
    }, [slug])

    useEffect(() => {
        if (picked.current || !resolvedTheme) return
        setLook(resolvedTheme === "light" ? "ink" : "cyan")
    }, [resolvedTheme])

    useEffect(() => {
        if (!url || !look) return
        let gone = false
        drawQrCard({ url, name, style: look, size: compact ? 720 : 1080 })
            .then((canvas) => {
                if (gone) return
                setSrc(canvas.toDataURL("image/png"))
            })
            .catch(() => toast.error("Could not draw QR"))
        return () => {
            gone = true
        }
    }, [url, name, compact, look])

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
        <div
            className={cn(
                "studio-panel overflow-hidden rounded-[1.6rem] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_50px_-28px_rgba(0,215,255,0.35)]",
                compact && "rounded-[1.35rem]",
            )}
        >
            <div className="px-4 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300/80">Scan card</p>
                <p className="mt-0.5 text-sm font-medium tracking-tight">Pick a look</p>
                <div className="mt-3 flex flex-wrap gap-1">
                    {QR_LOOKS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                picked.current = true
                                setLook(item.id)
                            }}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]",
                                look === item.id
                                    ? "bg-[#00D7FF] text-[#061018]"
                                    : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.07] hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10",
                            )}
                        >
                            <span
                                className="h-1.5 w-1.5 rounded-full ring-1 ring-black/15 dark:ring-white/25"
                                style={{ background: item.swatch }}
                            />
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 py-4">
                <div className="relative mx-auto w-full max-w-[260px]">
                    <div className="relative overflow-hidden rounded-[1.2rem] ring-1 ring-black/10 shadow-[0_12px_28px_-14px_rgba(15,23,42,0.28)] dark:ring-white/10 dark:shadow-[0_16px_36px_-20px_rgba(0,215,255,0.28)]">
                        {src ? (
                            <img src={src} alt={`${name} QR card`} className="block h-auto w-full" />
                        ) : (
                            <div className="aspect-[5/4] animate-pulse bg-muted" />
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="mx-auto mt-3 flex max-w-full items-center gap-1.5 truncate rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 text-[11px] text-muted-foreground hover:border-cyan-600/40 hover:text-cyan-800 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-300/30 dark:hover:text-cyan-200"
                >
                    {copied ? <Check className="h-3 w-3 shrink-0 text-cyan-700 dark:text-cyan-300" /> : <Copy className="h-3 w-3 shrink-0" />}
                    <span className="truncate">/{slug}</span>
                </button>
            </div>

            <div className="flex gap-2 border-t border-border px-4 py-3">
                <Button
                    type="button"
                    variant="pill"
                    className="h-10 flex-1 text-xs"
                    onClick={() => void download()}
                    disabled={!src}
                >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Save PNG
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    pill
                    className="h-10 w-10 shrink-0 border-border bg-background dark:border-white/10 dark:bg-white/[0.03]"
                    onClick={() => void share()}
                    aria-label="Share"
                >
                    <Share2 className="h-4 w-4" />
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
