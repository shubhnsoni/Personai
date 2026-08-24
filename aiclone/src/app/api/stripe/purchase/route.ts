import { NextRequest, NextResponse } from 'next/server'
import { getUncachableStripeClient, StripeNotConfiguredError } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { convertUsdCents, stripeCurrency } from '@/lib/pricing'
import { getRequestCurrency } from '@/lib/request-currency'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { 
            itemType,
            itemId,
            visitorEmail,
            visitorName,
        } = body

        if (!itemType || !itemId) {
            return NextResponse.json(
                { error: 'Missing required fields: itemType, itemId' },
                { status: 400 }
            )
        }
        if (!visitorEmail || !String(visitorEmail).includes("@")) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 })
        }

        const headersList = await headers()
        const host = headersList.get("x-forwarded-host") || headersList.get("host") || ""
        const proto = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
        const baseUrl = `${proto}://${host}`
        const { fulfillPurchase } = await import("@/lib/members")

        let itemName = ''
        let priceCents = 0
        let profileSlug = ''
        let mode: 'payment' | 'subscription' = 'payment'

        switch (itemType) {
            case 'product': {
                const product = await prisma.digitalProduct.findUnique({
                    where: { id: itemId },
                    include: { profile: true }
                })
                if (!product) {
                    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
                }
                itemName = product.title
                priceCents = product.priceCents
                profileSlug = product.profile.slug
                break
            }
            case 'course': {
                const course = await prisma.course.findUnique({
                    where: { id: itemId },
                    include: { profile: true }
                })
                if (!course) {
                    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
                }
                itemName = course.title
                priceCents = course.priceCents
                profileSlug = course.profile.slug
                break
            }
            case 'event': {
                const event = await prisma.event.findUnique({
                    where: { id: itemId },
                    include: { profile: true }
                })
                if (!event) {
                    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
                }
                if (event.isFree || event.priceCents === 0) {
                    const result = await fulfillPurchase({
                        itemType: "event",
                        itemId: event.id,
                        visitorEmail,
                        visitorName,
                        amountCents: 0,
                        baseUrl,
                    })
                    return NextResponse.json({
                        success: true,
                        libraryUrl: result.libraryUrl,
                    })
                }
                itemName = event.title
                priceCents = event.priceCents
                profileSlug = event.profile.slug
                break
            }
            case 'community': {
                const community = await prisma.community.findUnique({
                    where: { id: itemId },
                    include: { profile: true }
                })
                if (!community) {
                    return NextResponse.json({ error: 'Community not found' }, { status: 404 })
                }
                itemName = community.name
                priceCents = community.priceCents
                profileSlug = community.profile.slug
                if (community.billingCycle !== 'ONE_TIME') {
                    mode = 'subscription'
                }
                break
            }
            default:
                return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
        }

        if (priceCents === 0) {
            const result = await fulfillPurchase({
                itemType,
                itemId,
                visitorEmail,
                visitorName,
                amountCents: 0,
                baseUrl,
            })
            return NextResponse.json({
                success: true,
                libraryUrl: result.libraryUrl,
            })
        }

        const stripe = await getUncachableStripeClient()
        const displayCurrency = await getRequestCurrency()
        const chargeAmount = convertUsdCents(priceCents, displayCurrency)

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: stripeCurrency(displayCurrency),
                        product_data: {
                            name: itemName,
                        },
                        unit_amount: chargeAmount,
                        ...(mode === 'subscription' ? { recurring: { interval: 'month' } } : {})
                    },
                    quantity: 1
                }
            ],
            mode,
            success_url: `${baseUrl}/${profileSlug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/${profileSlug}?checkout=cancelled`,
            customer_email: visitorEmail,
            metadata: {
                itemType,
                itemId,
                visitorName: visitorName || '',
                profileSlug,
                displayCurrency,
            }
        })

        return NextResponse.json({ 
            sessionId: session.id,
            url: session.url
        })
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
        }
        console.error('Purchase session error:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}
