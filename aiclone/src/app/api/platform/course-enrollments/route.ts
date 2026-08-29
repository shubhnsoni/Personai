import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Enrolment onto an existing Course. This writes the pre-existing CourseEnrollment
 * record, which is why it lives beside /cohorts rather than under it: an enrolment is a
 * learner's relationship to a PROGRAM, and joining a cohort is a separate step.
 */
export function POST(request: Request): Promise<Response> {
    return cohortApi.enrol(request)
}
