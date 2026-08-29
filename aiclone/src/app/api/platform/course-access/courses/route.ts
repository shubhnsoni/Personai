import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * The courses in the caller's own workspace that tiers can be configured on. Counts are read
 * from the rows rather than from Course.totalLessons, which is a denormalised column this
 * engine does not maintain.
 */
export function GET(request: Request): Promise<Response> {
    return cohortApi.listAccessCourses(request)
}
