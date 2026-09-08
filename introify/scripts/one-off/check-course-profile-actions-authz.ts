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
const prefix = `course-profile-authz-${process.pid}-${Date.now()}`

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
const effects = { revalidations: 0, curriculumParses: 0 }

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

type CurriculumModule = {
    parseCurriculumOutline: (raw: string) => unknown
    [key: string]: unknown
}

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
            executeOwnedResourceWrite: foundation.executeOwnedResourceWrite,
            unwrapOwnershipResult,
        }
        if (request === "next/cache") return { revalidatePath: () => { effects.revalidations += 1 } }
        if (request === "@/lib/import-extract") {
            const actual = nativeRequire(path.resolve("src/lib/import-extract.ts")) as CurriculumModule
            return {
                ...actual,
                parseCurriculumOutline: (raw: string) => {
                    effects.curriculumParses += 1
                    return actual.parseCurriculumOutline(raw)
                },
            }
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
    check(`${test.name}: anonymous refusal has zero writes and side effects`, anonymousBefore === anonymousAfter)

    identity.current = test.ownerIdentity
    const foreignBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    const foreignError = await captureError(test.foreign)
    const foreignAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    check(`${test.name}: foreign tenant is 403 FORBIDDEN`,
        errorShape(foreignError).includes('"code":"FORBIDDEN"')
            && errorShape(foreignError).includes('"status":403'))
    check(`${test.name}: foreign refusal has zero writes and side effects`, foreignBefore === foreignAfter)

    const missingBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    const missingError = await captureError(test.missing)
    const missingAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
    check(`${test.name}: missing resource is 403 FORBIDDEN`,
        errorShape(missingError).includes('"code":"FORBIDDEN"')
            && errorShape(missingError).includes('"status":403'))
    check(`${test.name}: missing refusal has zero writes and side effects`, missingBefore === missingAfter)
    check(`${test.name}: foreign and missing refusals are indistinguishable`,
        errorShape(foreignError) === errorShape(missingError))

    const ownerError = await captureError(test.owner)
    check(`${test.name}: valid owner action does not throw`, ownerError === null)
    check(`${test.name}: valid owner succeeds`, await test.ownerSucceeded())
    coverage.push(test.name)
}

const courseData = (title: string) => ({
    title,
    description: "course authorization fixture",
    subtitle: "isolated rehearsal",
    body: "fixture body",
    outcomes: "fixture outcome",
    level: "ALL",
    price: 12,
    isActive: true,
    isPublished: false,
})

const lessonData = (title: string) => ({
    title,
    description: "lesson authorization fixture",
    contentType: "TEXT" as const,
    body: "fixture lesson body",
    durationMinutes: 12,
    isFree: false,
})

const workData = (company: string) => ({
    company,
    role: "Engineer",
    startDate: "2024-01",
    endDate: null,
    description: "work authorization fixture",
    achievements: "deterministic verification",
})

const projectData = (title: string) => ({
    title,
    description: "project authorization fixture",
    client: "Fixture client",
    year: "2026",
    imageUrl: null,
    link: "https://example.invalid/project",
})

class RollbackProof extends Error {}

