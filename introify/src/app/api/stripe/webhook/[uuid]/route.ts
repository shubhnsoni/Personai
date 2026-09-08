import { NextRequest, NextResponse } from 'next/server'
import { WebhookHandlers } from '@/lib/webhook-handlers'
import { requireStripeWebhookSecret, StripeNotConfiguredError } from '@/lib/stripe'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
    }

    try {
        requireStripeWebhookSecret()
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
        }
        throw error
    }

    try {
        const rawBody = await request.arrayBuffer()
        const payload = Buffer.from(rawBody)

        await WebhookHandlers.processWebhook(payload, signature, uuid)

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
        }
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 400 })
    }
}
