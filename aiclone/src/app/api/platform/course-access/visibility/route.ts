import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * The owner's view of the same computation the learner gets. It is computed on every call and
 * never cached, because a stored entitlement snapshot would be a second source of truth about
 * what a learner paid for.
 */
export function GET(request: Request): Promise<Response> {
    return cohortApi.accessVisibility(request)
}
