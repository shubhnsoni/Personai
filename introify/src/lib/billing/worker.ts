import { retryBillingEvents } from "./stripe-platform"
import { workerTick } from "@/lib/ar-builds"

const state = globalThis as unknown as { introifyBillingWorker?: ReturnType<typeof setInterval>; introifyBillingWorkerBusy?: boolean }
export async function runBillingWorkerPass() {
    if (state.introifyBillingWorkerBusy) return
    state.introifyBillingWorkerBusy = true
    try {
        // Each module uses durable database leases, including across server replicas.
        const results = await Promise.allSettled([retryBillingEvents(), workerTick()])
        if (results.some(result => result.status === "rejected")) console.error("[billing-worker] A pass failed; durable work will retry.")
    } finally { state.introifyBillingWorkerBusy = false }
}

export function startBillingWorker() {
    if (state.introifyBillingWorker || process.env.INTROIFY_WORKER_ENABLED !== "true") return
    state.introifyBillingWorker = setInterval(() => { void runBillingWorkerPass() }, 15_000)
    state.introifyBillingWorker.unref()
    void runBillingWorkerPass()
}
