import {
    type ActivityEvent,
    type ActivityEventType,
    type ContactSourceKind,
    type ContactSourceRecord,
} from "@/lib/foundation"

import { PersistedActivities } from "./activities"
import { PersistedContacts } from "./contacts"
import { PersistenceError } from "./errors"
import { PersistedTaskQueue } from "./tasks"
import { PersistedTenancy } from "./tenancy"

const CONTACT_SOURCE_KINDS = new Set<ContactSourceKind>([
    "PROFILE_USER",
    "BOOKING_GUEST",
    "ORDER_GUEST",
    "CONVERSATION_VISITOR",
    "COURSE_ENROLLMENT",
    "MEMBER",
])
const ACTIVITY_TYPES = new Set<ActivityEventType>([
    "BOOKING_CREATED",
    "BOOKING_STATUS_CHANGED",
    "ORDER_PLACED",
    "ORDER_STATUS_CHANGED",
    "CONVERSATION_MESSAGE",
    "COURSE_ENROLLED",
    "COURSE_COMPLETED",
])

export type PlatformServiceDependencies = Readonly<{
    tenancy: PersistedTenancy
    contacts: PersistedContacts
    activities: PersistedActivities
    tasks: PersistedTaskQueue<unknown>
}>

type JsonObject = Record<string, unknown>

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status })
}

function success(data: unknown, status = 200): Response {
    return json({ ok: true, data }, status)
}

function failure(error: unknown): Response {
    if (error instanceof PersistenceError) {
        return json({
            ok: false,
            error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
        }, error.status)
    }
    if (error instanceof Error && error.name === "IllegalTaskTransitionError") {
        return json({ ok: false, error: { code: "CONFLICT", message: error.message } }, 409)
    }
    return json({
        ok: false,
        error: { code: "DEPENDENCY_UNAVAILABLE", message: "Platform persistence is temporarily unavailable" },
    }, 503)
}

async function body(request: Request): Promise<JsonObject> {
    let value: unknown
    try {
        value = await request.json()
    } catch {
        throw new PersistenceError("BAD_REQUEST", "Request body must contain valid JSON")
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PersistenceError("BAD_REQUEST", "A JSON object body is required")
    }
    return value as JsonObject
}

function requiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
    }
    return value.trim()
}

function nullableString(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string") throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    return value.trim() || null
}

function dateValue(value: unknown, field: string, nullable = false): Date | null {
    if (nullable && (value === null || value === undefined)) return null
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an ISO-compatible timestamp`, { field })
    }
    return new Date(value)
}

function optionalInteger(value: unknown, field: string): number | undefined {
    if (value === undefined) return undefined
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}

function contactSource(value: unknown): ContactSourceRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PersistenceError("BAD_REQUEST", "source must be an object", { field: "source" })
    }
    const source = value as JsonObject
    const sourceKind = requiredString(source.sourceKind, "source.sourceKind") as ContactSourceKind
    if (!CONTACT_SOURCE_KINDS.has(sourceKind)) {
        throw new PersistenceError("BAD_REQUEST", "source.sourceKind is unsupported", { field: "source.sourceKind" })
    }
    return {
        sourceId: requiredString(source.sourceId, "source.sourceId"),
        sourceKind,
        profileId: nullableString(source.profileId, "source.profileId"),
        name: nullableString(source.name, "source.name"),
        email: nullableString(source.email, "source.email"),
        phone: nullableString(source.phone, "source.phone"),
        observedAt: dateValue(source.observedAt, "source.observedAt") as Date,
    }
}

function activityEvent(value: unknown): ActivityEvent {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PersistenceError("BAD_REQUEST", "Each activity must be an object")
    }
    const event = value as JsonObject
    const type = requiredString(event.type, "event.type") as ActivityEventType
    const sourceKind = requiredString(event.sourceKind, "event.sourceKind") as ContactSourceKind
    if (!ACTIVITY_TYPES.has(type) || !CONTACT_SOURCE_KINDS.has(sourceKind)) {
        throw new PersistenceError("BAD_REQUEST", "Activity type or source kind is unsupported")
    }
    const metadata = event.metadata
    if (metadata !== undefined && (!metadata || typeof metadata !== "object" || Array.isArray(metadata))) {
        throw new PersistenceError("BAD_REQUEST", "event.metadata must be an object")
    }
    return {
        id: requiredString(event.id, "event.id"),
        contactId: requiredString(event.contactId, "event.contactId"),
        profileId: nullableString(event.profileId, "event.profileId"),
        type,
        sourceKind,
        sourceId: requiredString(event.sourceId, "event.sourceId"),
        occurredAt: dateValue(event.occurredAt, "event.occurredAt", true),
        summary: requiredString(event.summary, "event.summary"),
        metadata: (metadata ?? {}) as Record<string, unknown>,
    }
}

export class PlatformService {
    constructor(private readonly dependencies: PlatformServiceDependencies) {}

    private run(operation: () => Promise<Response>): Promise<Response> {
        return operation().catch(failure)
    }

    workspaces(): Promise<Response> {
        return this.run(async () => success({ workspaces: await this.dependencies.tenancy.listWorkspaces() }))
    }

    contacts(request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = requiredString(new URL(request.url).searchParams.get("workspaceId"), "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.read")
            return success({ contacts: await this.dependencies.contacts.list(workspaceId) })
        })
    }

    persistContact(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.update")
            const contact = await this.dependencies.contacts.ingest(workspaceId, contactSource(input.source))
            return success({ contact }, 201)
        })
    }

    activities(request: Request): Promise<Response> {
        return this.run(async () => {
            const url = new URL(request.url)
            const workspaceId = requiredString(url.searchParams.get("workspaceId"), "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.read")
            const events = await this.dependencies.activities.list(workspaceId, url.searchParams.get("contactId"))
            return success({ events })
        })
    }

    appendActivities(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            if (!Array.isArray(input.events)) throw new PersistenceError("BAD_REQUEST", "events must be an array")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.update")
            const events = await this.dependencies.activities.append(workspaceId, input.events.map(activityEvent))
            return success({ events }, 201)
        })
    }

    enqueueTask(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.update")
            const task = await this.dependencies.tasks.enqueue(workspaceId, {
                payload: input.payload,
                idempotencyKey: nullableString(input.idempotencyKey, "idempotencyKey"),
                maxAttempts: optionalInteger(input.maxAttempts, "maxAttempts"),
                delayMs: optionalInteger(input.delayMs, "delayMs"),
            })
            return success({ task }, 202)
        })
    }

    leaseTasks(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.update")
            const tasks = await this.dependencies.tasks.lease(
                workspaceId,
                optionalInteger(input.limit, "limit") ?? 1,
                optionalInteger(input.leaseMs, "leaseMs"),
            )
            return success({ tasks })
        })
    }

    completeTask(taskId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.update")
            const task = await this.dependencies.tasks.complete(
                workspaceId,
                requiredString(taskId, "taskId"),
                requiredString(input.leaseToken, "leaseToken"),
            )
            return success({ task })
        })
    }

    failTask(taskId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            await this.dependencies.tenancy.requireAccess(workspaceId, "profile.update")
            const task = await this.dependencies.tasks.fail(
                workspaceId,
                requiredString(taskId, "taskId"),
                requiredString(input.leaseToken, "leaseToken"),
                requiredString(input.error, "error"),
            )
            return success({ task })
        })
    }
}
