import Stripe from "stripe"

async function getCredentials() {
    // Standard env vars first
    if (process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        return {
            publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            secretKey: process.env.STRIPE_SECRET_KEY,
        }
    }

    // Fallback to Replit specific logic if needed (keeping it just in case)
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
        ? 'repl ' + process.env.REPL_IDENTITY
        : process.env.WEB_REPL_RENEWAL
            ? 'depl ' + process.env.WEB_REPL_RENEWAL
            : null;

    if (hostname && xReplitToken) {
        const connectorName = 'stripe';
        const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
        const targetEnvironment = isProduction ? 'production' : 'development';

        const url = new URL(`https://${hostname}/api/v2/connection`);
        url.searchParams.set('include_secrets', 'true');
        url.searchParams.set('connector_names', connectorName);
        url.searchParams.set('environment', targetEnvironment);

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'Accept': 'application/json',
                    'X_REPLIT_TOKEN': xReplitToken
                }
            });

            const data = await response.json();
            const connectionSettings = data.items?.[0];

            if (connectionSettings?.settings?.publishable && connectionSettings?.settings?.secret) {
                return {
                    publishableKey: connectionSettings.settings.publishable,
                    secretKey: connectionSettings.settings.secret,
                };
            }
        } catch (e) {
            console.warn("Failed to fetch Replit Stripe credentials", e);
        }
    }

    // Default/Error state
    console.warn("Stripe credentials not found. Please set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
    return {
        publishableKey: "",
        secretKey: "",
    };
}

export async function getUncachableStripeClient() {
    const { secretKey } = await getCredentials();

    if (!secretKey) {
        console.warn("Stripe secret key is missing. Stripe functionality will be disabled.");
        // Return a dummy object or throw? For now, let's return a dummy that might fail on calls
        return new Stripe("dummy", { apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion });
    }

    return new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
    });
}

export async function getStripePublishableKey() {
    const { publishableKey } = await getCredentials();
    return publishableKey;
}

export async function getStripeSecretKey() {
    const { secretKey } = await getCredentials();
    return secretKey;
}

let stripeSync: unknown = null;

export async function getStripeSync() {
    if (!stripeSync) {
        try {
            // Check if stripe-replit-sync is available
            const { StripeSync } = await import('stripe-replit-sync');
            const secretKey = await getStripeSecretKey();

            if (secretKey) {
                stripeSync = new StripeSync({
                    poolConfig: {
                        connectionString: process.env.DATABASE_URL!,
                        max: 2,
                    },
                    stripeSecretKey: secretKey,
                });
            }
        } catch (e) {
            console.warn("stripe-replit-sync not available or failed to initialize", e);
        }
    }
    return stripeSync;
}
