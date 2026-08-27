/**
 * Foundation module — public surface.
 *
 * Unified Contact identity, append-only ActivityTimeline, durable task/job
 * queue contract, and a read-only Notification adapter — all pure TypeScript,
 * all built as read-only projections over existing Profile/Booking/Order/
 * Conversation/Course data. See `docs/orchestration/FOUNDATION_DESIGN.md` for
 * the design write-up and the additive-only schema proposal for the later
 * schema wave.
 */

export * from "./types"
export * from "./identity"
export * from "./activity-timeline"
export * from "./task-queue"
export * from "./task-queue-memory"
export * from "./notifications-adapter"
export * from "./adapters"
