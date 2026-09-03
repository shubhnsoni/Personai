import { notFound, redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { requireSurface } from "@/lib/require-surface"
import { OrderReceiptClient } from "@/components/dashboard/order-receipt-client"

export const dynamic = "force-dynamic"

function money(cents: number, currency: string) {
    try {
        return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100)
    } catch {
        return `${currency} ${(cents / 100).toFixed(2)}`
    }
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
            <OrderReceiptClient
                data={{
                    shopName: profile.displayName,
                    gstin: profile.gstin,
                    number: order.number,
                    tableLabel: order.tableLabel,
                    guestName: order.guestName,
                    guestEmail: order.guestEmail,
                    status: order.status,
                    payStatus: order.payStatus,
                    payMethod: order.payMethod,
                    placedAt: order.placedAt.toLocaleString(),
                    lines: order.lines.map((line) => ({
                        qty: line.qty,
                        title: line.titleSnapshot,
                        modifiersLabel: line.modifiersLabel,
                        lineTotal: money(line.lineTotalCents, order.currency),
                    })),
                    subtotal: money(order.subtotalCents, order.currency),
                    tax: order.taxCents ? money(order.taxCents, order.currency) : null,
                    total: money(order.totalCents, order.currency),
                    upiId: profile.upiId,
                }}
            />
        )
    }

    const purchase = await prisma.productPurchase.findFirst({
        where: { id, product: { profileId: profile.id } },
        include: { product: true },
    })
    if (!purchase) notFound()

    return (
        <OrderReceiptClient
            data={{
                shopName: profile.displayName,
                gstin: profile.gstin,
                number: purchase.id.slice(-6).toUpperCase(),
                tableLabel: purchase.address,
                guestName: purchase.visitorName,
                guestEmail: purchase.visitorEmail,
                status: purchase.status,
                payStatus: purchase.status,
                payMethod: purchase.payMethod,
                placedAt: purchase.createdAt.toLocaleString(),
                lines: [{
                    qty: 1,
                    title: purchase.product.title,
                    lineTotal: money(purchase.product.priceCents, purchase.product.currency),
                }],
                subtotal: money(purchase.product.priceCents, purchase.product.currency),
                total: money(purchase.product.priceCents, purchase.product.currency),
                upiId: profile.upiId,
            }}
        />
    )
}
