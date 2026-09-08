import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { OfferCover } from "@/components/dashboard/offer-cover"
import { formatMoney } from "@/lib/pricing"
import { getRequestCurrency } from "@/lib/request-currency"

export const dynamic = "force-dynamic"

export default async function EventsCatalogPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const currency = await getRequestCurrency()
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            animationStyle: true,
            events: {
                where: { isActive: true, startTime: { gte: new Date() } },
                orderBy: { startTime: "asc" },
            },
        },
    })
    if (!profile || !profile.isPublic) notFound()

    let config: { colors?: string[]; variant?: string } = {}
    try {
        config = profile.animationStyle?.config ? JSON.parse(profile.animationStyle.config) : {}
    } catch { /* ignore */ }
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const logo = (profile as { shopLogoUrl?: string | null }).shopLogoUrl

    return (
        <div
            className="dark min-h-dvh bg-zinc-950 text-zinc-100"
            style={{ ["--pl-aurora" as string]: theme.accent, ["--pl-brand-foreground" as string]: theme.onAccent }}
        >
            <CatalogHeader slug={slug} name={profile.displayName} logoUrl={logo} label="Events" />
            <main className="mx-auto max-w-2xl px-4 py-5 pb-10">
                {profile.events.length === 0 ? (
                    <p className="py-16 text-center text-sm text-zinc-500">No upcoming events.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {profile.events.map((e) => (
                            <Link
                                key={e.id}
                                href={`/${slug}/events/${e.id}`}
                                className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50"
                            >
                                <OfferCover src={e.thumbnailUrl} kind={e.eventType} title={e.title} className="aspect-square" />
                                <div className="space-y-0.5 p-3">
                                    <p className="line-clamp-2 text-sm font-medium leading-snug">{e.title}</p>
                                    <p className="text-xs text-zinc-500">
                                        {new Date(e.startTime).toLocaleString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            hour: "numeric",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                    <p className="text-sm tabular-nums" style={{ color: theme.mid || theme.accent }}>
                                        {formatMoney(e.isFree ? 0 : e.priceCents, currency)}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
