export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.INTROIFY_WORKER_ENABLED !== "true") return
    const { startBillingWorker } = await import("@/lib/billing/worker")
    startBillingWorker()
}
