import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { AdminStat } from "@/components/admin/admin-stat"

export const dynamic = "force-dynamic"

export default async function AdminGrowthPage() {
    await requireAdmin()
    const [offers, magnets, shorts] = await Promise.all([
        prisma.digitalProduct.count({
            where: {
                isActive: true,
                compareAtCents: { not: null },
                profile: { slug: { not: { startsWith: "try-" } } },
            },
        }).catch(() => 0),
        prisma.leadMagnet.count({
            where: { isActive: true, profile: { slug: { not: { startsWith: "try-" } } } },
        }).catch(() => 0),
        prisma.shortLink.count({
            where: { isActive: true, profile: { slug: { not: { startsWith: "try-" } } } },
        }).catch(() => 0),
    ])

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Growth</h1>
                <p className="text-sm text-muted-foreground">
                    You run Introify coupons, campaigns, and owner-brings-owner referrals here.
                    Shop making-charge codes stay in Studio.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <AdminStat label="Shop catalog offers" value={String(offers)} hint="compare-at price on live products" />
                <AdminStat label="Lead magnets" value={String(magnets)} hint="owner giveaways" />
                <AdminStat label="Short links" value={String(shorts)} hint="owner vanity /l/ codes" />
            </div>
            <section className="rounded-xl border p-4 text-sm">
                <h2 className="font-medium">Next on this page</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Platform coupons — trial days, AR credits, invite codes you issue to shop owners.</li>
                    <li>Offers — directory / dashboard campaigns (Dhanteras week), not product editors.</li>
                    <li>Referrals — owner-brings-owner codes, leaderboard, first-paid reward.</li>
                </ul>
            </section>
        </div>
    )
}
