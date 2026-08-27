/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client"

import { PersistedActivities } from "../../src/lib/persistence/activities"
import { PersistedContacts } from "../../src/lib/persistence/contacts"
import { PlatformService, type PlatformServiceDependencies } from "../../src/lib/persistence/service"
import { PersistedTaskQueue } from "../../src/lib/persistence/tasks"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"

const failures: string[] = []
const checks: string[] = []
const invert = process.env.INVERT_ASSERTION === "1"

function check(name: string, condition: unknown): void {
    checks.push(name)
    const passed = name === "authenticated workspace list is tenant scoped" && invert ? !condition : Boolean(condition)
    if (!passed) failures.push(name)
}

function now(): Date {
    return new Date("2026-08-28T00:00:00.000Z")
}

function createFakePrisma(): { db: PrismaClient; counts: () => Record<string, number> } {
    const workspaces = new Map<string, any>([
        ["workspace-a", { id: "workspace-a", profileId: "profile-a", name: "Alpha", slug: "alpha" }],
        ["workspace-b", { id: "workspace-b", profileId: "profile-b", name: "Beta", slug: "beta" }],
    ])
    const users = [
        { id: "user-a", clerkId: "clerk-a" },
        { id: "user-b", clerkId: "clerk-b" },
        { id: "user-view", clerkId: "clerk-view" },
        { id: "user-location", clerkId: "clerk-location" },
    ]
    const memberships = [
        { id: "membership-a", workspaceId: "workspace-a", userId: "user-a", role: "OWNER", membershipLocations: [] },
        { id: "membership-b", workspaceId: "workspace-b", userId: "user-b", role: "OWNER", membershipLocations: [] },
        { id: "membership-view", workspaceId: "workspace-a", userId: "user-view", role: "VIEWER", membershipLocations: [] },
        { id: "membership-location", workspaceId: "workspace-a", userId: "user-location", role: "MANAGER", membershipLocations: [{ locationId: "location-a" }] },
    ]
    const contacts = new Map<string, any>()
    const links = new Map<string, any>()
    const activities = new Map<string, any>()
    const tasks = new Map<string, any>()
    let contactLinkCounter = 0
    let taskCounter = 0

    const sourceKey = (sourceKind: string, sourceId: string) => `${sourceKind}\u0000${sourceId}`
    const linksFor = (contactId: string) => [...links.values()]
        .filter((link) => link.contactId === contactId)
        .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime() || a.sourceId.localeCompare(b.sourceId))
    const contactResult = (contact: any) => contact ? { ...contact, sourceLinks: linksFor(contact.id) } : null
    const taskResult = (task: any) => task ? { ...task } : null

    function matchesTaskWhere(task: any, where: any): boolean {
        if (where.id !== undefined && task.id !== where.id) return false
        if (where.state !== undefined && task.state !== where.state) return false
        if (where.idempotencyKey !== undefined && task.idempotencyKey !== where.idempotencyKey) return false
        if (where.nextAttemptAt?.lte && task.nextAttemptAt > where.nextAttemptAt.lte) return false
        if (where.leaseExpiresAt?.lte && (!task.leaseExpiresAt || task.leaseExpiresAt > where.leaseExpiresAt.lte)) return false
        return true
    }

    function applyData(row: any, data: any): any {
        for (const [key, value] of Object.entries(data)) {
            row[key] = value && typeof value === "object" && "increment" in value
                ? row[key] + (value as { increment: number }).increment
                : value
        }
        row.updatedAt = now()
        return row
    }

    const fake: any = {
        user: {
            findUnique: async ({ where }: any) => users.find((user) => user.clerkId === where.clerkId) ?? null,
        },
        workspace: {
            findUnique: async ({ where }: any) => workspaces.get(where.id) ?? null,
        },
        membership: {
            findMany: async ({ where }: any) => memberships
                .filter((membership) => membership.userId === where.userId)
                .map((membership) => ({ ...membership, workspace: workspaces.get(membership.workspaceId) })),
            findUnique: async ({ where }: any) => {
                const key = where.workspaceId_userId
                return memberships.find((membership) =>
                    membership.workspaceId === key.workspaceId && membership.userId === key.userId,
                ) ?? null
            },
        },
        contact: {
            findMany: async ({ where }: any) => [...contacts.values()]
                .filter((contact) => contact.workspaceId === where.workspaceId)
                .map(contactResult),
            findUnique: async ({ where, include }: any) => {
                const contact = contacts.get(where.id)
                if (!contact) return null
                return include?.sourceLinks ? contactResult(contact) : { ...contact }
            },
            findFirst: async ({ where }: any) => {
                const contact = contacts.get(where.id)
                return contact?.workspaceId === where.workspaceId ? { ...contact } : null
            },
            upsert: async ({ where, create, update }: any) => {
                const existing = contacts.get(where.id)
                const timestamp = now()
                const value = existing
                    ? { ...existing, ...update, updatedAt: timestamp }
                    : { ...create, createdAt: timestamp, updatedAt: timestamp }
                contacts.set(where.id, value)
                return { ...value }
            },
        },
        contactSourceLink: {
            findUnique: async ({ where, include }: any) => {
                const key = where.sourceKind_sourceId
                const link = links.get(sourceKey(key.sourceKind, key.sourceId))
                if (!link) return null
                return include?.contact
                    ? { ...link, contact: { workspaceId: contacts.get(link.contactId)?.workspaceId ?? null } }
                    : { ...link }
            },
            upsert: async ({ where, create, update }: any) => {
                const key = where.sourceKind_sourceId
                const mapKey = sourceKey(key.sourceKind, key.sourceId)
                const existing = links.get(mapKey)
                const value = existing
                    ? { ...existing, ...update }
                    : { id: `link-${++contactLinkCounter}`, ...create }
                links.set(mapKey, value)
                return { ...value }
            },
        },
        activityEvent: {
            findMany: async ({ where }: any) => [...activities.values()]
                .filter((event) => {
                    const contact = contacts.get(event.contactId)
                    return contact?.workspaceId === where.contact.workspaceId
                        && (!where.contactId || event.contactId === where.contactId)
                })
                .map((event) => ({ ...event })),
            findUnique: async ({ where, include }: any) => {
                const event = activities.get(where.id)
                if (!event) return null
                return include?.contact
                    ? { ...event, contact: { workspaceId: contacts.get(event.contactId)?.workspaceId ?? null } }
                    : { ...event }
            },
            create: async ({ data }: any) => {
                if (activities.has(data.id)) throw new Error("duplicate activity")
                const value = { ...data, createdAt: now() }
                activities.set(data.id, value)
                return { ...value }
            },
        },
        taskJob: {
            findUnique: async ({ where }: any) => {
                if (where.id) return taskResult(tasks.get(where.id))
                return taskResult([...tasks.values()].find((task) => task.idempotencyKey === where.idempotencyKey))
            },
            findMany: async ({ where, take }: any) => [...tasks.values()]
                .filter((task) => matchesTaskWhere(task, where))
                .sort((a, b) => {
                    const aTime = (a.nextAttemptAt ?? a.leaseExpiresAt).getTime()
                    const bTime = (b.nextAttemptAt ?? b.leaseExpiresAt).getTime()
                    return aTime - bTime || a.id.localeCompare(b.id)
                })
                .slice(0, take)
                .map((task) => ({ ...task })),
            create: async ({ data }: any) => {
                if (data.idempotencyKey && [...tasks.values()].some((task) => task.idempotencyKey === data.idempotencyKey)) {
                    throw new Error("duplicate idempotency key")
                }
                const timestamp = now()
                const value = {
                    id: `task-${++taskCounter}`,
                    leaseExpiresAt: null,
                    leaseToken: null,
                    lastError: null,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    ...data,
                }
                tasks.set(value.id, value)
                return { ...value }
            },
            update: async ({ where, data }: any) => {
                const task = tasks.get(where.id)
                if (!task) throw new Error("missing task")
                applyData(task, data)
                return { ...task }
            },
            updateMany: async ({ where, data }: any) => {
                const matching = [...tasks.values()].filter((task) => matchesTaskWhere(task, where))
                matching.forEach((task) => applyData(task, data))
                return { count: matching.length }
            },
        },
    }
    fake.$transaction = async (operation: (transaction: any) => Promise<unknown>) => operation(fake)

    return {
        db: fake as PrismaClient,
        counts: () => ({ contacts: contacts.size, links: links.size, activities: activities.size, tasks: tasks.size }),
    }
}

