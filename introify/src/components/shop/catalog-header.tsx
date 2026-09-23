import Link from "@/components/navigation/transition-link"
import { MessageCircle, Share2 } from "lucide-react"
import { ShopWordmark } from "@/components/shop/shop-cover"
import { whatsappHref } from "@/lib/commerce"
import { ModeToggle } from "@/components/mode-toggle"
import { LiveOrderHeaderButton } from "@/components/shop/live-order-button"
import { GuestShopOrdersButton } from "@/components/shop/guest-shop-orders"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { cn } from "@/lib/utils"
import {
    catalogShopBrandNameClassName,
    catalogShopHoursDesktopChipClassName,
    catalogShopHoursUnderBrandClassName,
} from "@/lib/catalog-header-identity"

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
            <div
                className={cn(
                    "mx-auto flex min-h-14 items-center gap-2 px-4",
                    compact ? "max-w-lg lg:max-w-5xl" : "max-w-5xl",
                )}
            >
                <Link
                    href={backHref || `/${slug}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                    title={name}
                >
                    {compact && logoUrl ? (
                        <>
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                                <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate font-semibold tracking-tight text-foreground">{name}</span>
                                {hoursLabel ? (
                                    <span className="block truncate text-[11px] font-medium text-cyan-400">{hoursLabel}</span>
                                ) : null}
                            </span>
                        </>
                    ) : compact ? (
                        <>
                            <ShopWordmark name={name} logoUrl={logoUrl} className="text-lg text-foreground" />
                            {hoursLabel ? (
                                <span className="min-w-0 truncate text-[11px] font-medium text-cyan-400">{hoursLabel}</span>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {logoUrl ? (
                                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                                    <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                                </span>
                            ) : null}
                            <span className="min-w-0 flex-1 basis-[7rem]">
                                <span className={catalogShopBrandNameClassName}>{name}</span>
                                {hoursLabel ? (
                                    <span className={catalogShopHoursUnderBrandClassName}>{hoursLabel}</span>
                                ) : null}
                            </span>
                        </>
                    )}
                </Link>
                {compact ? null : (
                    <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">{label}</span>
                )}
                {!compact && hoursLabel ? (
                    <span className={catalogShopHoursDesktopChipClassName}>{hoursLabel}</span>
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
                <div className="flex shrink-0 items-center gap-2">
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
                    {compact ? <LiveOrderHeaderButton slug={slug} /> : <GuestShopOrdersButton slug={slug} />}
                    {themeToggle ? <ModeToggle /> : null}
                    <Link
                        href={`/${slug}/share`}
                        aria-label={`Share ${name}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
                    >
                        <Share2 className="h-4 w-4" />
                    </Link>
                    <Link
                        href={`/${slug}`}
                        aria-label={`Chat with ${name}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
                    >
                        <MessageCircle className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </header>
    )
}
