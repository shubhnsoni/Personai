export type PersistenceErrorCode =
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "DEPENDENCY_UNAVAILABLE"

const STATUS_BY_CODE: Readonly<Record<PersistenceErrorCode, number>> = Object.freeze({
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
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
