import { NextRequest, NextResponse } from 'next/server'
import { getUncachableStripeClient, StripeNotConfiguredError } from '@/lib/stripe'
import { syncUser } from '@/lib/auth-sync'

function paymentsNotConfigured() {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
}

// User has no stripeConnectAccountId column yet. Creating Express accounts
// here would orphan them on every retry. When the column exists: load-or-create,
// persist the id, then mint an Account Link using env.appUrl (never Host).
function connectNotPersisted() {
    return NextResponse.json({ connected: false, url: null }, { status: 501 })
}

// POST: Connect onboarding is unavailable until account ids can be stored
export async function POST(_request: NextRequest) {
    try {
        const user = await syncUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await getUncachableStripeClient()
        return connectNotPersisted()
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
        return NextResponse.json({ connected: false, url: null })
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return paymentsNotConfigured()
        }
        console.error('Connect status error:', error)
        return NextResponse.json({ connected: false, url: null })
    }
}
