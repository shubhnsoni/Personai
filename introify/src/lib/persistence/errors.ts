/**
 * The canonical refusal vocabulary for every surface on this platform. Each member has exactly one
 * HTTP status in `STATUS_BY_CODE` below, and every envelope helper derives its status from that map
 * rather than choosing one, so two surfaces cannot answer the same refusal with different codes.
 *
 * ADDING A MEMBER IS ADDITIVE AND SAFE HERE, but only because of how the map below is typed. It is a
 * `Readonly<Record<PersistenceErrorCode, number>>`, so widening this union without adding the status
 * is a compile error rather than an `undefined` status reaching a Response at runtime. That is the
 * mechanism that makes this union safe to extend; it is not a coincidence of the current members.
 *
 * METHOD_NOT_ALLOWED was owed work. `due-work-http.ts` refused a non-GET request with 400 and carried
 * a comment saying 405 was the correct answer but unreachable, because reaching it meant either
 * widening this union from that file or hand-building a Response that bypassed the shared envelope.
 * Widening it here, from the file that owns the vocabulary, is the change that comment was asking for.
 * A surface returning 405 is responsible for its own `Allow` header - which methods a surface permits
 * is a fact about that surface, and this map cannot know it.
 */
export type PersistenceErrorCode =
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "METHOD_NOT_ALLOWED"
    | "CONFLICT"
    | "DEPENDENCY_UNAVAILABLE"

const STATUS_BY_CODE: Readonly<Record<PersistenceErrorCode, number>> = Object.freeze({
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    DEPENDENCY_UNAVAILABLE: 503,
})

export class PersistenceError extends Error {
    readonly status: number

    constructor(
        readonly code: PersistenceErrorCode,
        message: string,
        readonly details?: Readonly<Record<string, unknown>>,
    ) {
        super(message)
        this.name = "PersistenceError"
        this.status = STATUS_BY_CODE[code]
    }
}
