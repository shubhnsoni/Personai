import { dueWorkApi } from "@/lib/operations/due-work-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET is the only handler, and structurally so. Requesting a plan writes nothing and executes nothing, so
 * there is no state-changing verb to export - a caller attempting POST, PUT, PATCH or DELETE gets
 * Next.js's own 405 rather than reaching a handler that would have to refuse. Adding one would be the
 * first step from "preview" to "trigger", which is exactly what this surface is forbidden to become.
 *
 * THAT IS NOT THE SAME AS "THIS ROUTE ANSWERS ONLY GET", and the previous version of this comment claimed
 * it was. HEAD and OPTIONS are SAFE methods, and next@16.3.3 auto-implements both of them for a route
 * that exports GET: HEAD is served by invoking THIS GET handler with `request.method === "HEAD"`, and
 * OPTIONS is answered 204 with `Allow: GET, HEAD, OPTIONS` without reaching any handler at all. So this
 * route answers three methods, two of them without any code here. Measured from the framework's own
 * `auto-implement-methods.js` and asserted in check-due-work-preview-api.ts, which drives the real
 * service through the framework's real derivation.
 *
 * Neither is exported here on purpose. An explicit HEAD would duplicate what the framework already
 * derives correctly, and an explicit OPTIONS would REPLACE a correct auto-implementation with a
 * hand-written one that could drift from the handler set it describes.
 *
 * The service refuses state-changing verbs with its own 405 and the same `Allow` value as well, because
 * this module is not the only caller of `dueWorkApi.preview` - see the header of due-work-http.ts. The
 * two answers agree, so a caller reaching the guarantee through the framework and a caller reaching it
 * through the singleton are told the same thing. One residual difference, stated because it is real:
 * Next.js's own 405 carries NO `Allow` header, so the framework's refusal is less informative than the
 * service's. That is a framework behaviour, not a policy of this route.
 */
export async function GET(request: Request): Promise<Response> {
    return dueWorkApi.preview(request)
}
