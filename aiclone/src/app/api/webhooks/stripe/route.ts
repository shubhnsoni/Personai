import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get("Stripe-Signature") as string

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error) {
        return new Response(`Webhook Error: ${error}`, { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session

    if (event.type === "checkout.session.completed") {
        const bookingId = session.metadata?.bookingId

        if (bookingId) {
            // Update booking status
            await prisma.booking.update({
                where: { id: bookingId },
                data: { status: "CONFIRMED" }
            })

            // Create payment record
            // We need profileId, which we can get from booking
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId }
            })

            if (booking) {
                await prisma.payment.create({
                    data: {
                        profileId: booking.profileId,
                        bookingId: booking.id,
                        amountCents: session.amount_total || 0,
                        currency: session.currency || "usd",
                        status: "SUCCEEDED",
                        provider: "STRIPE",
                        providerPaymentId: session.payment_intent as string
                    }
                })
            }
        }
    }

    return new Response(null, { status: 200 })
}
