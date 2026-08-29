import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return cohortApi.listAccessLessonRules(request)
}

/**
 * PUT rather than POST: the rule is keyed by lessonId and there is at most one, so setting it
 * twice is the same operation. Passing accessLevelId null removes the rule.
 */
export function PUT(request: Request): Promise<Response> {
    return cohortApi.setAccessLessonRule(request)
}
