import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ levelId: string }> }

/**
 * Retiring a tier is a DELETE because it is the removal of an offer, but it is a soft retire:
 * the row stays so existing entitlements keep resolving. The engine refuses while any learner
 * still holds the tier.
 */
export async function DELETE(request: Request, { params }: Params): Promise<Response> {
    const { levelId } = await params
    return cohortApi.retireAccessLevel(levelId, request)
}
