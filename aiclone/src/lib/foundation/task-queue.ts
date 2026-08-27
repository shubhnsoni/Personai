/**
 * Durable task/job contract: enqueue, lease, retry-with-backoff, dead-letter,
 * idempotency-key semantics. This file defines the contract (types + state
 * machine); `task-queue-memory.ts` is the in-memory reference implementation.
 *
 * STATE MACHINE (explicit and total — every (state, action) pair below is defined;
 * anything not listed is illegal and rejected by the reference implementation):
 *
 *   PENDING --lease--------> LEASED
 *   LEASED  --complete-----> SUCCEEDED           (terminal)
 *   LEASED  --fail (retries remain)--> PENDING   (nextAttemptAt = now + backoff(attempt))
 *   LEASED  --fail (retries exhausted)--> DEAD_LETTERED  (terminal)
 *   LEASED  --lease expires (visibility timeout)--> PENDING  (re-lease-able; NOT counted as a fail)
 *   SUCCEEDED, DEAD_LETTERED: terminal. No further transition is legal from either.
 *
 * BACKOFF: exponential with jitter-free deterministic base for testability:
 *   delay(attempt) = min(baseDelayMs * 2^(attempt-1), maxDelayMs), attempt is 1-indexed
 *   (attempt 1 failing schedules the delay for what becomes attempt 2).
 *
 * IDEMPOTENCY: `idempotencyKey` is optional per task. If a caller enqueues a task whose
 * idempotencyKey matches an existing task that is not yet SUCCEEDED/DEAD_LETTERED, the
 * enqueue is a no-op and returns the existing task's id (never creates a duplicate, never
 * mutates the existing task). If the existing task already reached a terminal state, a new
 * enqueue with the same key IS allowed (idempotency guards in-flight duplication, not
 * all-time uniqueness — a caller retrying "did my enqueue go through" must not create two
 * live jobs, but re-running a completed job on purpose must be possible).
 */

export type TaskState = "PENDING" | "LEASED" | "SUCCEEDED" | "DEAD_LETTERED"

export interface TaskRecord<TPayload = unknown> {
    id: string
    idempotencyKey: string | null
    payload: TPayload
    state: TaskState
    attempts: number
    maxAttempts: number
    nextAttemptAt: Date
    leaseExpiresAt: Date | null
    leaseToken: string | null
    lastError: string | null
    createdAt: Date
    updatedAt: Date
}

export interface EnqueueInput<TPayload = unknown> {
    payload: TPayload
    idempotencyKey?: string | null
    maxAttempts?: number
    /** Delay before the task becomes leaseable. Defaults to immediate (now). */
    delayMs?: number
}

export interface BackoffPolicy {
    baseDelayMs: number
    maxDelayMs: number
}

export const DEFAULT_BACKOFF: BackoffPolicy = { baseDelayMs: 1_000, maxDelayMs: 60_000 }
export const DEFAULT_MAX_ATTEMPTS = 5
export const DEFAULT_LEASE_MS = 30_000

export function computeBackoffMs(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF): number {
    if (attempt < 1) throw new Error("attempt must be >= 1")
    const raw = policy.baseDelayMs * 2 ** (attempt - 1)
    return Math.min(raw, policy.maxDelayMs)
}

/** Thrown by the reference implementation when a caller requests an illegal state transition. */
export class IllegalTaskTransitionError extends Error {
    constructor(public readonly taskId: string, public readonly from: TaskState, public readonly attemptedAction: string) {
        super(`Task ${taskId} cannot ${attemptedAction} from state ${from}`)
        this.name = "IllegalTaskTransitionError"
    }
}

/** Durable queue contract. Any backing store (in-memory, DB-backed) implements this shape. */
export interface TaskQueue<TPayload = unknown> {
    enqueue(input: EnqueueInput<TPayload>): TaskRecord<TPayload>
    /** Leases up to `limit` PENDING-and-due tasks, moving them to LEASED. Returns the leased records. `now` defaults to the wall clock; pass it explicitly to test scheduling deterministically. */
    lease(limit: number, leaseMs?: number, now?: Date): TaskRecord<TPayload>[]
    complete(taskId: string, leaseToken: string): TaskRecord<TPayload>
    fail(taskId: string, leaseToken: string, error: string): TaskRecord<TPayload>
    get(taskId: string): TaskRecord<TPayload> | undefined
    /** Releases any lease whose leaseExpiresAt has passed, returning it to PENDING without counting a failed attempt. */
    reapExpiredLeases(now?: Date): TaskRecord<TPayload>[]
}
