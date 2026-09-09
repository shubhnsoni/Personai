"use client"

import Link from "next/link"

export default function BillingError({ reset }: { reset: () => void }) {
    return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-2xl font-semibold tracking-tight">We couldn’t load your billing account.</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Your plan and balances could not be verified. Try again, or return to your dashboard to check the selected business.</p><div className="mt-6 flex flex-wrap gap-4"><button type="button" onClick={reset} className="min-h-11 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background">Try again</button><Link href="/dashboard" className="min-h-11 rounded-lg border px-5 py-3 text-sm font-medium">Back to dashboard</Link></div></main>
}
