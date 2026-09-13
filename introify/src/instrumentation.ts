export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return
    if (process.env.INTROIFY_WORKER_ENABLED === "true") {
        const { startBillingWorker } = await import("@/lib/billing/worker")
        startBillingWorker()
    }
    const { startCodexKeepAlive } = await import("@/lib/codex-transport")
    startCodexKeepAlive()
}
