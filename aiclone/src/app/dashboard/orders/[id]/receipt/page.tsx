import { notFound, redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { PrintButton } from "@/components/dashboard/print-button"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

export default async function OrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "shop", profile)
    const { id } = await params
    const purchase = await prisma.productPurchase.findFirst({
        where: { id, product: { profileId: profile.id } },
        include: { product: true },
    })
    if (!purchase) notFound()

    const rupees = (purchase.product.priceCents / 100).toFixed(2)

    return (
        <div className="mx-auto max-w-md space-y-4 px-4 py-8 print:max-w-none">
            <div className="flex items-center justify-between print:hidden">
                <Link href="/dashboard/orders" className="text-sm text-muted-foreground">
                    Back to sales
                </Link>
                <PrintButton />
            </div>
            <div className="rounded-3xl border bg-card p-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Receipt</p>
                <h1 className="mt-1 text-xl font-medium">{profile.displayName}</h1>
                {profile.gstin ? <p className="text-xs text-muted-foreground">GSTIN {profile.gstin}</p> : null}
                <div className="mt-6 space-y-1 border-t pt-4">
                    <p className="font-medium">{purchase.product.title}</p>
                    <p className="text-sm text-muted-foreground">
                        {purchase.visitorName || "Customer"} · {purchase.visitorEmail}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {purchase.payMethod || "CARD"} · {purchase.status}
                    </p>
                    {purchase.address ? <p className="text-sm text-muted-foreground">{purchase.address}</p> : null}
                </div>
                <p className="mt-6 text-3xl font-semibold tabular-nums">{rupees}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                    {purchase.createdAt.toLocaleString()}
                    {purchase.confirmedAt ? ` · confirmed ${purchase.confirmedAt.toLocaleString()}` : ""}
                </p>
            </div>
        </div>
    )
}
