import { blueprintPreviewApi } from "@/lib/business-os/preview-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET only. Blueprint preview has no write path, so no other verb is exported here and a caller
 * attempting one gets Next.js's own 405 rather than reaching a handler that would have to refuse.
 *
 * This route READS the registry. It installs nothing, and there is no installation runtime for it to
 * call - see check-onboarding-blueprint-coverage.ts, which asserts that behaviourally.
 */
export async function GET(request: Request): Promise<Response> {
    return blueprintPreviewApi.list(request)
}
