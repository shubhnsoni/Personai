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
const prefix = `import-library-authz-${process.pid}-${Date.now()}`

const effects = {
    parses: 0,
    modelCalls: 0,
    fetches: 0,
    fileReads: 0,
    revalidations: 0,
    nestedWrites: 0,
    memberUpserts: 0,
    links: 0,
    emails: [] as string[],
    cookieClears: 0,
    redirects: 0,
}

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
type ImportExtractModule = typeof import("../../src/lib/import-extract")

class RedirectSignal extends Error {}

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
            requireOwnedResource: foundation.requireOwnedResource,
            unwrapOwnershipResult,
        }
        if (request === "next/cache") return { revalidatePath: () => { effects.revalidations += 1 } }
        if (request === "next/headers") return {
            headers: async () => ({
                get: (name: string) => name === "host" ? "owner.example.invalid" : name === "x-forwarded-proto" ? "https" : null,
            }),
        }
        if (request === "next/navigation") return {
            redirect: (destination: string) => {
                effects.redirects += 1
                throw new RedirectSignal(destination)
            },
        }
        if (request === "@/lib/import-extract") {
            const actual = nativeRequire(path.resolve("src/lib/import-extract.ts")) as ImportExtractModule
            return {
                ...actual,
                bundleFromText: (...args: Parameters<ImportExtractModule["bundleFromText"]>) => {
                    effects.parses += 1
                    return actual.bundleFromText(...args)
                },
                bundleFromHtml: (...args: Parameters<ImportExtractModule["bundleFromHtml"]>) => {
                    effects.parses += 1
                    return actual.bundleFromHtml(...args)
                },
            }
        }
        if (request === "@/lib/import-classify") {
            return nativeRequire(path.resolve("src/lib/import-classify.ts"))
        }
        if (request === "@/lib/import-llm") return {
            extractWithModel: async () => { effects.modelCalls += 1; return [] },
        }
        if (request === "@/lib/menu-import") return {
            extractRupeeMenu: () => [],
            extractMenuFromHtml: () => [],
            isMenuHost: () => false,
            isGoogleBusinessHost: () => false,
            discoverMenuUrls: () => [],
            googleListingName: () => null,
            MENU_IMPORT_WARNING: "stubbed menu import",
        }
        if (request.startsWith("@/app/actions/")) {
            const write = async () => { effects.nestedWrites += 1; return { id: `${prefix}-nested-${effects.nestedWrites}` } }
            return {
                createCourse: write,
                createCourseLesson: write,
                createCourseModule: write,
                createProduct: write,
                createEvent: write,
                createCommunity: write,
                createLeadMagnet: write,
                addContent: write,
                addService: write,
            }
        }
        if (request === "@/lib/members") {
            const normalizeEmail = (email: string) => email.trim().toLowerCase()
            const createLibraryLink = async (memberId: string) => {
                effects.links += 1
                const token = `${prefix}-token-${effects.links}`
                await scopedPrisma.libraryLink.create({
                    data: {
                        memberId,
                        tokenHash: `${prefix}-hash-${effects.links}`,
                        expiresAt: new Date("2027-12-31T00:00:00.000Z"),
                    },
                })
                return token
            }
            return {
                normalizeEmail,
                clearMemberCookie: async () => { effects.cookieClears += 1 },
                createLibraryLink,
                issueLibraryAccess: async (memberId: string, baseUrl: string) => `${baseUrl}/library/enter?token=${await createLibraryLink(memberId)}`,
                upsertMember: async (email: string) => {
                    effects.memberUpserts += 1
                    return scopedPrisma.member.upsert({
                        where: { email: normalizeEmail(email) },
                        create: { email: normalizeEmail(email) },
                        update: { lastSeenAt: new Date("2027-01-01T00:00:00.000Z") },
                    })
                },
            }
        }
        if (request === "@/lib/email") return {
            sendEmail: async (message: { to: string }) => { effects.emails.push(message.to) },
        }
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
    ownerSucceeded: (result: unknown) => Promise<boolean>
    central?: boolean
}>

