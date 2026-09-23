"use client"

import { useMemo, useState } from "react"
import Link from "@/components/navigation/transition-link"
import { Check, Copy, Printer, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { QrCard } from "@/components/profile/qr-card"
import { whatsappHref } from "@/lib/commerce"
import {
    HOTEL_SHARE_CHAT_RECEPTION_LABEL,
    HOTEL_SHARE_NO_WA_COPY,
} from "@/lib/hotels/guest-whatsapp"
import { cn } from "@/lib/utils"

export function GuestQrPanel({
    slug,
    name,
    targetUrl,
    targetLabel,
}: {
    slug: string
    name: string
    targetUrl: string
    targetLabel: string
}) {
    return (
        <main className="mx-auto w-full max-w-md space-y-5 px-4 py-8">
            <header className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300/80">Guest QR</p>
                <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
                <p className="text-sm text-muted-foreground">Scan card opens {targetLabel}. Save a PNG or jump to share / print.</p>
            </header>
            <QrCard name={name} slug={slug} url={targetUrl} />
            <nav className="flex flex-wrap gap-2">
                <Button asChild variant="outline" pill className="h-10">
                    <Link href={`/${slug}/share`}>Share</Link>
                </Button>
                <Button asChild variant="outline" pill className="h-10">
                    <Link href={`/${slug}/print`}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" />
                        Print sheet
                    </Link>
                </Button>
                <Button asChild variant="ghost" pill className="h-10">
                    <Link href={`/${slug}`}>Back to page</Link>
                </Button>
            </nav>
        </main>
    )
}

export function GuestSharePanel({
    slug,
    name,
    pageUrl,
    menuUrl,
    whatsapp,
    isFood,
    isHotel = false,
}: {
    slug: string
    name: string
    pageUrl: string
    menuUrl: string | null
    whatsapp?: string | null
    isFood: boolean
    /** Stay kits: never silently omit handoff when WA is unset. */
    isHotel?: boolean
}) {
    const [copied, setCopied] = useState<"page" | "menu" | null>(null)
    const shareTarget = menuUrl || pageUrl
    const wa = useMemo(
        () => whatsappHref(whatsapp, `Check out ${name}: ${shareTarget}`),
        [whatsapp, name, shareTarget],
    )

    async function copy(kind: "page" | "menu", url: string) {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(kind)
            toast.success("Link copied")
            setTimeout(() => setCopied(null), 1600)
        } catch {
            toast.error(url)
        }
    }

    async function nativeShare() {
        try {
            if (navigator.share) {
                await navigator.share({ title: name, text: `Check out ${name}`, url: shareTarget })
                return
            }
        } catch (e) {
            if ((e as Error).name === "AbortError") return
        }
        await copy(menuUrl ? "menu" : "page", shareTarget)
    }

    return (
        <main className="mx-auto w-full max-w-md space-y-5 px-4 py-8">
            <header className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300/80">Share</p>
                <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
                <p className="text-sm text-muted-foreground">
                    {isFood ? "Send the menu or the page. Guests can scan the QR without installing an app." : "Send the page link or open the system share sheet."}
                </p>
            </header>

            <div className="space-y-2 rounded-[1.4rem] border border-border/70 p-4">
                <button
                    type="button"
                    onClick={() => void copy("page", pageUrl)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-3 text-left text-sm hover:bg-muted"
                >
                    <span className="min-w-0">
                        <span className="block font-medium">Page</span>
                        <span className="block truncate text-xs text-muted-foreground">/{slug}</span>
                    </span>
                    {copied === "page" ? <Check className="h-4 w-4 shrink-0 text-cyan-600" /> : <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {menuUrl ? (
                    <button
                        type="button"
                        onClick={() => void copy("menu", menuUrl)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-3 text-left text-sm hover:bg-muted"
                    >
                        <span className="min-w-0">
                            <span className="block font-medium">Menu</span>
                            <span className="block truncate text-xs text-muted-foreground">/{slug}/menu</span>
                        </span>
                        {copied === "menu" ? <Check className="h-4 w-4 shrink-0 text-cyan-600" /> : <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>
                ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" pill className="h-11" onClick={() => void nativeShare()}>
                    <Share2 className="mr-1.5 h-4 w-4" />
                    Share
                </Button>
                {wa ? (
                    <Button asChild variant="outline" pill className="h-11" data-guest-share-whatsapp="true">
                        <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
                    </Button>
                ) : isHotel ? (
                    <Button asChild variant="outline" pill className="h-11" data-guest-share-chat-reception="true">
                        <Link href={`/${slug}`}>{HOTEL_SHARE_CHAT_RECEPTION_LABEL}</Link>
                    </Button>
                ) : null}
                <Button asChild variant="outline" pill className="h-11">
                    <Link href={`/${slug}/qr`}>QR card</Link>
                </Button>
                <Button asChild variant="outline" pill className="h-11">
                    <Link href={`/${slug}/print`}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" />
                        Print
                    </Link>
                </Button>
            </div>
            {!wa && isHotel ? (
                <p className="text-sm text-muted-foreground" data-guest-share-no-wa="true">
                    {HOTEL_SHARE_NO_WA_COPY}
                </p>
            ) : null}

            <div className={cn("pt-2")}>
                <QrCard name={name} slug={slug} url={shareTarget} compact />
            </div>
        </main>
    )
}

export function GuestPrintActions({ slug }: { slug: string }) {
    return (
        <div className="print:hidden mx-auto flex w-full max-w-3xl flex-wrap gap-2 px-4 pb-6 pt-4">
            <Button type="button" pill className="h-10" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print / PDF
            </Button>
            <Button asChild variant="outline" pill className="h-10">
                <Link href={`/${slug}/qr`}>QR card</Link>
            </Button>
            <Button asChild variant="outline" pill className="h-10">
                <Link href={`/${slug}/share`}>Share</Link>
            </Button>
            <Button asChild variant="ghost" pill className="h-10">
                <Link href={`/${slug}`}>Back</Link>
            </Button>
        </div>
    )
}
