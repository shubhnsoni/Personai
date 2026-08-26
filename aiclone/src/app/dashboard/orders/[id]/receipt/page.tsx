import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { PrintButton } from "@/components/dashboard/print-button"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

function money(cents: number, currency: string) {
    try {
        return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100)
    } catch {
        return `${currency} ${(cents / 100).toFixed(2)}`
    }
}

function ReceiptFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto max-w-md space-y-4 px-4 py-8 print:max-w-none">
            <div className="flex items-center justify-between print:hidden">
                <Link href="/dashboard/orders" className="text-sm text-muted-foreground">Back to sales</Link>
                <PrintButton />
            </div>
            <div className="rounded-3xl border bg-card p-6">{children}</div>
        </div>
    )
}

export default async function OrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "shop", profile)
    const { id } = await params

    if (profile.roleTemplate === "RESTAURANT") {
        const order = await prisma.order.findFirst({
            where: { id, profileId: profile.id },
            include: { lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
        })
        if (!order) notFound()

        return (
            <ReceiptFrame>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Receipt · Order #{order.number}</p>
                <h1 className="mt-1 text-xl font-medium">{profile.displayName}</h1>
                {profile.gstin ? <p className="text-xs text-muted-foreground">GSTIN {profile.gstin}</p> : null}
                <div className="mt-5 space-y-1 border-t pt-4 text-sm">
                    <p className="font-medium">{order.guestName || "Guest"}</p>
                    {order.guestEmail ? <p className="text-muted-foreground">{order.guestEmail}</p> : null}
                    <p className="text-muted-foreground">{order.tableLabel || "Takeaway"}</p>
                    <p className="text-muted-foreground">{order.payMethod || "Payment pending"} · {order.payStatus} · {order.status}</p>
                </div>
                <div className="mt-5 divide-y border-y">
                    {order.lines.map((line) => (
                        <div key={line.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                            <div className="min-w-0">
                                <p className="font-medium">{line.qty}× {line.titleSnapshot}</p>
                                {line.modifiersLabel ? <p className="text-xs text-muted-foreground">{line.modifiersLabel}</p> : null}
                                <p className="text-[11px] text-muted-foreground">
                                    {money(line.unitPriceCents + line.unitModifierCents, order.currency)} each
                                </p>
                            </div>
                            <span className="shrink-0 tabular-nums">{money(line.lineTotalCents, order.currency)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotalCents, order.currency)}</span></div>
                    {order.taxCents ? <div className="flex justify-between"><span>Tax</span><span>{money(order.taxCents, order.currency)}</span></div> : null}
                    <div className="flex justify-between pt-2 text-xl font-semibold"><span>Total</span><span>{money(order.totalCents, order.currency)}</span></div>
                </div>
                <p className="mt-5 text-[11px] text-muted-foreground">
                    Placed {order.placedAt.toLocaleString()}
                    {order.paidAt ? ` · paid ${order.paidAt.toLocaleString()}` : ""}
                </p>
            </ReceiptFrame>
        )
    }

    const purchase = await prisma.productPurchase.findFirst({
        where: { id, product: { profileId: profile.id } },
        include: { product: true },
    })
    if (!purchase) notFound()

    return (
        <ReceiptFrame>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Receipt</p>
            <h1 className="mt-1 text-xl font-medium">{profile.displayName}</h1>
            {profile.gstin ? <p className="text-xs text-muted-foreground">GSTIN {profile.gstin}</p> : null}
            <div className="mt-6 space-y-1 border-t pt-4">
                <p className="font-medium">{purchase.product.title}</p>
                <p className="text-sm text-muted-foreground">{purchase.visitorName || "Customer"} · {purchase.visitorEmail}</p>
                <p className="text-sm text-muted-foreground">{purchase.payMethod || "CARD"} · {purchase.status}</p>
                {purchase.address ? <p className="text-sm text-muted-foreground">{purchase.address}</p> : null}
            </div>
            <p className="mt-6 text-3xl font-semibold tabular-nums">{money(purchase.product.priceCents, purchase.product.currency)}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
                {purchase.createdAt.toLocaleString()}
                {purchase.confirmedAt ? ` · confirmed ${purchase.confirmedAt.toLocaleString()}` : ""}
            </p>
        </ReceiptFrame>
    )
}