async function protectedCase(test: ProtectedCase): Promise<void> {
    identity.current = null
    const anonymousBefore = JSON.stringify({ db: await test.state(), effects })
    const anonymousError = await captureError(test.anonymous)
    const anonymousAfter = JSON.stringify({ db: await test.state(), effects })
    check(`${test.name}: anonymous is 401 UNAUTHORIZED`,
        errorShape(anonymousError).includes('"code":"UNAUTHORIZED"')
            && errorShape(anonymousError).includes('"status":401'),
        test.central)
    check(`${test.name}: anonymous refusal has zero writes, provider, parser, fetch, file, or model effects`,
        anonymousBefore === anonymousAfter)

    identity.current = test.ownerIdentity
    const foreignBefore = JSON.stringify({ db: await test.state(), effects })
    const foreignError = await captureError(test.foreign)
    const foreignAfter = JSON.stringify({ db: await test.state(), effects })
    check(`${test.name}: foreign tenant is 403 FORBIDDEN`,
        errorShape(foreignError).includes('"code":"FORBIDDEN"')
            && errorShape(foreignError).includes('"status":403'))
    check(`${test.name}: foreign refusal has zero writes, provider, parser, fetch, file, or model effects`,
        foreignBefore === foreignAfter)

    const missingBefore = JSON.stringify({ db: await test.state(), effects })
    const missingError = await captureError(test.missing)
    const missingAfter = JSON.stringify({ db: await test.state(), effects })
    check(`${test.name}: missing resource is 403 FORBIDDEN`,
        errorShape(missingError).includes('"code":"FORBIDDEN"')
            && errorShape(missingError).includes('"status":403'))
    check(`${test.name}: missing refusal has zero writes, provider, parser, fetch, file, or model effects`,
        missingBefore === missingAfter)
    check(`${test.name}: foreign and missing refusals are indistinguishable`,
        errorShape(foreignError) === errorShape(missingError))

    const ownerBefore = JSON.stringify({ db: await test.state(), effects })
    let ownerResult: unknown
    const ownerError = await captureError(async () => { ownerResult = await test.owner() })
    const ownerAfter = JSON.stringify({ db: await test.state(), effects })
    check(`${test.name}: valid owner action does not throw`, ownerError === null)
    check(`${test.name}: valid owner produces an observable result or effect`, ownerBefore !== ownerAfter)
    check(`${test.name}: valid owner succeeds`, await test.ownerSucceeded(ownerResult))
    coverage.push(test.name)
}

function importItem(title: string) {
    return [{
        id: `${prefix}-profile-item`,
        kind: "profile",
        title,
        confidence: 1,
        selected: true,
        fields: { headline: title, overwrite: true },
    }]
}

function countingFormData(): FormData {
    const form = new FormData()
    const file = new File(["Owner Name\nConsultant\nOwner import biography"], "owner.txt", { type: "text/plain" })
    const read = file.arrayBuffer.bind(file)
    Object.defineProperty(file, "arrayBuffer", {
        value: async () => { effects.fileReads += 1; return read() },
    })
    form.append("file", file)
    return form
}

class RollbackProof extends Error {}

