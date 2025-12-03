import { NextResponse } from 'next/server'
import { runMigrations } from 'stripe-replit-sync'
import { getStripeSync } from '@/lib/stripe'

let initialized = false

export async function POST() {
    if (initialized) {
        return NextResponse.json({ message: 'Already initialized' })
    }

    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
        return NextResponse.json(
            { error: 'DATABASE_URL environment variable is required' },
            { status: 500 }
        )
    }

    try {
        console.log('Initializing Stripe schema...')
        await runMigrations({ 
            databaseUrl
        })
        console.log('Stripe schema ready')

        const stripeSync = await getStripeSync() as {
            findOrCreateManagedWebhook: (url: string, options: { enabled_events: string[]; description?: string }) => Promise<{ webhook: { url: string }; uuid: string }>;
            syncBackfill: () => Promise<void>;
        }

        console.log('Setting up managed webhook...')
        const domains = process.env.REPLIT_DOMAINS?.split(',') || []
        const webhookBaseUrl = domains[0] ? `https://${domains[0]}` : ''
        
        if (webhookBaseUrl) {
            const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
                `${webhookBaseUrl}/api/stripe/webhook`,
                {
                    enabled_events: ['*'],
                    description: 'Managed webhook for PersonaLink Stripe sync',
                }
            )
            console.log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`)
        }

        console.log('Syncing Stripe data...')
        stripeSync.syncBackfill()
            .then(() => {
                console.log('Stripe data synced')
            })
            .catch((err: Error) => {
                console.error('Error syncing Stripe data:', err)
            })

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
