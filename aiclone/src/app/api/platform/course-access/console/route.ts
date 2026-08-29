import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * One read for the whole owner console for a single course: the lesson tree with each lesson's
 * current rule, and the enrolments with their current entitlement.
 *
 * This exists because /lesson-rules returns only lessons that ALREADY carry a rule, which is
 * correct for reporting and unusable for an editor — an owner could never add the first rule.
 */
export function GET(request: Request): Promise<Response> {
    return cohortApi.accessConsole(request)
}
