import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"
import { PrismaClient, type Prisma } from "@prisma/client"

import { assertDisposableTarget } from "../lib/disposable-db"
import {
    createOwnershipFoundation,
    unwrapOwnershipResult,
    type SecurityUser,
    type ServerIdentitySource,
} from "../../src/lib/security/ownership"

const EXPECTED_DATABASE = "personalink_phase0_rehearsal_20260826_210704"
const invert = process.env.INVERT_ASSERTION === "1"
const failures: string[] = []
const checks: string[] = []
const coverage: string[] = []
const prisma = new PrismaClient()
const nativeRequire = createRequire(__filename)
const prefix = `catalog-authz-${process.pid}-${Date.now()}`

function check(name: string, condition: unknown, central = false): void {
    checks.push(name)
    const passed = central && invert ? !condition : Boolean(condition)
    if (!passed) failures.push(name)
}

type TestProfile = Readonly<{ id: string }>
class MutableIdentity implements ServerIdentitySource<TestProfile> {
    current: SecurityUser<TestProfile> | null = null
    async resolve(): Promise<SecurityUser<TestProfile> | null> { return this.current }
}

const identity = new MutableIdentity()
const foundation = createOwnershipFoundation(identity)
const effects = { revalidations: 0 }

function errorShape(error: unknown): string {
    if (!(error instanceof Error)) return JSON.stringify({ name: typeof error, message: String(error) })
    const tagged = error as Error & { code?: unknown; status?: unknown }
    return JSON.stringify({ name: error.name, message: error.message, code: tagged.code, status: tagged.status })
}

async function captureError(invoke: () => Promise<unknown>): Promise<unknown | null> {
    try { await invoke(); return null } catch (error) { return error }
}

type TransactionalClient = Prisma.TransactionClient & {
    $transaction: <T>(callback: (inner: Prisma.TransactionClient) => Promise<T>) => Promise<T>
}

function transactionalClient(tx: Prisma.TransactionClient): TransactionalClient {
    const proxy = new Proxy(tx as TransactionalClient, {
        get(target, property, receiver) {
            if (property === "$transaction") {
                return async <T>(callback: (inner: Prisma.TransactionClient) => Promise<T>) => callback(proxy)
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === "function" ? value.bind(target) : value
        },
    })
    return proxy
}

type ActionModule = Record<string, (...args: unknown[]) => Promise<unknown>>

function loadActionModule(relativePath: string, scopedPrisma: TransactionalClient): ActionModule {
    const filename = path.resolve(relativePath)
    const source = fs.readFileSync(filename, "utf8")
    const output = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
        },
    }).outputText
    const loadedModule = { exports: {} as ActionModule }
    const localRequire = (request: string): unknown => {
        if (request === "@/lib/prisma") return { prisma: scopedPrisma }
        if (request === "@/lib/security") return {
            requireOwnedProfile: foundation.requireOwnedProfile,
            executeOwnedResourceWrite: foundation.executeOwnedResourceWrite,
            unwrapOwnershipResult,
        }
        if (request === "next/cache") return { revalidatePath: () => { effects.revalidations += 1 } }
        return nativeRequire(request)
    }
    const execute = new Function("exports", "require", "module", "__filename", "__dirname", output)
    execute(loadedModule.exports, localRequire, loadedModule, filename, path.dirname(filename))
    return loadedModule.exports
}

type ProtectedCase = Readonly<{
    name: string
    ownerIdentity: SecurityUser<TestProfile>
    anonymous: () => Promise<unknown>
    foreign: () => Promise<unknown>
    missing: () => Promise<unknown>
    owner: () => Promise<unknown>
    state: () => Promise<unknown>
    ownerSucceeded: () => Promise<boolean>
    central?: boolean
}>

