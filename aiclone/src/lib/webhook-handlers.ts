import Stripe from 'stripe'
import { getUncachableStripeClient, requireStripeWebhookSecret } from './stripe'
import { prisma } from './prisma'
import { sendPurchaseConfirmation, sendCreatorNotification } from './email'

export class WebhookHandlers {
    static async processWebhook(payload: Buffer, signature: string, _uuid?: string): Promise<void> {
        const webhookSecret = requireStripeWebhookSecret()

        const stripe = await getUncachableStripeClient()
        const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const metadata = session.metadata || {}

                if (metadata.type === 'product' && metadata.productId) {
                    await prisma.productPurchase.updateMany({
                        where: { paymentId: session.id },
                        data: { status: 'COMPLETED' },
                    })
                }

                if (metadata.type === 'course' && metadata.courseId) {
                    await prisma.courseEnrollment.updateMany({
                        where: { paymentId: session.id },
                        data: { status: 'ACTIVE' },
                    })
                }

                if (metadata.type === 'event' && metadata.eventId) {
                    await prisma.eventRegistration.updateMany({
                        where: { paymentId: session.id },
                        data: { status: 'REGISTERED' },
                    })
                }

                if (metadata.type === 'community' && metadata.communityId) {
                    await prisma.communityMember.updateMany({
                        where: { paymentId: session.id },
                        data: { status: 'ACTIVE' },
                    })
                }

                if (metadata.type === 'booking' && metadata.bookingId) {
                    await prisma.booking.update({
                        where: { id: metadata.bookingId },
                        data: { status: 'CONFIRMED' },
                    })
                }

                console.log(`[Stripe] Checkout completed: ${session.id} (${metadata.type})`)
                break
            }

            case 'payment_intent.succeeded': {
                console.log(`[Stripe] Payment succeeded: ${(event.data.object as Stripe.PaymentIntent).id}`)
                break
            }

            default:
                console.log(`[Stripe] Unhandled event: ${event.type}`)
        }
    }
}
