/**
 * Environment variable checks — used across the app
 * to gracefully degrade when services are unconfigured.
 */

export const env = {
  get hasDatabase() {
    return !!process.env.DATABASE_URL
  },
  get hasOpenAI() {
    return !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY)
  },
  get hasStripe() {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  },
  get hasResend() {
    return !!process.env.RESEND_API_KEY
  },
  get hasClerk() {
    return !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  },
}

/** Client-safe subset (only NEXT_PUBLIC_ vars) */
export const clientEnv = {
  get hasStripe() {
    return !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  },
}
