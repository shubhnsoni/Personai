import { NextRequest, NextResponse } from 'next/server'
import { getUncachableStripeClient, getStripePublishableKey } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            priceId,
            productId,
            productType,
            profileId,
            visitorEmail,
            visitorName,
            successUrl,
            cancelUrl
        } = body

        if (!priceId || !productType || !profileId) {
            return NextResponse.json(
                { error: 'Missing required fields: priceId, productType, profileId' },
                { status: 400 }
            )
        }

        const stripe = await getUncachableStripeClient()

        const profile = await prisma.profile.findUnique({
            where: { id: profileId },
            select: { displayName: true, slug: true }
        })

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const headersList = await headers()
        const host = headersList.get('host') || ''
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1
                }
            ],
            mode: productType === 'SUBSCRIPTION' ? 'subscription' : 'payment',
            success_url: successUrl || `${baseUrl}/${profile.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${baseUrl}/${profile.slug}?checkout=cancelled`,
            customer_email: visitorEmail,
            metadata: {
                profileId,
                productId: productId || '',
                productType,
                visitorName: visitorName || ''
            }
        })

        return NextResponse.json({
            sessionId: session.id,
            url: session.url
        })
    } catch (error) {
        console.error('Checkout session error:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}

export async function GET() {
    try {
        const publishableKey = await getStripePublishableKey()
        return NextResponse.json({ publishableKey })
    } catch (error) {
        console.error('Error getting publishable key:', error)
        return NextResponse.json(
            { error: 'Failed to get Stripe publishable key' },
            { status: 500 }
        )
    }
}