async function runSuite(tx: Prisma.TransactionClient): Promise<void> {
    const db = transactionalClient(tx)
    const courses = loadActionModule("src/app/actions/courses.ts", db)
    const profiles = loadActionModule("src/app/actions/profile.ts", db)

    const ownerUserId = `${prefix}-owner-user`
    const foreignUserId = `${prefix}-foreign-user`
    const ownerProfileId = `${prefix}-owner-profile`
    const foreignProfileId = `${prefix}-foreign-profile`
    await tx.user.createMany({ data: [
        { id: ownerUserId, clerkId: `${prefix}-owner-clerk`, email: `${prefix}-owner@example.invalid` },
        { id: foreignUserId, clerkId: `${prefix}-foreign-clerk`, email: `${prefix}-foreign@example.invalid` },
    ] })
    await tx.profile.createMany({ data: [
        { id: ownerProfileId, userId: ownerUserId, slug: `${prefix}-owner`, displayName: "Course owner", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
        { id: foreignProfileId, userId: foreignUserId, slug: `${prefix}-foreign`, displayName: "Course foreign", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
    ] })
    const ownerIdentity = Object.freeze({
        id: ownerUserId,
        profiles: Object.freeze([{ id: ownerProfileId }]),
    })

    const courseIds = {
        updateOwner: `${prefix}-course-update-owner`,
        updateForeign: `${prefix}-course-update-foreign`,
        deleteOwner: `${prefix}-course-delete-owner`,
        deleteForeign: `${prefix}-course-delete-foreign`,
        publishOwner: `${prefix}-course-publish-owner`,
        publishForeign: `${prefix}-course-publish-foreign`,
        moduleCreateOwner: `${prefix}-course-module-create-owner`,
        moduleCreateForeign: `${prefix}-course-module-create-foreign`,
        moduleUpdateOwner: `${prefix}-course-module-update-owner`,
        moduleUpdateForeign: `${prefix}-course-module-update-foreign`,
        moduleDeleteOwner: `${prefix}-course-module-delete-owner`,
        moduleDeleteForeign: `${prefix}-course-module-delete-foreign`,
        moduleMoveOwner: `${prefix}-course-module-move-owner`,
        moduleMoveForeign: `${prefix}-course-module-move-foreign`,
        lessonCreateOwner: `${prefix}-course-lesson-create-owner`,
        lessonCreateForeign: `${prefix}-course-lesson-create-foreign`,
        lessonUpdateOwner: `${prefix}-course-lesson-update-owner`,
        lessonUpdateForeign: `${prefix}-course-lesson-update-foreign`,
        lessonDeleteOwner: `${prefix}-course-lesson-delete-owner`,
        lessonDeleteForeign: `${prefix}-course-lesson-delete-foreign`,
        lessonMoveOwner: `${prefix}-course-lesson-move-owner`,
        lessonMoveForeign: `${prefix}-course-lesson-move-foreign`,
        importOwner: `${prefix}-course-import-owner`,
        importForeign: `${prefix}-course-import-foreign`,
    }
    const foreignCourseIds = new Set([
        courseIds.updateForeign, courseIds.deleteForeign, courseIds.publishForeign,
        courseIds.moduleCreateForeign, courseIds.moduleUpdateForeign, courseIds.moduleDeleteForeign,
        courseIds.moduleMoveForeign, courseIds.lessonCreateForeign, courseIds.lessonUpdateForeign,
        courseIds.lessonDeleteForeign, courseIds.lessonMoveForeign, courseIds.importForeign,
    ])
    await tx.course.createMany({ data: Object.values(courseIds).map((id) => ({
        id,
        profileId: foreignCourseIds.has(id) ? foreignProfileId : ownerProfileId,
        title: id,
        priceCents: 0,
        currency: "USD",
        isActive: true,
        isPublished: false,
    })) })

    const moduleIds = {
        updateOwner: `${prefix}-module-update-owner`,
        updateForeign: `${prefix}-module-update-foreign`,
        deleteOwner: `${prefix}-module-delete-owner`,
        deleteForeign: `${prefix}-module-delete-foreign`,
        moveOwnerCurrent: `${prefix}-module-move-current-owner`,
        moveOwnerSwap: `${prefix}-module-move-swap-owner`,
        moveForeignCurrent: `${prefix}-module-move-current-foreign`,
        moveForeignSwap: `${prefix}-module-move-swap-foreign`,
        lessonCreateOwner: `${prefix}-module-lesson-create-owner`,
        lessonCreateForeign: `${prefix}-module-lesson-create-foreign`,
        lessonUpdateOwner: `${prefix}-module-lesson-update-owner`,
        lessonUpdateForeign: `${prefix}-module-lesson-update-foreign`,
        lessonDeleteOwner: `${prefix}-module-lesson-delete-owner`,
        lessonDeleteForeign: `${prefix}-module-lesson-delete-foreign`,
        lessonMoveOwner: `${prefix}-module-lesson-move-owner`,
        lessonMoveForeign: `${prefix}-module-lesson-move-foreign`,
    }
    await tx.courseModule.createMany({ data: [
        { id: moduleIds.updateOwner, courseId: courseIds.moduleUpdateOwner, title: moduleIds.updateOwner, orderIndex: 0 },
        { id: moduleIds.updateForeign, courseId: courseIds.moduleUpdateForeign, title: moduleIds.updateForeign, orderIndex: 0 },
        { id: moduleIds.deleteOwner, courseId: courseIds.moduleDeleteOwner, title: moduleIds.deleteOwner, orderIndex: 0 },
        { id: moduleIds.deleteForeign, courseId: courseIds.moduleDeleteForeign, title: moduleIds.deleteForeign, orderIndex: 0 },
        { id: moduleIds.moveOwnerSwap, courseId: courseIds.moduleMoveOwner, title: moduleIds.moveOwnerSwap, orderIndex: 0 },
        { id: moduleIds.moveOwnerCurrent, courseId: courseIds.moduleMoveOwner, title: moduleIds.moveOwnerCurrent, orderIndex: 1 },
        { id: moduleIds.moveForeignSwap, courseId: courseIds.moduleMoveForeign, title: moduleIds.moveForeignSwap, orderIndex: 0 },
        { id: moduleIds.moveForeignCurrent, courseId: courseIds.moduleMoveForeign, title: moduleIds.moveForeignCurrent, orderIndex: 1 },
        { id: moduleIds.lessonCreateOwner, courseId: courseIds.lessonCreateOwner, title: moduleIds.lessonCreateOwner, orderIndex: 0 },
        { id: moduleIds.lessonCreateForeign, courseId: courseIds.lessonCreateForeign, title: moduleIds.lessonCreateForeign, orderIndex: 0 },
        { id: moduleIds.lessonUpdateOwner, courseId: courseIds.lessonUpdateOwner, title: moduleIds.lessonUpdateOwner, orderIndex: 0 },
        { id: moduleIds.lessonUpdateForeign, courseId: courseIds.lessonUpdateForeign, title: moduleIds.lessonUpdateForeign, orderIndex: 0 },
        { id: moduleIds.lessonDeleteOwner, courseId: courseIds.lessonDeleteOwner, title: moduleIds.lessonDeleteOwner, orderIndex: 0 },
        { id: moduleIds.lessonDeleteForeign, courseId: courseIds.lessonDeleteForeign, title: moduleIds.lessonDeleteForeign, orderIndex: 0 },
        { id: moduleIds.lessonMoveOwner, courseId: courseIds.lessonMoveOwner, title: moduleIds.lessonMoveOwner, orderIndex: 0 },
        { id: moduleIds.lessonMoveForeign, courseId: courseIds.lessonMoveForeign, title: moduleIds.lessonMoveForeign, orderIndex: 0 },
    ] })

    const lessonIds = {
        updateOwner: `${prefix}-lesson-update-owner`,
        updateForeign: `${prefix}-lesson-update-foreign`,
        deleteOwner: `${prefix}-lesson-delete-owner`,
        deleteForeign: `${prefix}-lesson-delete-foreign`,
        moveOwnerCurrent: `${prefix}-lesson-move-current-owner`,
        moveOwnerSwap: `${prefix}-lesson-move-swap-owner`,
        moveForeignCurrent: `${prefix}-lesson-move-current-foreign`,
        moveForeignSwap: `${prefix}-lesson-move-swap-foreign`,
    }
    await tx.courseLesson.createMany({ data: [
        { id: lessonIds.updateOwner, moduleId: moduleIds.lessonUpdateOwner, title: lessonIds.updateOwner, contentType: "TEXT", orderIndex: 0, durationMinutes: 10, isFree: false },
        { id: lessonIds.updateForeign, moduleId: moduleIds.lessonUpdateForeign, title: lessonIds.updateForeign, contentType: "TEXT", orderIndex: 0, durationMinutes: 10, isFree: false },
        { id: lessonIds.deleteOwner, moduleId: moduleIds.lessonDeleteOwner, title: lessonIds.deleteOwner, contentType: "TEXT", orderIndex: 0, durationMinutes: 10, isFree: false },
        { id: lessonIds.deleteForeign, moduleId: moduleIds.lessonDeleteForeign, title: lessonIds.deleteForeign, contentType: "TEXT", orderIndex: 0, durationMinutes: 10, isFree: false },
        { id: lessonIds.moveOwnerSwap, moduleId: moduleIds.lessonMoveOwner, title: lessonIds.moveOwnerSwap, contentType: "TEXT", orderIndex: 0, durationMinutes: 10, isFree: false },
        { id: lessonIds.moveOwnerCurrent, moduleId: moduleIds.lessonMoveOwner, title: lessonIds.moveOwnerCurrent, contentType: "TEXT", orderIndex: 1, durationMinutes: 10, isFree: false },
        { id: lessonIds.moveForeignSwap, moduleId: moduleIds.lessonMoveForeign, title: lessonIds.moveForeignSwap, contentType: "TEXT", orderIndex: 0, durationMinutes: 10, isFree: false },
        { id: lessonIds.moveForeignCurrent, moduleId: moduleIds.lessonMoveForeign, title: lessonIds.moveForeignCurrent, contentType: "TEXT", orderIndex: 1, durationMinutes: 10, isFree: false },
    ] })

    const workIds = {
        updateOwner: `${prefix}-work-update-owner`,
        updateForeign: `${prefix}-work-update-foreign`,
        deleteOwner: `${prefix}-work-delete-owner`,
        deleteForeign: `${prefix}-work-delete-foreign`,
    }
    await tx.workExperience.createMany({ data: [
        { id: workIds.updateOwner, profileId: ownerProfileId, company: "Owner before", role: "Engineer", startDate: "2024-01" },
        { id: workIds.updateForeign, profileId: foreignProfileId, company: "Foreign before", role: "Engineer", startDate: "2024-01" },
        { id: workIds.deleteOwner, profileId: ownerProfileId, company: "Owner delete", role: "Engineer", startDate: "2024-01" },
        { id: workIds.deleteForeign, profileId: foreignProfileId, company: "Foreign delete", role: "Engineer", startDate: "2024-01" },
    ] })

    const projectIds = {
        updateOwner: `${prefix}-project-update-owner`,
        updateForeign: `${prefix}-project-update-foreign`,
        deleteOwner: `${prefix}-project-delete-owner`,
        deleteForeign: `${prefix}-project-delete-foreign`,
    }
    await tx.project.createMany({ data: [
        { id: projectIds.updateOwner, profileId: ownerProfileId, title: "Owner before" },
        { id: projectIds.updateForeign, profileId: foreignProfileId, title: "Foreign before" },
        { id: projectIds.deleteOwner, profileId: ownerProfileId, title: "Owner delete" },
        { id: projectIds.deleteForeign, profileId: foreignProfileId, title: "Foreign delete" },
    ] })

    const state = async () => ({
        profiles: await tx.profile.findMany({
            where: { id: { in: [ownerProfileId, foreignProfileId] } },
            select: { id: true, userId: true, slug: true, displayName: true, headline: true },
            orderBy: { id: "asc" },
        }),
        courses: await tx.course.findMany({
            where: { profileId: { in: [ownerProfileId, foreignProfileId] } },
            select: { id: true, profileId: true, title: true, isActive: true, isPublished: true, totalModules: true, totalLessons: true },
            orderBy: { id: "asc" },
        }),
        modules: await tx.courseModule.findMany({
            where: { course: { profileId: { in: [ownerProfileId, foreignProfileId] } } },
            select: { id: true, courseId: true, title: true, orderIndex: true },
            orderBy: { id: "asc" },
        }),
        lessons: await tx.courseLesson.findMany({
            where: { module: { course: { profileId: { in: [ownerProfileId, foreignProfileId] } } } },
            select: { id: true, moduleId: true, title: true, orderIndex: true },
            orderBy: { id: "asc" },
        }),
        work: await tx.workExperience.findMany({
            where: { profileId: { in: [ownerProfileId, foreignProfileId] } },
            select: { id: true, profileId: true, company: true, role: true },
            orderBy: { id: "asc" },
        }),
        projects: await tx.project.findMany({
            where: { profileId: { in: [ownerProfileId, foreignProfileId] } },
            select: { id: true, profileId: true, title: true },
            orderBy: { id: "asc" },
        }),
    })
    const missing = (kind: string) => `${prefix}-missing-${kind}`

    await protectedCase({
        name: "createCourse", ownerIdentity, state, central: true,
        anonymous: () => courses.createCourse(ownerProfileId, courseData("anonymous course")),
        foreign: () => courses.createCourse(foreignProfileId, courseData("foreign course")),
        missing: () => courses.createCourse(missing("profile-course"), courseData("missing course")),
        owner: () => courses.createCourse(ownerProfileId, courseData(`${prefix}-created-course`)),
        ownerSucceeded: async () => await tx.course.count({ where: { profileId: ownerProfileId, title: `${prefix}-created-course` } }) === 1,
    })
    await protectedCase({
        name: "updateCourse", ownerIdentity, state,
        anonymous: () => courses.updateCourse(courseIds.updateOwner, courseData("anonymous update")),
        foreign: () => courses.updateCourse(courseIds.updateForeign, courseData("foreign update")),
        missing: () => courses.updateCourse(missing("course-update"), courseData("missing update")),
        owner: () => courses.updateCourse(courseIds.updateOwner, courseData("owner course updated")),
        ownerSucceeded: async () => (await tx.course.findUnique({ where: { id: courseIds.updateOwner } }))?.title === "owner course updated",
    })
    await protectedCase({
        name: "deleteCourse", ownerIdentity, state,
        anonymous: () => courses.deleteCourse(courseIds.deleteOwner),
        foreign: () => courses.deleteCourse(courseIds.deleteForeign),
        missing: () => courses.deleteCourse(missing("course-delete")),
        owner: () => courses.deleteCourse(courseIds.deleteOwner),
        ownerSucceeded: async () => await tx.course.count({ where: { id: courseIds.deleteOwner } }) === 0,
    })
    await protectedCase({
        name: "setCoursePublished", ownerIdentity, state,
        anonymous: () => courses.setCoursePublished(courseIds.publishOwner, true),
        foreign: () => courses.setCoursePublished(courseIds.publishForeign, true),
        missing: () => courses.setCoursePublished(missing("course-publish"), true),
        owner: () => courses.setCoursePublished(courseIds.publishOwner, true),
        ownerSucceeded: async () => {
            const row = await tx.course.findUnique({ where: { id: courseIds.publishOwner } })
            return row?.isPublished === true && row.isActive === true
        },
    })
    await protectedCase({
        name: "createCourseModule", ownerIdentity, state,
        anonymous: () => courses.createCourseModule(courseIds.moduleCreateOwner, { title: "anonymous module" }),
        foreign: () => courses.createCourseModule(courseIds.moduleCreateForeign, { title: "foreign module" }),
        missing: () => courses.createCourseModule(missing("course-module-create"), { title: "missing module" }),
        owner: () => courses.createCourseModule(courseIds.moduleCreateOwner, { title: "owner module created" }),
        ownerSucceeded: async () => await tx.courseModule.count({ where: { courseId: courseIds.moduleCreateOwner, title: "owner module created" } }) === 1,
    })
    await protectedCase({
        name: "updateCourseModule", ownerIdentity, state,
        anonymous: () => courses.updateCourseModule(moduleIds.updateOwner, { title: "anonymous module update" }),
        foreign: () => courses.updateCourseModule(moduleIds.updateForeign, { title: "foreign module update" }),
        missing: () => courses.updateCourseModule(missing("module-update"), { title: "missing module update" }),
        owner: () => courses.updateCourseModule(moduleIds.updateOwner, { title: "owner module updated" }),
        ownerSucceeded: async () => (await tx.courseModule.findUnique({ where: { id: moduleIds.updateOwner } }))?.title === "owner module updated",
    })
    await protectedCase({
        name: "deleteCourseModule", ownerIdentity, state,
        anonymous: () => courses.deleteCourseModule(moduleIds.deleteOwner),
        foreign: () => courses.deleteCourseModule(moduleIds.deleteForeign),
        missing: () => courses.deleteCourseModule(missing("module-delete")),
        owner: () => courses.deleteCourseModule(moduleIds.deleteOwner),
        ownerSucceeded: async () => await tx.courseModule.count({ where: { id: moduleIds.deleteOwner } }) === 0,
    })
    await protectedCase({
        name: "moveCourseModule", ownerIdentity, state,
        anonymous: () => courses.moveCourseModule(moduleIds.moveOwnerCurrent, -1),
        foreign: () => courses.moveCourseModule(moduleIds.moveForeignCurrent, -1),
        missing: () => courses.moveCourseModule(missing("module-move"), -1),
        owner: () => courses.moveCourseModule(moduleIds.moveOwnerCurrent, -1),
        ownerSucceeded: async () => {
            const [current, swap] = await Promise.all([
                tx.courseModule.findUnique({ where: { id: moduleIds.moveOwnerCurrent } }),
                tx.courseModule.findUnique({ where: { id: moduleIds.moveOwnerSwap } }),
            ])
            return current?.orderIndex === 0 && swap?.orderIndex === 1
        },
    })
    await protectedCase({
        name: "createCourseLesson", ownerIdentity, state,
        anonymous: () => courses.createCourseLesson(moduleIds.lessonCreateOwner, lessonData("anonymous lesson")),
        foreign: () => courses.createCourseLesson(moduleIds.lessonCreateForeign, lessonData("foreign lesson")),
        missing: () => courses.createCourseLesson(missing("module-lesson-create"), lessonData("missing lesson")),
        owner: () => courses.createCourseLesson(moduleIds.lessonCreateOwner, lessonData("owner lesson created")),
        ownerSucceeded: async () => await tx.courseLesson.count({ where: { moduleId: moduleIds.lessonCreateOwner, title: "owner lesson created" } }) === 1,
    })
    await protectedCase({
        name: "updateCourseLesson", ownerIdentity, state,
        anonymous: () => courses.updateCourseLesson(lessonIds.updateOwner, lessonData("anonymous lesson update")),
        foreign: () => courses.updateCourseLesson(lessonIds.updateForeign, lessonData("foreign lesson update")),
        missing: () => courses.updateCourseLesson(missing("lesson-update"), lessonData("missing lesson update")),
        owner: () => courses.updateCourseLesson(lessonIds.updateOwner, lessonData("owner lesson updated")),
        ownerSucceeded: async () => (await tx.courseLesson.findUnique({ where: { id: lessonIds.updateOwner } }))?.title === "owner lesson updated",
    })
    const outline = "Module 1: Owner imported\n- Owner lesson (7 min) free"
    await protectedCase({
        name: "importModulesIntoCourse", ownerIdentity, state,
        anonymous: () => courses.importModulesIntoCourse(courseIds.importOwner, outline),
        foreign: () => courses.importModulesIntoCourse(courseIds.importForeign, outline),
        missing: () => courses.importModulesIntoCourse(missing("course-import"), outline),
        owner: () => courses.importModulesIntoCourse(courseIds.importOwner, outline),
        ownerSucceeded: async () => (
            await tx.courseModule.count({ where: { courseId: courseIds.importOwner, title: "Owner imported" } }) === 1
            && await tx.courseLesson.count({ where: { module: { courseId: courseIds.importOwner }, title: "Owner lesson" } }) === 1
        ),
    })
    await protectedCase({
        name: "moveCourseLesson", ownerIdentity, state,
        anonymous: () => courses.moveCourseLesson(lessonIds.moveOwnerCurrent, -1),
        foreign: () => courses.moveCourseLesson(lessonIds.moveForeignCurrent, -1),
        missing: () => courses.moveCourseLesson(missing("lesson-move"), -1),
        owner: () => courses.moveCourseLesson(lessonIds.moveOwnerCurrent, -1),
        ownerSucceeded: async () => {
            const [current, swap] = await Promise.all([
                tx.courseLesson.findUnique({ where: { id: lessonIds.moveOwnerCurrent } }),
                tx.courseLesson.findUnique({ where: { id: lessonIds.moveOwnerSwap } }),
            ])
            return current?.orderIndex === 0 && swap?.orderIndex === 1
        },
    })
    await protectedCase({
        name: "deleteCourseLesson", ownerIdentity, state,
        anonymous: () => courses.deleteCourseLesson(lessonIds.deleteOwner),
        foreign: () => courses.deleteCourseLesson(lessonIds.deleteForeign),
        missing: () => courses.deleteCourseLesson(missing("lesson-delete")),
        owner: () => courses.deleteCourseLesson(lessonIds.deleteOwner),
        ownerSucceeded: async () => await tx.courseLesson.count({ where: { id: lessonIds.deleteOwner } }) === 0,
    })

    await protectedCase({
        name: "updateProfile", ownerIdentity, state,
        anonymous: () => profiles.updateProfile(ownerProfileId, { displayName: "Anonymous profile" }),
        foreign: () => profiles.updateProfile(foreignProfileId, { displayName: "Foreign profile mutation" }),
        missing: () => profiles.updateProfile(missing("profile-update"), { displayName: "Missing profile" }),
        owner: () => profiles.updateProfile(ownerProfileId, { displayName: "Owner profile updated", slug: `${prefix}-owner-updated` }),
        ownerSucceeded: async () => {
            const row = await tx.profile.findUnique({ where: { id: ownerProfileId } })
            return row?.displayName === "Owner profile updated" && row.slug === `${prefix}-owner-updated`
        },
    })
    await protectedCase({
        name: "createWorkExperience", ownerIdentity, state,
        anonymous: () => profiles.createWorkExperience(ownerProfileId, workData("Anonymous company")),
        foreign: () => profiles.createWorkExperience(foreignProfileId, workData("Foreign company")),
        missing: () => profiles.createWorkExperience(missing("profile-work"), workData("Missing company")),
        owner: () => profiles.createWorkExperience(ownerProfileId, workData("Owner company created")),
        ownerSucceeded: async () => await tx.workExperience.count({ where: { profileId: ownerProfileId, company: "Owner company created" } }) === 1,
    })
    await protectedCase({
        name: "updateWorkExperience", ownerIdentity, state,
        anonymous: () => profiles.updateWorkExperience(workIds.updateOwner, workData("Anonymous work update")),
        foreign: () => profiles.updateWorkExperience(workIds.updateForeign, workData("Foreign work update")),
        missing: () => profiles.updateWorkExperience(missing("work-update"), workData("Missing work update")),
        owner: () => profiles.updateWorkExperience(workIds.updateOwner, workData("Owner work updated")),
        ownerSucceeded: async () => (await tx.workExperience.findUnique({ where: { id: workIds.updateOwner } }))?.company === "Owner work updated",
    })
    await protectedCase({
        name: "deleteWorkExperience", ownerIdentity, state,
        anonymous: () => profiles.deleteWorkExperience(workIds.deleteOwner),
        foreign: () => profiles.deleteWorkExperience(workIds.deleteForeign),
        missing: () => profiles.deleteWorkExperience(missing("work-delete")),
        owner: () => profiles.deleteWorkExperience(workIds.deleteOwner),
        ownerSucceeded: async () => await tx.workExperience.count({ where: { id: workIds.deleteOwner } }) === 0,
    })
    await protectedCase({
        name: "createProject", ownerIdentity, state,
        anonymous: () => profiles.createProject(ownerProfileId, projectData("Anonymous project")),
        foreign: () => profiles.createProject(foreignProfileId, projectData("Foreign project")),
        missing: () => profiles.createProject(missing("profile-project"), projectData("Missing project")),
        owner: () => profiles.createProject(ownerProfileId, projectData("Owner project created")),
        ownerSucceeded: async () => await tx.project.count({ where: { profileId: ownerProfileId, title: "Owner project created" } }) === 1,
    })
    await protectedCase({
        name: "updateProject", ownerIdentity, state,
        anonymous: () => profiles.updateProject(projectIds.updateOwner, projectData("Anonymous project update")),
        foreign: () => profiles.updateProject(projectIds.updateForeign, projectData("Foreign project update")),
        missing: () => profiles.updateProject(missing("project-update"), projectData("Missing project update")),
        owner: () => profiles.updateProject(projectIds.updateOwner, projectData("Owner project updated")),
        ownerSucceeded: async () => (await tx.project.findUnique({ where: { id: projectIds.updateOwner } }))?.title === "Owner project updated",
    })
    await protectedCase({
        name: "deleteProject", ownerIdentity, state,
        anonymous: () => profiles.deleteProject(projectIds.deleteOwner),
        foreign: () => profiles.deleteProject(projectIds.deleteForeign),
        missing: () => profiles.deleteProject(missing("project-delete")),
        owner: () => profiles.deleteProject(projectIds.deleteOwner),
        ownerSucceeded: async () => await tx.project.count({ where: { id: projectIds.deleteOwner } }) === 0,
    })

    const expectedCourseExports = [
        "createCourse", "updateCourse", "deleteCourse", "setCoursePublished",
        "createCourseModule", "updateCourseModule", "deleteCourseModule", "moveCourseModule",
        "createCourseLesson", "updateCourseLesson", "importModulesIntoCourse",
        "moveCourseLesson", "deleteCourseLesson",
    ].sort()
    const expectedProfileExports = [
        "updateProfile", "createWorkExperience", "updateWorkExperience", "deleteWorkExperience",
        "createProject", "updateProject", "deleteProject",
    ].sort()
    const functionExports = (actionModule: ActionModule) => Object.keys(actionModule)
        .filter((name) => typeof actionModule[name] === "function")
        .sort()
    check("every exported course mutation executed exactly once",
        JSON.stringify(functionExports(courses)) === JSON.stringify(expectedCourseExports)
            && expectedCourseExports.every((name) => coverage.includes(name)))
    check("every exported profile mutation executed exactly once",
        JSON.stringify(functionExports(profiles)) === JSON.stringify(expectedProfileExports)
            && expectedProfileExports.every((name) => coverage.includes(name)))
}

async function main(): Promise<void> {
    const target = assertDisposableTarget(process.env.DATABASE_URL)
    if (target !== EXPECTED_DATABASE) {
        throw new Error("DATABASE_URL is not the designated course/profile rehearsal database")
    }

    try {
        await prisma.$transaction(async (tx) => {
            await runSuite(tx)
            throw new RollbackProof("rollback course/profile action authorization rehearsal")
        }, { maxWait: 10_000, timeout: 300_000 })
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
        effects,
        failures,
    }, null, 2))
    if (failures.length > 0) process.exitCode = 1
}

void main().finally(async () => prisma.$disconnect())
