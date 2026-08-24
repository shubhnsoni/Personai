import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { CourseEnrollButton } from "@/components/catalog/enroll-button"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { OfferCover } from "@/components/dashboard/offer-cover"
import { formatMoney } from "@/lib/pricing"
import { getRequestCurrency } from "@/lib/request-currency"

export const dynamic = "force-dynamic"

export default async function EventSalesPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
    const { slug, id } = await params
    const currency = await getRequestCurrency()
    const event = await prisma.event.findFirst({
        where: { id, isActive: true, profile: { slug, isPublic: true } },
        include: {
            profile: { include: { animationStyle: true } },
            _count: { select: { registrations: true } },
        },
    })
    if (!event) notFound()

    let config: { colors?: string[]; variant?: string } = {}
    try {
        config = event.profile.animationStyle?.config ? JSON.parse(event.profile.animationStyle.config) : {}
    } catch { /* ignore */ }
    const theme = ORB_THEMES[resolveOrbVariant(config.colors, config.variant)]
    const logo = (event.profile as { shopLogoUrl?: string | null }).shopLogoUrl
    const online = !event.location && event.meetingUrl
    const remaining = event.maxAttendees ? Math.max(0, event.maxAttendees - event._count.registrations) : null
    const when = new Date(event.startTime).toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    })

    return (
        <div
            className="dark min-h-dvh bg-zinc-950 text-zinc-100"
            style={{ ["--pl-aurora" as string]: theme.accent, ["--pl-brand-foreground" as string]: theme.onAccent }}
        >
            <CatalogHeader
                slug={slug}
                name={event.profile.displayName}
                logoUrl={logo}
                label="Events"
                backHref={`/${slug}/events`}
            />
            <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-28">
                <OfferCover
                    src={event.thumbnailUrl}
                    kind={event.eventType}
                    title={event.title}
                    className="aspect-square w-full overflow-hidden rounded-2xl"
                />
                <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{event.eventType}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
                    <p className="mt-2 text-sm text-zinc-400">{when}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                        {online ? "Online" : event.location || "Location TBD"}
                        {event.timezone ? ` · ${event.timezone}` : ""}
                    </p>
                    {remaining !== null && (
                        <p className="mt-1 text-sm text-zinc-500">{remaining} seats left</p>
                    )}
                </div>
                <p className="text-3xl font-semibold tabular-nums">{formatMoney(event.isFree ? 0 : event.priceCents, currency)}</p>
                {event.description && (
                    <p className="whitespace-pre-wrap text-zinc-300">{event.description}</p>
                )}
                <Link href={`/${slug}`} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
                    {event.profile.imageUrl && (
                        <img src={event.profile.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    )}
                    <div>
                        <p className="font-medium">{event.profile.displayName}</p>
                        <p className="text-xs text-zinc-500">{event.profile.headline}</p>
                    </div>
                </Link>
            </main>
            <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <CourseEnrollButton
                    item={{
                        itemType: "event",
                        itemId: event.id,
                        title: event.title,
                        priceCents: event.isFree ? 0 : event.priceCents,
                        description: event.description,
                    }}
                />
            </div>
        </div>
    )
}
