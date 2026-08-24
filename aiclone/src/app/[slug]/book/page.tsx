import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { BookList } from "./book-list"
import { isRestaurant } from "@/lib/menu"
import { ensureTableService } from "@/app/actions/bookings"
import { Tracker } from "@/components/profile/tracker"

export const dynamic = "force-dynamic"

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            animationStyle: true,
            serviceOfferings: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
        },
    })
    if (!profile || !profile.isPublic) notFound()

    const restaurant = isRestaurant(profile.roleTemplate)
    if (restaurant && !profile.serviceOfferings.some((s) => (s as { kind?: string }).kind === "TABLE")) {
        await ensureTableService(profile.id)
        const again = await prisma.serviceOffering.findMany({
            where: { profileId: profile.id, isActive: true },
            orderBy: { createdAt: "desc" },
        })
        profile.serviceOfferings = again
    }

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
            <Tracker slug={slug} name={restaurant ? "reserve_open" : "visit"} />
            <CatalogHeader
                slug={slug}
                name={profile.displayName}
                logoUrl={logo}
                label={restaurant ? "Reserve" : "Book"}
            />
            <main className="mx-auto max-w-2xl px-4 py-5 pb-10">
                {profile.serviceOfferings.length === 0 ? (
                    <p className="py-16 text-center text-sm text-zinc-500">
                        {restaurant ? "Reservations are not open yet." : "No sessions to book."}
                    </p>
                ) : (
                    <BookList
                        profile={{ id: profile.id, displayName: profile.displayName, whatsapp: profile.whatsapp }}
                        services={profile.serviceOfferings}
                        restaurant={restaurant}
                    />
                )}
            </main>
        </div>
    )
}
