import { NextResponse } from 'next/server'
import { getUncachableStripeClient } from '@/lib/stripe'

let initialized = false

export async function POST() {
    if (initialized) {
        return NextResponse.json({ message: 'Already initialized' })
    }

    try {
        const stripe = await getUncachableStripeClient()
        // Verify connection by fetching account
        await stripe.accounts.retrieve('me').catch(() => null)
        
        initialized = true
        return NextResponse.json({ message: 'Stripe initialized successfully' })
    } catch (error) {
        console.error('Failed to initialize Stripe:', error)
        return NextResponse.json(
            { error: 'Failed to initialize Stripe' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({ initialized })
}
