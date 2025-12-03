import { headers } from "next/headers"
import { getUncachableStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { sendPurchaseConfirmation, sendCreatorNotification } from "@/lib/email"
import Stripe from "stripe"

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get("Stripe-Signature") as string

    if (!signature) {
        return new Response("Missing signature", { status: 400 })
    }

    const stripe = await getUncachableStripeClient()
    
    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
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

        try {
            switch (itemType) {
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
                
                case "product": {
                    const product = await prisma.digitalProduct.findUnique({
                        where: { id: itemId },
                        include: { profile: { include: { user: true } } }
                    })
                    
                    if (product) {
                        await prisma.productPurchase.create({
                            data: {
                                productId: itemId,
                                visitorEmail,
                                visitorName: visitorName || null,
                                paymentId,
                                status: "COMPLETED"
                            }
                        })

                        await prisma.payment.create({
                            data: {
                                profileId: product.profileId,
                                amountCents: session.amount_total || 0,
                                currency: session.currency || "usd",
                                status: "SUCCEEDED",
                                provider: "STRIPE",
                                providerPaymentId: paymentId
                            }
                        })

                        await sendPurchaseConfirmation({
                            visitorEmail,
                            visitorName: visitorName || undefined,
                            itemType: 'product',
                            itemName: product.title,
                            priceCents: product.priceCents,
                            profileDisplayName: product.profile.displayName,
                            downloadUrl: product.fileUrl || undefined
                        })

                        await sendCreatorNotification({
                            creatorEmail: product.profile.user.email,
                            creatorName: product.profile.displayName,
                            itemType: 'product',
                            itemName: product.title,
                            priceCents: product.priceCents,
                            customerEmail: visitorEmail,
                            customerName: visitorName
                        })
                    }
                    break
                }
                
                case "course": {
                    const course = await prisma.course.findUnique({
                        where: { id: itemId },
                        include: { profile: { include: { user: true } } }
                    })
                    
                    if (course) {
                        await prisma.courseEnrollment.create({
                            data: {
                                courseId: itemId,
                                visitorEmail,
                                visitorName: visitorName || null,
                                paymentId,
                                status: "ACTIVE",
                                progress: JSON.stringify({})
                            }
                        })

                        await prisma.payment.create({
                            data: {
                                profileId: course.profileId,
                                amountCents: session.amount_total || 0,
                                currency: session.currency || "usd",
                                status: "SUCCEEDED",
                                provider: "STRIPE",
                                providerPaymentId: paymentId
                            }
                        })

                        await sendPurchaseConfirmation({
                            visitorEmail,
                            visitorName: visitorName || undefined,
                            itemType: 'course',
                            itemName: course.title,
                            priceCents: course.priceCents,
                            profileDisplayName: course.profile.displayName
                        })

                        await sendCreatorNotification({
                            creatorEmail: course.profile.user.email,
                            creatorName: course.profile.displayName,
                            itemType: 'course',
                            itemName: course.title,
                            priceCents: course.priceCents,
                            customerEmail: visitorEmail,
                            customerName: visitorName
                        })
                    }
                    break
                }
                
                case "event": {
                    const eventItem = await prisma.event.findUnique({
                        where: { id: itemId },
                        include: { profile: { include: { user: true } } }
                    })
                    
                    if (eventItem) {
                        await prisma.eventRegistration.create({
                            data: {
                                eventId: itemId,
                                visitorEmail,
                                visitorName: visitorName || null,
                                paymentId,
                                status: "REGISTERED"
                            }
                        })

                        await prisma.payment.create({
                            data: {
                                profileId: eventItem.profileId,
                                amountCents: session.amount_total || 0,
                                currency: session.currency || "usd",
                                status: "SUCCEEDED",
                                provider: "STRIPE",
                                providerPaymentId: paymentId
                            }
                        })

                        await sendPurchaseConfirmation({
                            visitorEmail,
                            visitorName: visitorName || undefined,
                            itemType: 'event',
                            itemName: eventItem.title,
                            priceCents: eventItem.priceCents,
                            profileDisplayName: eventItem.profile.displayName,
                            eventDetails: {
                                startTime: eventItem.startTime,
                                endTime: eventItem.endTime,
                                meetingLink: eventItem.meetingUrl || undefined
                            }
                        })

                        await sendCreatorNotification({
                            creatorEmail: eventItem.profile.user.email,
                            creatorName: eventItem.profile.displayName,
                            itemType: 'event',
                            itemName: eventItem.title,
                            priceCents: eventItem.priceCents,
                            customerEmail: visitorEmail,
                            customerName: visitorName
                        })
                    }
                    break
                }
                
                case "community": {
                    const community = await prisma.community.findUnique({
                        where: { id: itemId },
                        include: { profile: { include: { user: true } } }
                    })
                    
                    if (community) {
                        const subscriptionEndsAt = community.billingCycle === "ONE_TIME" 
                            ? null 
                            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

                        await prisma.communityMember.create({
                            data: {
                                communityId: itemId,
                                visitorEmail,
                                visitorName: visitorName || null,
                                paymentId,
                                status: "ACTIVE",
                                subscriptionEndsAt
                            }
                        })

                        await prisma.payment.create({
                            data: {
                                profileId: community.profileId,
                                amountCents: session.amount_total || 0,
                                currency: session.currency || "usd",
                                status: "SUCCEEDED",
                                provider: "STRIPE",
                                providerPaymentId: paymentId
                            }
                        })

                        await sendPurchaseConfirmation({
                            visitorEmail,
                            visitorName: visitorName || undefined,
                            itemType: 'community',
                            itemName: community.name,
                            priceCents: community.priceCents,
                            profileDisplayName: community.profile.displayName,
                            accessUrl: community.inviteLink || undefined
                        })

                        await sendCreatorNotification({
                            creatorEmail: community.profile.user.email,
                            creatorName: community.profile.displayName,
                            itemType: 'community',
                            itemName: community.name,
                            priceCents: community.priceCents,
                            customerEmail: visitorEmail,
                            customerName: visitorName
                        })
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
