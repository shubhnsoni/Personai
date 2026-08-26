import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { ShopWordmark } from "@/components/shop/shop-cover"
import { whatsappHref } from "@/lib/commerce"
import { ModeToggle } from "@/components/mode-toggle"
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
}: {
    slug: string
    name: string
    logoUrl?: string | null
    label: string
    backHref?: string
    whatsapp?: string | null
    themeToggle?: boolean
    compact?: boolean
}) {
    const wa = whatsappHref(whatsapp, `Hi ${name}`)
    return (
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
            <div className={cn("mx-auto flex h-14 items-center gap-2.5 px-4", compact ? "max-w-lg" : "max-w-2xl")}>
                <Link href={backHref || `/${slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    {compact && logoUrl ? (
                        <>
                            <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border" />
                            <span className="truncate font-semibold tracking-tight text-foreground">{name}</span>
                        </>
                    ) : (
                        <ShopWordmark name={name} logoUrl={logoUrl} className="text-lg text-foreground" />
                    )}
                </Link>
                {compact ? null : (
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
                )}
                {wa ? (
                    <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-[#25D366] px-2.5 py-1.5 text-[11px] font-medium text-zinc-950"
                    >
                        WhatsApp
                    </a>
                ) : null}
                {themeToggle ? <ModeToggle /> : null}
                <Link
                    href={`/${slug}`}
                    aria-label={`Chat with ${name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
                >
                    <MessageCircle className="h-4 w-4" />
                </Link>
            </div>
        </header>
    )
}