async function protectedCase(test: ProtectedCase): Promise<void> {
    identity.current = null
    const anonymousBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    const anonymousError = await captureError(test.anonymous)
    const anonymousAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    check(`${test.name}: anonymous is 401 UNAUTHORIZED`,
        errorShape(anonymousError).includes('"code":"UNAUTHORIZED"')
            && errorShape(anonymousError).includes('"status":401'),
        test.central)
    check(`${test.name}: anonymous refusal has no side effect`, anonymousBefore === anonymousAfter)

    identity.current = test.ownerIdentity
    const foreignBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    const foreignError = await captureError(test.foreign)
    const foreignAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    check(`${test.name}: foreign tenant is 403 FORBIDDEN`,
        errorShape(foreignError).includes('"code":"FORBIDDEN"')
            && errorShape(foreignError).includes('"status":403'))
    check(`${test.name}: foreign refusal has no side effect`, foreignBefore === foreignAfter)

    const missingBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    const missingError = await captureError(test.missing)
    const missingAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    check(`${test.name}: missing resource is 403 FORBIDDEN`,
        errorShape(missingError).includes('"code":"FORBIDDEN"')
            && errorShape(missingError).includes('"status":403'))
    check(`${test.name}: missing refusal has no side effect`, missingBefore === missingAfter)
    check(`${test.name}: foreign and missing refusals are indistinguishable`,
        errorShape(foreignError) === errorShape(missingError))

    const ownerError = await captureError(test.owner)
    check(`${test.name}: valid owner action does not throw`, ownerError === null)
    check(`${test.name}: valid owner succeeds`, await test.ownerSucceeded())
    coverage.push(test.name)
}

const communityData = (name: string) => ({
    name,
    description: "catalog authorization fixture",
    platform: "DISCORD" as const,
    inviteLink: "https://example.invalid/community",
    price: 12,
    billingCycle: "MONTHLY" as const,
    isActive: true,
})

const eventData = (title: string) => ({
    title,
    description: "catalog authorization fixture",
    eventType: "WEBINAR" as const,
    startTime: "2027-01-10T10:00:00.000Z",
    endTime: "2027-01-10T11:00:00.000Z",
    timezone: "UTC",
    meetingUrl: "https://example.invalid/event",
    price: 20,
    isFree: false,
    isActive: true,
})

const leadMagnetData = (title: string) => ({
    title,
    description: "catalog authorization fixture",
    type: "DOWNLOAD" as const,
    fileUrl: "https://example.invalid/download",
    isActive: true,
})

const serviceData = (name: string) => ({
    name,
    description: "catalog authorization fixture",
    price: 30,
    duration: 45,
    kind: "SESSION" as const,
})

class RollbackProof extends Error {}