class MutableIdentity implements PlatformIdentity {
    value: string | null = null
    async userId(): Promise<string | null> { return this.value }
}

function request(path: string, method = "GET", input?: unknown): Request {
    const base = `http:${String.fromCharCode(47, 47)}platform.invalid`
    return new Request(`${base}${path}`, {
        method,
        headers: input === undefined ? undefined : { "content-type": "application/json" },
        body: input === undefined ? undefined : JSON.stringify(input),
    })
}

async function responseBody(response: Response): Promise<any> {
    return response.json()
}

async function main(): Promise<void> {
    const fake = createFakePrisma()
    const identity = new MutableIdentity()
    const tenancy = new PersistedTenancy(fake.db, identity)
    const contacts = new PersistedContacts(fake.db)
    const activities = new PersistedActivities(fake.db)
    const tasks = new PersistedTaskQueue(fake.db, { baseDelayMs: 10, maxDelayMs: 100 })
    const service = new PlatformService({ tenancy, contacts, activities, tasks })

    let response = await service.workspaces()
    check("unauthenticated API is 401", response.status === 401)

    identity.value = "clerk-a"
    response = await service.workspaces()
    const workspaceBody = await responseBody(response)
    check("authenticated workspace list is tenant scoped", response.status === 200
        && workspaceBody.data.workspaces.length === 1
        && workspaceBody.data.workspaces[0].id === "workspace-a")

    response = await service.contacts(request("/contacts?workspaceId=workspace-b"))
    check("cross-tenant contact list is forbidden", response.status === 403)
    check("forbidden response has no data envelope", (await responseBody(response)).data === undefined)

    response = await service.contacts(request("/contacts?workspaceId=workspace-a"))
    check("empty tenant collection is a successful loaded state", response.status === 200
        && (await responseBody(response)).data.contacts.length === 0)

    const sourceA = {
        sourceId: "booking-a",
        sourceKind: "BOOKING_GUEST",
        profileId: "profile-a",
        name: "A Person",
        email: "same@example.test",
        phone: null,
        observedAt: "2026-08-28T00:00:00.000Z",
    }
    const contactRequest = { workspaceId: "workspace-a", source: sourceA }
    const firstContactResponse = await service.persistContact(request("/contacts", "POST", contactRequest))
    const firstContact = (await responseBody(firstContactResponse)).data.contact
    const secondContactResponse = await service.persistContact(request("/contacts", "POST", contactRequest))
    const secondContact = (await responseBody(secondContactResponse)).data.contact
    check("contact ingestion returns 201", firstContactResponse.status === 201)
    check("contact source ingestion is idempotent", firstContact.id === secondContact.id
        && fake.counts().contacts === 1 && fake.counts().links === 1)
    check("contact adapter normalizes email", firstContact.email === "same@example.test")

    identity.value = "clerk-b"
    const sourceB = { ...sourceA, sourceId: "booking-b", profileId: "profile-b" }
    const tenantBContactResponse = await service.persistContact(request("/contacts", "POST", {
        workspaceId: "workspace-b",
        source: sourceB,
    }))
    const tenantBContact = (await responseBody(tenantBContactResponse)).data.contact
    check("same identity is namespaced per tenant", tenantBContact.id !== firstContact.id)

    response = await service.persistContact(request("/contacts", "POST", {
        workspaceId: "workspace-b",
        source: { ...sourceB, sourceId: "booking-a" },
    }))
    check("source link cannot be stolen across tenants", response.status === 403)

    identity.value = "clerk-a"
    const event = {
        id: "BOOKING_GUEST:booking-a:created",
        contactId: firstContact.id,
        profileId: "profile-a",
        type: "BOOKING_CREATED",
        sourceKind: "BOOKING_GUEST",
        sourceId: "booking-a",
        occurredAt: "2026-08-28T00:00:00.000Z",
        summary: "Booking created",
        metadata: { status: "PENDING" },
    }
    await service.appendActivities(request("/activities", "POST", { workspaceId: "workspace-a", events: [event] }))
    await service.appendActivities(request("/activities", "POST", { workspaceId: "workspace-a", events: [event] }))
    check("activity append is idempotent", fake.counts().activities === 1)
    response = await service.activities(request("/activities?workspaceId=workspace-a"))
    const activityBody = await responseBody(response)
    check("activity metadata round-trips", activityBody.data.events[0].metadata.status === "PENDING")

    identity.value = "clerk-b"
    response = await service.appendActivities(request("/activities", "POST", {
        workspaceId: "workspace-b",
        events: [{ ...event, profileId: "profile-b" }],
    }))
    check("cross-tenant contact activity append is hidden as not found", response.status === 404)

    identity.value = "clerk-a"
    const enqueueInput = { workspaceId: "workspace-a", payload: { kind: "SYNC" }, idempotencyKey: "sync-1" }
    const taskOne = (await responseBody(await service.enqueueTask(request("/tasks", "POST", enqueueInput)))).data.task
    const taskReplay = (await responseBody(await service.enqueueTask(request("/tasks", "POST", enqueueInput)))).data.task
    check("live task enqueue is idempotent", taskOne.id === taskReplay.id && fake.counts().tasks === 1)

    identity.value = "clerk-b"
    const taskB = (await responseBody(await service.enqueueTask(request("/tasks", "POST", {
        ...enqueueInput,
        workspaceId: "workspace-b",
    })))).data.task
    check("task idempotency keys are tenant namespaced", taskB.id !== taskOne.id)

    identity.value = "clerk-a"
    const leasedA = (await responseBody(await service.leaseTasks(request("/tasks/lease", "POST", {
        workspaceId: "workspace-a", limit: 5,
    })))).data.tasks
    check("task leasing returns only own tenant", leasedA.length === 1 && leasedA[0].id === taskOne.id)

    identity.value = "clerk-b"
    response = await service.completeTask(taskOne.id, request("/complete", "POST", {
        workspaceId: "workspace-b", leaseToken: leasedA[0].leaseToken,
    }))
    check("cross-tenant task completion does not reveal task", response.status === 404)

    identity.value = "clerk-a"
    response = await service.completeTask(taskOne.id, request("/complete", "POST", {
        workspaceId: "workspace-a", leaseToken: "stale-token",
    }))
    check("stale task lease token is rejected", response.status === 409)
    response = await service.completeTask(taskOne.id, request("/complete", "POST", {
        workspaceId: "workspace-a", leaseToken: leasedA[0].leaseToken,
    }))
    check("valid task lease completes", response.status === 200)
    const rerun = (await responseBody(await service.enqueueTask(request("/tasks", "POST", enqueueInput)))).data.task
    check("terminal task releases idempotency key for deliberate rerun", rerun.id !== taskOne.id)

    const dead = (await responseBody(await service.enqueueTask(request("/tasks", "POST", {
        workspaceId: "workspace-a", payload: { kind: "FAIL" }, maxAttempts: 1,
    })))).data.task
    const leasedForFailure = (await responseBody(await service.leaseTasks(request("/tasks/lease", "POST", {
        workspaceId: "workspace-a", limit: 10,
    })))).data.tasks.find((task: any) => task.id === dead.id)
    const deadResponse = await service.failTask(dead.id, request("/fail", "POST", {
        workspaceId: "workspace-a", leaseToken: leasedForFailure.leaseToken, error: "deterministic failure",
    }))
    check("max-attempt failure dead-letters task", (await responseBody(deadResponse)).data.task.state === "DEAD_LETTERED")

    identity.value = "clerk-location"
    response = await service.contacts(request("/contacts?workspaceId=workspace-a"))
    check("location-restricted membership cannot widen to workspace scope", response.status === 403)

    identity.value = "clerk-view"
    response = await service.enqueueTask(request("/tasks", "POST", enqueueInput))
    check("viewer cannot write tasks", response.status === 403)

    identity.value = "clerk-a"
    response = await service.persistContact(request("/contacts", "POST", { workspaceId: "workspace-a" }))
    check("bad API input returns stable 400", response.status === 400
        && (await responseBody(response)).error.code === "BAD_REQUEST")

    const unavailable = new PlatformService({
        tenancy,
        contacts: { list: async () => { throw new Error("database detail must not escape") } },
        activities,
        tasks,
    } as unknown as PlatformServiceDependencies)
    response = await unavailable.contacts(request("/contacts?workspaceId=workspace-a"))
    const unavailableBody = await responseBody(response)
    check("dependency failure returns stable 503", response.status === 503
        && unavailableBody.error.code === "DEPENDENCY_UNAVAILABLE")
    check("dependency failure does not leak internal error", !JSON.stringify(unavailableBody).includes("database detail"))

    const report = {
        result: failures.length === 0 ? "PASS" : "FAIL",
        assertions: checks.length,
        coverage: [
            "tenant scoping and authorization",
            "contact/source adapter idempotency",
            "activity append idempotency and metadata",
            "task tenancy, leasing, completion, retry/dead-letter, and idempotency",
            "API empty/loading-equivalent, validation, conflict, and dependency-error envelopes",
            "cross-tenant non-disclosure",
        ],
        failures,
    }
    console.log(JSON.stringify(report, null, 2))
    if (failures.length > 0) process.exitCode = 1
}

void main()
