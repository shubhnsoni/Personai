import Stripe from "stripe"

let stripeClient: Stripe | null = null

export async function getUncachableStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY

    if (!secretKey) {
        console.warn("STRIPE_SECRET_KEY is not set. Stripe functionality will be disabled.")
        return new Stripe("dummy", { apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion })
    }

    return new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
    })
}

export async function getStripePublishableKey() {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
}

export async function getStripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY || ""
}