async function runSuite(tx: Prisma.TransactionClient): Promise<void> {
    const db = transactionalClient(tx)
    const communities = loadActionModule("src/app/actions/communities.ts", db)
    const events = loadActionModule("src/app/actions/events.ts", db)
    const leadMagnets = loadActionModule("src/app/actions/lead-magnets.ts", db)
    const services = loadActionModule("src/app/actions/services.ts", db)

    const ownerUserId = `${prefix}-owner-user`
    const foreignUserId = `${prefix}-foreign-user`
    const ownerProfileId = `${prefix}-owner-profile`
    const foreignProfileId = `${prefix}-foreign-profile`
    await tx.user.createMany({ data: [
        { id: ownerUserId, clerkId: `${prefix}-owner-clerk`, email: `${prefix}-owner@example.invalid` },
        { id: foreignUserId, clerkId: `${prefix}-foreign-clerk`, email: `${prefix}-foreign@example.invalid` },
    ] })
    await tx.profile.createMany({ data: [
        { id: ownerProfileId, userId: ownerUserId, slug: `${prefix}-owner`, displayName: "Catalog owner", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
        { id: foreignProfileId, userId: foreignUserId, slug: `${prefix}-foreign`, displayName: "Catalog foreign", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
    ] })
    const ownerIdentity = Object.freeze({
        id: ownerUserId,
        profiles: Object.freeze([{ id: ownerProfileId }]),
    })

    const ids = {
        communityUpdateOwner: `${prefix}-community-update-owner`,
        communityUpdateForeign: `${prefix}-community-update-foreign`,
        communityDeleteOwner: `${prefix}-community-delete-owner`,
        communityDeleteForeign: `${prefix}-community-delete-foreign`,
        eventUpdateOwner: `${prefix}-event-update-owner`,
        eventUpdateForeign: `${prefix}-event-update-foreign`,
        eventDeleteOwner: `${prefix}-event-delete-owner`,
        eventDeleteForeign: `${prefix}-event-delete-foreign`,
        eventActiveOwner: `${prefix}-event-active-owner`,
        eventActiveForeign: `${prefix}-event-active-foreign`,
        leadUpdateOwner: `${prefix}-lead-update-owner`,
        leadUpdateForeign: `${prefix}-lead-update-foreign`,
        leadDeleteOwner: `${prefix}-lead-delete-owner`,
        leadDeleteForeign: `${prefix}-lead-delete-foreign`,
        serviceUpdateOwner: `${prefix}-service-update-owner`,
        serviceUpdateForeign: `${prefix}-service-update-foreign`,
        serviceDeleteOwner: `${prefix}-service-delete-owner`,
        serviceDeleteForeign: `${prefix}-service-delete-foreign`,
        serviceActiveOwner: `${prefix}-service-active-owner`,
        serviceActiveForeign: `${prefix}-service-active-foreign`,
    }
    const ownerFor = (id: string) => id.endsWith("owner") ? ownerProfileId : foreignProfileId

    await tx.community.createMany({ data: [
        ids.communityUpdateOwner, ids.communityUpdateForeign,
        ids.communityDeleteOwner, ids.communityDeleteForeign,
    ].map((id) => ({ id, profileId: ownerFor(id), name: id, platform: "DISCORD", priceCents: 0, currency: "USD", billingCycle: "MONTHLY", isActive: true })) })
    await tx.event.createMany({ data: [
        ids.eventUpdateOwner, ids.eventUpdateForeign,
        ids.eventDeleteOwner, ids.eventDeleteForeign,
        ids.eventActiveOwner, ids.eventActiveForeign,
    ].map((id) => ({ id, profileId: ownerFor(id), title: id, eventType: "WEBINAR", startTime: new Date("2027-01-10T10:00:00.000Z"), endTime: new Date("2027-01-10T11:00:00.000Z"), timezone: "UTC", priceCents: 0, currency: "USD", isFree: true, isActive: !id.includes("active") })) })
    await tx.leadMagnet.createMany({ data: [
        ids.leadUpdateOwner, ids.leadUpdateForeign,
        ids.leadDeleteOwner, ids.leadDeleteForeign,
    ].map((id) => ({ id, profileId: ownerFor(id), title: id, type: "DOWNLOAD", isActive: true })) })
    await tx.serviceOffering.createMany({ data: [
        ids.serviceUpdateOwner, ids.serviceUpdateForeign,
        ids.serviceDeleteOwner, ids.serviceDeleteForeign,
        ids.serviceActiveOwner, ids.serviceActiveForeign,
    ].map((id) => ({ id, profileId: ownerFor(id), name: id, priceCents: 0, durationMinutes: 30, currency: "USD", isActive: !id.includes("active"), kind: "SESSION" })) })

    const state = async () => ({
        communities: await tx.community.findMany({ where: { profileId: { in: [ownerProfileId, foreignProfileId] } }, select: { id: true, profileId: true, name: true, isActive: true }, orderBy: { id: "asc" } }),
        events: await tx.event.findMany({ where: { profileId: { in: [ownerProfileId, foreignProfileId] } }, select: { id: true, profileId: true, title: true, isActive: true }, orderBy: { id: "asc" } }),
        leadMagnets: await tx.leadMagnet.findMany({ where: { profileId: { in: [ownerProfileId, foreignProfileId] } }, select: { id: true, profileId: true, title: true, isActive: true }, orderBy: { id: "asc" } }),
        services: await tx.serviceOffering.findMany({ where: { profileId: { in: [ownerProfileId, foreignProfileId] } }, select: { id: true, profileId: true, name: true, isActive: true }, orderBy: { id: "asc" } }),
    })
    const missing = (kind: string) => `${prefix}-missing-${kind}`

    await protectedCase({
        name: "createCommunity", ownerIdentity, central: true, state,
        anonymous: () => communities.createCommunity(ownerProfileId, communityData("anonymous community")),
        foreign: () => communities.createCommunity(foreignProfileId, communityData("foreign community")),
        missing: () => communities.createCommunity(missing("profile-community"), communityData("missing community")),
        owner: () => communities.createCommunity(ownerProfileId, communityData(`${prefix}-created-community`)),
        ownerSucceeded: async () => await tx.community.count({ where: { profileId: ownerProfileId, name: `${prefix}-created-community` } }) === 1,
    })
    await protectedCase({
        name: "updateCommunity", ownerIdentity, state,
        anonymous: () => communities.updateCommunity(ids.communityUpdateOwner, communityData("anonymous update")),
        foreign: () => communities.updateCommunity(ids.communityUpdateForeign, communityData("foreign update")),
        missing: () => communities.updateCommunity(missing("community-update"), communityData("missing update")),
        owner: () => communities.updateCommunity(ids.communityUpdateOwner, communityData("owner community updated")),
        ownerSucceeded: async () => (await tx.community.findUnique({ where: { id: ids.communityUpdateOwner } }))?.name === "owner community updated",
    })
    await protectedCase({
        name: "deleteCommunity", ownerIdentity, state,
        anonymous: () => communities.deleteCommunity(ids.communityDeleteOwner),
        foreign: () => communities.deleteCommunity(ids.communityDeleteForeign),
        missing: () => communities.deleteCommunity(missing("community-delete")),
        owner: () => communities.deleteCommunity(ids.communityDeleteOwner),
        ownerSucceeded: async () => await tx.community.count({ where: { id: ids.communityDeleteOwner } }) === 0,
    })

    await protectedCase({
        name: "createEvent", ownerIdentity, state,
        anonymous: () => events.createEvent(ownerProfileId, eventData("anonymous event")),
        foreign: () => events.createEvent(foreignProfileId, eventData("foreign event")),
        missing: () => events.createEvent(missing("profile-event"), eventData("missing event")),
        owner: () => events.createEvent(ownerProfileId, eventData(`${prefix}-created-event`)),
        ownerSucceeded: async () => await tx.event.count({ where: { profileId: ownerProfileId, title: `${prefix}-created-event` } }) === 1,
    })
    await protectedCase({
        name: "updateEvent", ownerIdentity, state,
        anonymous: () => events.updateEvent(ids.eventUpdateOwner, eventData("anonymous update")),
        foreign: () => events.updateEvent(ids.eventUpdateForeign, eventData("foreign update")),
        missing: () => events.updateEvent(missing("event-update"), eventData("missing update")),
        owner: () => events.updateEvent(ids.eventUpdateOwner, eventData("owner event updated")),
        ownerSucceeded: async () => (await tx.event.findUnique({ where: { id: ids.eventUpdateOwner } }))?.title === "owner event updated",
    })
    await protectedCase({
        name: "deleteEvent", ownerIdentity, state,
        anonymous: () => events.deleteEvent(ids.eventDeleteOwner),
        foreign: () => events.deleteEvent(ids.eventDeleteForeign),
        missing: () => events.deleteEvent(missing("event-delete")),
        owner: () => events.deleteEvent(ids.eventDeleteOwner),
        ownerSucceeded: async () => await tx.event.count({ where: { id: ids.eventDeleteOwner } }) === 0,
    })
    await protectedCase({
        name: "setEventActive", ownerIdentity, state,
        anonymous: () => events.setEventActive(ids.eventActiveOwner, true),
        foreign: () => events.setEventActive(ids.eventActiveForeign, true),
        missing: () => events.setEventActive(missing("event-active"), true),
        owner: () => events.setEventActive(ids.eventActiveOwner, true),
        ownerSucceeded: async () => (await tx.event.findUnique({ where: { id: ids.eventActiveOwner } }))?.isActive === true,
    })

    await protectedCase({
        name: "createLeadMagnet", ownerIdentity, state,
        anonymous: () => leadMagnets.createLeadMagnet(ownerProfileId, leadMagnetData("anonymous lead")),
        foreign: () => leadMagnets.createLeadMagnet(foreignProfileId, leadMagnetData("foreign lead")),
        missing: () => leadMagnets.createLeadMagnet(missing("profile-lead"), leadMagnetData("missing lead")),
        owner: () => leadMagnets.createLeadMagnet(ownerProfileId, leadMagnetData(`${prefix}-created-lead`)),
        ownerSucceeded: async () => await tx.leadMagnet.count({ where: { profileId: ownerProfileId, title: `${prefix}-created-lead` } }) === 1,
    })
    await protectedCase({
        name: "updateLeadMagnet", ownerIdentity, state,
        anonymous: () => leadMagnets.updateLeadMagnet(ids.leadUpdateOwner, leadMagnetData("anonymous update")),
        foreign: () => leadMagnets.updateLeadMagnet(ids.leadUpdateForeign, leadMagnetData("foreign update")),
        missing: () => leadMagnets.updateLeadMagnet(missing("lead-update"), leadMagnetData("missing update")),
        owner: () => leadMagnets.updateLeadMagnet(ids.leadUpdateOwner, leadMagnetData("owner lead updated")),
        ownerSucceeded: async () => (await tx.leadMagnet.findUnique({ where: { id: ids.leadUpdateOwner } }))?.title === "owner lead updated",
    })
    await protectedCase({
        name: "deleteLeadMagnet", ownerIdentity, state,
        anonymous: () => leadMagnets.deleteLeadMagnet(ids.leadDeleteOwner),
        foreign: () => leadMagnets.deleteLeadMagnet(ids.leadDeleteForeign),
        missing: () => leadMagnets.deleteLeadMagnet(missing("lead-delete")),
        owner: () => leadMagnets.deleteLeadMagnet(ids.leadDeleteOwner),
        ownerSucceeded: async () => await tx.leadMagnet.count({ where: { id: ids.leadDeleteOwner } }) === 0,
    })

    await protectedCase({
        name: "addService", ownerIdentity, state,
        anonymous: () => services.addService(ownerProfileId, serviceData("anonymous service")),
        foreign: () => services.addService(foreignProfileId, serviceData("foreign service")),
        missing: () => services.addService(missing("profile-service"), serviceData("missing service")),
        owner: () => services.addService(ownerProfileId, serviceData(`${prefix}-created-service`)),
        ownerSucceeded: async () => await tx.serviceOffering.count({ where: { profileId: ownerProfileId, name: `${prefix}-created-service` } }) === 1,
    })
    await protectedCase({
        name: "updateService", ownerIdentity, state,
        anonymous: () => services.updateService(ids.serviceUpdateOwner, serviceData("anonymous update")),
        foreign: () => services.updateService(ids.serviceUpdateForeign, serviceData("foreign update")),
        missing: () => services.updateService(missing("service-update"), serviceData("missing update")),
        owner: () => services.updateService(ids.serviceUpdateOwner, serviceData("owner service updated")),
        ownerSucceeded: async () => (await tx.serviceOffering.findUnique({ where: { id: ids.serviceUpdateOwner } }))?.name === "owner service updated",
    })
    await protectedCase({
        name: "deleteService", ownerIdentity, state,
        anonymous: () => services.deleteService(ids.serviceDeleteOwner),
        foreign: () => services.deleteService(ids.serviceDeleteForeign),
        missing: () => services.deleteService(missing("service-delete")),
        owner: () => services.deleteService(ids.serviceDeleteOwner),
        ownerSucceeded: async () => await tx.serviceOffering.count({ where: { id: ids.serviceDeleteOwner } }) === 0,
    })
    await protectedCase({
        name: "setServiceActive", ownerIdentity, state,
        anonymous: () => services.setServiceActive(ids.serviceActiveOwner, true),
        foreign: () => services.setServiceActive(ids.serviceActiveForeign, true),
        missing: () => services.setServiceActive(missing("service-active"), true),
        owner: () => services.setServiceActive(ids.serviceActiveOwner, true),
        ownerSucceeded: async () => (await tx.serviceOffering.findUnique({ where: { id: ids.serviceActiveOwner } }))?.isActive === true,
    })
}

async function main(): Promise<void> {
    const target = assertDisposableTarget(process.env.DATABASE_URL)
    if (target !== EXPECTED_DATABASE) throw new Error("DATABASE_URL is not the designated catalog rehearsal database")

    try {
        await prisma.$transaction(async (tx) => {
            await runSuite(tx)
            throw new RollbackProof("rollback catalog action authorization rehearsal")
        }, { maxWait: 10_000, timeout: 180_000 })
    } catch (error) {
        if (!(error instanceof RollbackProof)) failures.push(`unexpected suite error: ${errorShape(error)}`)
    }

    const restoredRows = await prisma.user.count({ where: { clerkId: { startsWith: prefix } } })
    check("transaction rollback restored zero fixture rows", restoredRows === 0)

    console.log(JSON.stringify({
        result: failures.length === 0 ? "PASS" : "FAIL",
        inverted: invert,
        assertions: checks.length,
        protectedActions: coverage,
        rollback: { restoredRows },
        externalCalls: 0,
        failures,
    }, null, 2))
    if (failures.length > 0) process.exitCode = 1
}

void main().finally(async () => prisma.$disconnect())
