import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { ShopWordmark } from "@/components/shop/shop-cover"
import { whatsappHref } from "@/lib/commerce"

export function CatalogHeader({
    slug,
    name,
    logoUrl,
    label,
    backHref,
    whatsapp,
}: {
    slug: string
    name: string
    logoUrl?: string | null
    label: string
    backHref?: string
    whatsapp?: string | null
}) {
    const wa = whatsappHref(whatsapp, `Hi ${name}`)
    return (
        <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
                <Link href={backHref || `/${slug}`} className="min-w-0 flex-1">
                    <ShopWordmark name={name} logoUrl={logoUrl} className="text-lg" />
                </Link>
                <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
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
                <Link
                    href={`/${slug}`}
                    aria-label={`Chat with ${name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-200 hover:bg-white/5"
                >
                    <MessageCircle className="h-4 w-4" />
                </Link>
            </div>
        </header>
    )
}
