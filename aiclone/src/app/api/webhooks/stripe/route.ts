import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getUncachableStripeClient, requireStripeWebhookSecret, StripeNotConfiguredError } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { sendCreatorNotification } from "@/lib/email"
import Stripe from "stripe"

export async function POST(req: Request) {
    let webhookSecret: string
    try {
        webhookSecret = requireStripeWebhookSecret()
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return NextResponse.json({ error: "payments_not_configured" }, { status: 503 })
        }
        throw error
    }

    const body = await req.text()
    const signature = (await headers()).get("Stripe-Signature")

    if (!signature) {
        return new Response("Missing signature", { status: 400 })
    }

    let stripe: Stripe
    try {
        stripe = await getUncachableStripeClient()
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return NextResponse.json({ error: "payments_not_configured" }, { status: 503 })
        }
        throw error
    }
    
    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            webhookSecret
        )
    } catch (error) {
        console.error("Webhook signature verification failed:", error)
        return new Response(`Webhook Error: ${error}`, { status: 400 })
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata
        
        if (!metadata) {
            console.log("No metadata in session")
            return new Response(null, { status: 200 })
        }

        const { itemType, itemId, visitorName } = metadata
        const visitorEmail = session.customer_email || "anonymous@example.com"
        const paymentId = session.payment_intent as string
        const headersList = await headers()
        const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
        const proto = headersList.get("x-forwarded-proto") || "https"
        const baseUrl = `${proto}://${host}`

        try {
            if (itemType && itemId && ["product", "course", "event", "community"].includes(itemType)) {
                const { fulfillPurchase } = await import("@/lib/members")
                await fulfillPurchase({
                    itemType: itemType as "product" | "course" | "event" | "community",
                    itemId,
                    visitorEmail,
                    visitorName,
                    paymentId,
                    amountCents: session.amount_total || 0,
                    baseUrl,
                })
                console.log(`Fulfilled ${itemType} purchase for ${visitorEmail}`)
            } else switch (itemType) {
                case "ar-build": {
                    const batchId = metadata.itemId
                    const profileId = metadata.profileId
                    if (batchId && profileId) {
                        const { markBatchPaid, tickBatch } = await import("@/lib/ar-builds")
                        await markBatchPaid(batchId, paymentId)
                        await tickBatch(batchId, profileId)
                    }
                    break
                }

                case "booking": {
                    const bookingId = metadata.bookingId
                    if (bookingId) {
                        await prisma.booking.update({
                            where: { id: bookingId },
                            data: { status: "CONFIRMED" }
                        })

                        const booking = await prisma.booking.findUnique({
                            where: { id: bookingId },
                            include: { 
                                profile: { include: { user: true } },
                                serviceOffering: true
                            }
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
                                    providerPaymentId: paymentId
                                }
                            })

                            await sendCreatorNotification({
                                creatorEmail: booking.profile.user.email,
                                creatorName: booking.profile.displayName,
                                itemType: 'booking',
                                itemName: booking.serviceOffering?.name || 'Booking',
                                priceCents: session.amount_total || 0,
                                customerEmail: visitorEmail,
                                customerName: visitorName
                            })
                        }
                    }
                    break
                }
                
            }
            
            console.log(`Fulfilled ${itemType} purchase for ${visitorEmail}`)
        } catch (error) {
            console.error(`Error fulfilling ${itemType}:`, error)
        }
    }

    if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata
        
        if (metadata?.itemType === "community" && metadata?.itemId) {
            await prisma.communityMember.updateMany({
                where: { 
                    communityId: metadata.itemId,
                    paymentId: subscription.id
                },
                data: { status: "EXPIRED" }
            })
        }
    }

    return new Response(null, { status: 200 })
}
