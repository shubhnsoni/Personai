import { notFound, redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { requireSurface } from "@/lib/require-surface"
import { OrderReceiptClient } from "@/components/dashboard/order-receipt-client"
import { parseDistroMeta } from "@/lib/distribute/meta"
import { computeGstBreakup, gstReceiptLines } from "@/lib/billing/gst"

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

    if (profile.roleTemplate === "RESTAURANT" || profile.roleTemplate === "DISTRIBUTOR") {
        const order = await prisma.order.findFirst({
            where: { id, profileId: profile.id },
            include: { lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
        })
        if (!order) notFound()

        const distro = profile.roleTemplate === "DISTRIBUTOR"
            ? parseDistroMeta(order.staffNote, order.guestName, order.tableLabel)
            : null
        const gstin = distro?.gstin || profile.gstin
        const gstLines = distro?.gstMode
            ? gstReceiptLines({
                mode: distro.gstMode,
                rateBps: distro.gstRateBps,
                gstPaise: distro.gstPaise,
                cgstPaise: distro.cgstPaise,
                sgstPaise: distro.sgstPaise,
                igstPaise: distro.igstPaise,
            }).map((g) => ({ label: g.label, amount: money(g.paise, order.currency) }))
            : []
        const taxablePaise = distro && distro.taxablePaise > 0 ? distro.taxablePaise : order.subtotalCents

        const rateBps = distro?.gstRateBps || 1800
        const placed = order.placedAt.toLocaleString("en-IN")
        return (
            <OrderReceiptClient
                data={{
                    shopName: profile.displayName,
                    gstin,
                    buyerName: distro?.dealer || order.guestName,
                    buyerGstin: distro?.buyerGstin || null,
                    buyerPlace: distro?.location || order.tableLabel,
                    invoice: distro?.invoice || order.paymentRef,
                    invoiceDate: placed,
                    number: order.number,
                    tableLabel: order.tableLabel,
                    guestName: order.guestName,
                    guestEmail: order.guestEmail,
                    status: order.status,
                    payStatus: order.payStatus,
                    payMethod: order.payMethod,
                    placedAt: placed,
                    lines: order.lines.map((line) => {
                        const hsn = typeof line.modifiersLabel === "string" && line.modifiersLabel.startsWith("HSN:")
                            ? line.modifiersLabel.slice(4).trim()
                            : ""
                        const br = computeGstBreakup(line.lineTotalCents, { rateBps })
                        return {
                            qty: line.qty,
                            title: line.titleSnapshot,
                            modifiersLabel: hsn ? null : line.modifiersLabel,
                            hsn,
                            rate: money(line.unitPriceCents, order.currency),
                            taxable: money(br.taxablePaise, order.currency),
                            tax: money(br.gstPaise, order.currency),
                            lineTotal: money(line.lineTotalCents, order.currency),
                        }
                    }),
                    subtotal: money(taxablePaise || order.subtotalCents, order.currency),
                    taxable: distro && distro.taxablePaise > 0 ? money(distro.taxablePaise, order.currency) : null,
                    gstLines,
                    tax: !gstLines.length && order.taxCents ? money(order.taxCents, order.currency) : null,
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