async function runSuite(tx: Prisma.TransactionClient): Promise<void> {
    const db = transactionalClient(tx)
    const imports = loadActionModule("src/app/actions/import.ts", db)
    const library = loadActionModule("src/app/actions/library.ts", db)

    const ownerUserId = `${prefix}-owner-user`
    const foreignUserId = `${prefix}-foreign-user`
    const ownerProfileId = `${prefix}-owner-profile`
    const foreignProfileId = `${prefix}-foreign-profile`
    const ownerEmail = `${prefix}-owner@example.invalid`
    const foreignEmail = `${prefix}-foreign@example.invalid`
    const missingEmail = `${prefix}-missing@example.invalid`
    await tx.user.createMany({ data: [
        { id: ownerUserId, clerkId: `${prefix}-owner-clerk`, email: `${prefix}-user-owner@example.invalid` },
        { id: foreignUserId, clerkId: `${prefix}-foreign-clerk`, email: `${prefix}-user-foreign@example.invalid` },
    ] })
    await tx.profile.createMany({ data: [
        { id: ownerProfileId, userId: ownerUserId, slug: `${prefix}-owner`, displayName: "Import owner", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
        { id: foreignProfileId, userId: foreignUserId, slug: `${prefix}-foreign`, displayName: "Import foreign", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
    ] })
    const ownerIdentity = Object.freeze({ id: ownerUserId, profiles: Object.freeze([{ id: ownerProfileId }]) })

    await tx.member.createMany({ data: [
        { id: `${prefix}-member-owner`, email: ownerEmail },
        { id: `${prefix}-member-foreign`, email: foreignEmail },
    ] })
    await tx.digitalProduct.createMany({ data: [
        { id: `${prefix}-product-owner`, profileId: ownerProfileId, title: "Owner product", type: "OTHER", priceCents: 0, currency: "USD", isActive: true },
        { id: `${prefix}-product-foreign`, profileId: foreignProfileId, title: "Foreign product", type: "OTHER", priceCents: 0, currency: "USD", isActive: true },
    ] })
    await tx.productPurchase.createMany({ data: [
        { id: `${prefix}-purchase-owner`, productId: `${prefix}-product-owner`, memberId: `${prefix}-member-owner`, visitorEmail: ownerEmail, status: "COMPLETED" },
        { id: `${prefix}-purchase-foreign`, productId: `${prefix}-product-foreign`, memberId: `${prefix}-member-foreign`, visitorEmail: foreignEmail, status: "COMPLETED" },
    ] })

    const state = async () => ({
        profiles: await tx.profile.findMany({
            where: { id: { in: [ownerProfileId, foreignProfileId] } },
            select: { id: true, userId: true, headline: true },
            orderBy: { id: "asc" },
        }),
        members: await tx.member.findMany({
            where: { email: { startsWith: prefix } },
            select: { id: true, email: true },
            orderBy: { id: "asc" },
        }),
        links: await tx.libraryLink.findMany({
            where: { member: { email: { startsWith: prefix } } },
            select: { id: true, memberId: true, tokenHash: true },
            orderBy: { id: "asc" },
        }),
    })
    const missingProfileId = `${prefix}-missing-profile`

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        effects.fetches += 1
        return new Response(
            "<html><head><title>Owner Import Page</title><meta name=\"description\" content=\"Owner import biography\"></head><body><h1>Owner Import Page</h1></body></html>",
            { status: 200, headers: { "content-type": "text/html" } },
        )
    }) as typeof fetch

    try {
        await protectedCase({
            name: "ingestText", ownerIdentity, state, central: true,
            anonymous: () => imports.ingestText(ownerProfileId, "Anonymous import text", "cv"),
            foreign: () => imports.ingestText(foreignProfileId, "Foreign import text", "cv"),
            missing: () => imports.ingestText(missingProfileId, "Missing import text", "cv"),
            owner: () => imports.ingestText(ownerProfileId, "Owner Name\nConsultant\nOwner import biography", "cv"),
            ownerSucceeded: async (result) => Array.isArray((result as { items?: unknown[] })?.items)
                && ((result as { items: unknown[] }).items.length > 0)
                && effects.parses > 0
                && effects.modelCalls > 0,
        })
        await protectedCase({
            name: "ingestUrl", ownerIdentity, state,
            anonymous: () => imports.ingestUrl(ownerProfileId, "https://anonymous.example.invalid"),
            foreign: () => imports.ingestUrl(foreignProfileId, "https://foreign.example.invalid"),
            missing: () => imports.ingestUrl(missingProfileId, "https://missing.example.invalid"),
            owner: () => imports.ingestUrl(ownerProfileId, "https://owner.example.invalid"),
            ownerSucceeded: async (result) => Array.isArray((result as { items?: unknown[] })?.items)
                && ((result as { items: unknown[] }).items.length > 0)
                && effects.fetches === 1,
        })
        await protectedCase({
            name: "ingestFile", ownerIdentity, state,
            anonymous: () => imports.ingestFile(ownerProfileId, countingFormData(), "cv"),
            foreign: () => imports.ingestFile(foreignProfileId, countingFormData(), "cv"),
            missing: () => imports.ingestFile(missingProfileId, countingFormData(), "cv"),
            owner: () => imports.ingestFile(ownerProfileId, countingFormData(), "cv"),
            ownerSucceeded: async (result) => Array.isArray((result as { items?: unknown[] })?.items)
                && ((result as { items: unknown[] }).items.length > 0)
                && effects.fileReads === 1,
        })
        await protectedCase({
            name: "applyImportBundle", ownerIdentity, state,
            anonymous: () => imports.applyImportBundle(ownerProfileId, importItem("Anonymous headline")),
            foreign: () => imports.applyImportBundle(foreignProfileId, importItem("Foreign headline")),
            missing: () => imports.applyImportBundle(missingProfileId, importItem("Missing headline")),
            owner: () => imports.applyImportBundle(ownerProfileId, importItem("Owner imported headline")),
            ownerSucceeded: async (result) => (
                (result as { wrote?: { profile?: number } })?.wrote?.profile === 1
                && (await tx.profile.findUnique({ where: { id: ownerProfileId } }))?.headline === "Owner imported headline"
            ),
        })
    } finally {
        globalThis.fetch = originalFetch
    }

    identity.current = null
    const publicExisting = await library.requestLibraryLink(ownerEmail.toUpperCase())
    const missingBefore = JSON.stringify({ db: await state(), effects })
    const publicMissing = await library.requestLibraryLink(missingEmail)
    const missingAfter = JSON.stringify({ db: await state(), effects })
    check("requestLibraryLink remains intentionally anonymous", JSON.stringify(publicExisting) === JSON.stringify({ ok: true }))
    check("requestLibraryLink is response-identical for existing and missing members",
        JSON.stringify(publicExisting) === JSON.stringify(publicMissing))
    check("requestLibraryLink missing-member path has no write or provider effect", missingBefore === missingAfter)
    check("requestLibraryLink existing-member path sends only to that member", effects.emails.includes(ownerEmail))
    coverage.push("requestLibraryLink")

    const logoutBefore = JSON.stringify(await state())
    const logoutError = await captureError(() => library.logoutLibrary())
    const logoutAfter = JSON.stringify(await state())
    check("logoutLibrary remains an intentional public self-cookie operation", logoutError instanceof RedirectSignal)
    check("logoutLibrary clears one cookie and redirects without database writes",
        effects.cookieClears === 1 && effects.redirects === 1 && logoutBefore === logoutAfter)
    coverage.push("logoutLibrary")

    await protectedCase({
        name: "resendLibraryLink", ownerIdentity, state,
        anonymous: () => library.resendLibraryLink(ownerEmail),
        foreign: () => library.resendLibraryLink(foreignEmail),
        missing: () => library.resendLibraryLink(missingEmail),
        owner: () => library.resendLibraryLink(ownerEmail.toUpperCase()),
        ownerSucceeded: async (result) => JSON.stringify(result) === JSON.stringify({ ok: true })
            && effects.emails.filter((email) => email === ownerEmail).length === 2
            && await tx.libraryLink.count({ where: { memberId: `${prefix}-member-owner` } }) === 2,
    })

    const expectedImportExports = ["applyImportBundle", "ingestFile", "ingestText", "ingestUrl"].sort()
    const expectedLibraryExports = ["logoutLibrary", "requestLibraryLink", "resendLibraryLink"].sort()
    const functionExports = (actionModule: ActionModule) => Object.keys(actionModule)
        .filter((name) => typeof actionModule[name] === "function")
        .sort()
    check("every exported import mutation executed",
        JSON.stringify(functionExports(imports)) === JSON.stringify(expectedImportExports)
            && expectedImportExports.every((name) => coverage.includes(name)))
    check("every exported library mutation executed",
        JSON.stringify(functionExports(library)) === JSON.stringify(expectedLibraryExports)
            && expectedLibraryExports.every((name) => coverage.includes(name)))
}

