/**
 * Request parameter parsing for the Business OS API.
 *
 * Extracted from the route handlers so the reject/accept behaviour can be asserted
 * without a session: the routes authenticate before parsing, so these branches are
 * otherwise unreachable in a test that has no Clerk keys.
 */

export const MAX_BLUEPRINT_LIMIT = 50

/** Returns the limit, or null when the caller supplied something invalid. */
export function parseLimit(value: string | null): number | null {
    if (value === null || value === "") return MAX_BLUEPRINT_LIMIT

    // Reject before Number() so "1e1", " 3 " and "0x2" cannot slip through coercion.
    if (!/^\d{1,3}$/u.test(value)) return null

    const limit = Number(value)
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BLUEPRINT_LIMIT) return null

    return limit
}

/** Returns a normalized blueprint id, or null when it is not a safe identifier. */
export function parseBlueprintId(value: string): string | null {
    let decoded: string
    try {
        decoded = decodeURIComponent(value)
    } catch {
        // Guards the decode step for values that actually reach this function, for example
        // an encoded percent such as `%25E0%25A4%25A`, which Next hands over as the literal
        // string `%E0%A4%A` and which would otherwise throw URIError past the envelope.
        //
        // Note what this does NOT cover: a literally malformed sequence in the request URL
        // (`/blueprints/%E0%A4%A`) is rejected by Next at the framework level with a
        // 400 text/html response before this handler runs, so it never produces the
        // Business OS JSON envelope. Measured, not assumed.
        return null
    }

    const id = decoded.trim()
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/u.test(id)) return null

    return id
}
