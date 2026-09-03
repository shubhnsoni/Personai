import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { ShopWordmark } from "@/components/shop/shop-cover"
import { whatsappHref } from "@/lib/commerce"
import { ModeToggle } from "@/components/mode-toggle"
import { LiveOrderHeaderButton } from "@/components/shop/live-order-button"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { cn } from "@/lib/utils"

export function CatalogHeader({
    slug,
    name,
    logoUrl,
    label,
    backHref,
    whatsapp,
    themeToggle,
    compact,
    aboutHref,
    hours,
    openToday,
    bookHref,
}: {
    slug: string
    name: string
    logoUrl?: string | null
    label: string
    backHref?: string
    whatsapp?: string | null
    themeToggle?: boolean
    compact?: boolean
    aboutHref?: string | null
    hours?: string | null
    openToday?: string | null
    bookHref?: string | null
}) {
    const wa = whatsappHref(whatsapp, `Hi ${name}`)
    const hoursLabel = [hours, openToday].map((value) => value?.trim()).find(Boolean) || null
    return (
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
            <div className={cn("mx-auto flex h-14 items-center gap-2 px-4", compact ? "max-w-lg" : "max-w-2xl")}>
                <Link href={backHref || `/${slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    {compact && logoUrl ? (
                        <>
                            <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border" />
                            <span className="min-w-0">
                                <span className="block truncate font-semibold tracking-tight text-foreground">{name}</span>
                                {hoursLabel ? (
                                    <span className="block truncate text-[11px] font-medium text-cyan-400">{hoursLabel}</span>
                                ) : null}
                            </span>
                        </>
                    ) : (
                        <>
                            <ShopWordmark name={name} logoUrl={logoUrl} className="text-lg text-foreground" />
                            {compact && hoursLabel ? (
                                <span className="min-w-0 truncate text-[11px] font-medium text-cyan-400">{hoursLabel}</span>
                            ) : null}
                        </>
                    )}
                </Link>
                {compact ? null : (
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
                )}
                {!compact && hoursLabel ? (
                    <span className="min-w-0 max-w-[11rem] truncate text-[11px] font-medium text-cyan-400">{hoursLabel}</span>
                ) : null}
                {aboutHref ? (
                    <Link
                        href={aboutHref}
                        className="shrink-0 rounded-full px-2 py-1 text-[13px] font-medium text-cyan-400 hover:bg-cyan-400/10"
                    >
                        About
                    </Link>
                ) : null}
                {bookHref ? (
                    <Link
                        href={bookHref}
                        className="shrink-0 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        Reserve
                    </Link>
                ) : null}
                {wa ? (
                    <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-zinc-950"
                        aria-label="WhatsApp"
                    >
                        <WhatsAppIcon className="h-4 w-4" />
                    </a>
                ) : null}
                {compact ? <LiveOrderHeaderButton slug={slug} /> : null}
                {themeToggle ? <ModeToggle /> : null}
                <Link
                    href={`/${slug}`}
                    aria-label={`Chat with ${name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
                >
                    <MessageCircle className="h-4 w-4" />
                </Link>
            </div>
        </header>
    )
}
