import Stripe from "stripe"
import { env } from "@/lib/env"

export class StripeNotConfiguredError extends Error {
    constructor() {
        super("payments_not_configured")
        this.name = "StripeNotConfiguredError"
    }
}

function requireStripeSecret(): string {
    if (!env.hasStripe) {
        throw new StripeNotConfiguredError()
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
        throw new StripeNotConfiguredError()
    }

    return secretKey
}

export function requireStripeWebhookSecret(): string {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        throw new StripeNotConfiguredError()
    }
    return webhookSecret
}

export async function getUncachableStripeClient() {
    const secretKey = requireStripeSecret()

    return new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
    })
}

export async function getStripePublishableKey() {
    if (!env.hasStripe) {
        throw new StripeNotConfiguredError()
    }
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
}

export async function getStripeSecretKey() {
    return requireStripeSecret()
}