async function main(): Promise<void> {
    const target = assertDisposableTarget(process.env.DATABASE_URL)
    if (target !== EXPECTED_DATABASE) {
        throw new Error("DATABASE_URL is not the designated import/library rehearsal database")
    }

    try {
        await prisma.$transaction(async (tx) => {
            await runSuite(tx)
            throw new RollbackProof("rollback import/library action authorization rehearsal")
        }, { maxWait: 10_000, timeout: 300_000 })
    } catch (error) {
        if (!(error instanceof RollbackProof)) failures.push(`unexpected suite error: ${errorShape(error)}`)
    }

    const restoredUsers = await prisma.user.count({ where: { clerkId: { startsWith: prefix } } })
    const restoredMembers = await prisma.member.count({ where: { email: { startsWith: prefix } } })
    check("transaction rollback restored zero fixture users", restoredUsers === 0)
    check("transaction rollback restored zero fixture members", restoredMembers === 0)

    console.log(JSON.stringify({
        result: failures.length === 0 ? "PASS" : "FAIL",
        inverted: invert,
        assertions: checks.length,
        actionCoverage: coverage,
        rollback: { restoredUsers, restoredMembers },
        realExternalCalls: 0,
        effects,
        failures,
    }, null, 2))
    if (failures.length > 0) process.exitCode = 1
}

void main().finally(async () => prisma.$disconnect())
