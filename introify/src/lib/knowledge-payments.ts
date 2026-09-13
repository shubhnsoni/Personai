import Stripe from "stripe"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { normalizeEmail } from "@/lib/members"

type PaymentDb = Prisma.TransactionClient | typeof prisma

export async function recordKnowledgePaymentEvent(event: Stripe.Event, db: PaymentDb = prisma): Promise<void> {
    const stripeAccountId = event.account || "platform"

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status !== "paid") return
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
        if (!paymentIntentId) return
        const buyerEmail = normalizeEmail(session.customer_details?.email || session.customer_email || "")
        if (!buyerEmail || !buyerEmail.includes("@")) return

        const metadata = session.metadata || {}
        let profileId: string | null = null
        let itemType: "PRODUCT" | "SERVICE" | null = null
        let itemId: string | null = null

        const productId = (metadata.itemType === "product" && metadata.itemId) || (metadata.type === "product" && metadata.productId) || null
        const bookingId = (metadata.itemType === "booking" && (metadata.bookingId || metadata.itemId)) || (metadata.type === "booking" && metadata.bookingId) || null

        if (productId) {
            const product = await db.digitalProduct.findUnique({ where: { id: productId }, select: { id: true, profileId: true } })
            if (!product) return
            profileId = product.profileId
            itemType = "PRODUCT"
            itemId = product.id
        } else if (bookingId) {
            const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { profileId: true, serviceOfferingId: true } })
            if (!booking) return
            profileId = booking.profileId
            itemType = "SERVICE"
            itemId = booking.serviceOfferingId
        }
        if (!profileId || !itemType || !itemId) return

        await db.knowledgePaymentProof.upsert({
            where: { stripeAccountId_checkoutSessionId: { stripeAccountId, checkoutSessionId: session.id } },
            create: { stripeAccountId, checkoutSessionId: session.id, paymentIntentId, profileId, itemType, itemId, buyerEmail },
            update: {},
        })
        return
    }

    if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null
        if (!paymentIntentId || (!(charge.amount_refunded > 0) && !charge.refunded)) return
        await db.knowledgePaymentBlock.upsert({
            where: { stripeAccountId_paymentIntentId: { stripeAccountId, paymentIntentId } },
            create: { stripeAccountId, paymentIntentId, reason: "refunded" },
            update: {},
        })
        return
    }

    if (event.type === "charge.dispute.created") {
        const dispute = event.data.object as Stripe.Dispute
        const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null
        if (!paymentIntentId) return
        await db.knowledgePaymentBlock.upsert({
            where: { stripeAccountId_paymentIntentId: { stripeAccountId, paymentIntentId } },
            create: { stripeAccountId, paymentIntentId, reason: "dispute" },
            update: {},
        })
    }
}
