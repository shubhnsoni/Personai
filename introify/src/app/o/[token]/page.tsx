import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { payModeFromConfig, paymentQrUrlFromConfig } from "@/lib/payment-qr"
import { ensureProfilePaymentQr } from "@/app/actions/payment-qr"
import { GuestOrderStatus } from "@/components/shop/guest-order-status"

export const dynamic = "force-dynamic"

export default async function GuestOrderPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const publicToken = token?.trim()
    if (!publicToken) notFound()

    const order = await prisma.order.findUnique({
        where: { publicToken },
        include: {
            lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            profile: {
                select: {
                    displayName: true,
                    slug: true,
                    upiId: true,
                    personalityConfig: true,
                    shopLogoUrl: true,
                    imageUrl: true,
                },
            },
        },
    })
    if (!order) notFound()
    const extra = await prisma.$queryRaw<Array<{ dueAt: Date | null; staffNote: string | null }>>`
        SELECT "dueAt", "staffNote" FROM "Order" WHERE id = ${order.id}
    `.catch(() => [{ dueAt: null, staffNote: null }])
    const paymentQrUrl = paymentQrUrlFromConfig(order.profile.personalityConfig)
        || await ensureProfilePaymentQr(order.profileId)

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <GuestOrderStatus
                initial={{
                    token: order.publicToken,
                    number: order.number,
                    status: order.status,
                    payStatus: order.payStatus,
                    payMethod: order.payMethod,
                    payMode: payModeFromConfig(order.profile.personalityConfig),
                    guestPaid: order.paymentRef === "guest-confirmed",
                    channel: order.channel,
                    tableLabel: order.tableLabel,
                    totalCents: order.totalCents,
                    currency: order.currency,
                    placedAt: order.placedAt.toISOString(),
                    readyAt: order.readyAt?.toISOString() || null,
                    dueAt: extra[0]?.dueAt ? extra[0].dueAt.toISOString() : null,
                    staffNote: extra[0]?.staffNote || null,
                    shopName: order.profile.displayName,
                    slug: order.profile.slug,
                    upiId: order.profile.upiId,
                    paymentQrUrl,
                    logoUrl: order.profile.shopLogoUrl || order.profile.imageUrl,
                    lines: order.lines.map((line) => ({
                        title: line.titleSnapshot,
                        qty: line.qty,
                        modifiersLabel: line.modifiersLabel,
                        status: line.status,
                        lineTotalCents: line.lineTotalCents,
                    })),
                }}
            />
        </div>
    )
}
