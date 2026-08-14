import { NextRequest, NextResponse } from 'next/server'
import { getUncachableStripeClient, StripeNotConfiguredError } from '@/lib/stripe'
import { syncUser } from '@/lib/auth-sync'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

function paymentsNotConfigured() {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
}

// POST: load-or-create Express account, persist stripeConnectAccountId, mint Account Link via env.appUrl
export async function POST(_request: NextRequest) {
    try {
        const user = await syncUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const stripe = await getUncachableStripeClient()
        const baseUrl = env.appUrl

        let accountId = user.stripeConnectAccountId
        if (accountId) {
            try {
                const loginLink = await stripe.accounts.createLoginLink(accountId)
                return NextResponse.json({ url: loginLink.url, type: 'login' })
            } catch {
                // Account may not be fully onboarded; fall through to onboarding link
            }
        }

        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                email: user.email,
                metadata: { userId: user.id },
            })
            accountId = account.id

            await prisma.user.update({
                where: { id: user.id },
                data: { stripeConnectAccountId: accountId },
            })
        }

        const accountLink = await stripe.accountLinks.create({
            account: accountId,
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

        if (!user.stripeConnectAccountId) {
            return NextResponse.json({ connected: false, url: null })
        }

        const stripe = await getUncachableStripeClient()
        const account = await stripe.accounts.retrieve(user.stripeConnectAccountId)

        return NextResponse.json({
            connected: true,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
        })
    } catch (error) {
        if (error instanceof StripeNotConfiguredError) {
            return paymentsNotConfigured()
        }
        console.error('Connect status error:', error)
        return NextResponse.json({ connected: false, url: null })
    }
}
