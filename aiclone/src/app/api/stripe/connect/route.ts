import { NextRequest, NextResponse } from 'next/server'
import { getUncachableStripeClient, StripeNotConfiguredError } from '@/lib/stripe'
import { syncUser } from '@/lib/auth-sync'
import { headers } from 'next/headers'

function paymentsNotConfigured() {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
}

// POST: Create a Stripe Connect onboarding link for the creator
export async function POST(_request: NextRequest) {
    try {
        const user = await syncUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const stripe = await getUncachableStripeClient()
        const headersList = await headers()
        const host = headersList.get('host') || ''
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`

        const account = await stripe.accounts.create({
            type: 'express',
            email: user.email,
            metadata: { userId: user.id },
        })

        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${baseUrl}/dashboard/payments?connect=refresh`,
            return_url: `${baseUrl}/dashboard/payments?connect=success`,
            type: 'account_onboarding',
        })

        return NextResponse.json({ url: accountLink.url, type: 'onboarding' })
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return paymentsNotConfigured()
        }
        console.error('Stripe Connect error:', error)
        return NextResponse.json(
            { error: 'Failed to create Connect account' },
            { status: 500 }
        )
    }
}

// GET: Check Connect account status
export async function GET() {
    try {
        const user = await syncUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await getUncachableStripeClient()
        return NextResponse.json({ connected: false })
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return paymentsNotConfigured()
        }
        console.error('Connect status error:', error)
        return NextResponse.json({ connected: false })
    }
}
