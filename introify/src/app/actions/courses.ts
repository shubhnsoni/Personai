"use server"

import { prisma } from "@/lib/prisma"
import {
    executeOwnedResourceWrite,
    requireOwnedProfile,
    requireOwnedResource,
    unwrapOwnershipResult,
} from "@/lib/security"
import { revalidatePath } from "next/cache"

export interface CourseData {
    title: string
    description?: string
    subtitle?: string
    body?: string
    outcomes?: string
    level?: string
    compareAtCents?: number
    price: number
    thumbnailUrl?: string
    isActive: boolean
    isPublished: boolean
}

function courseWrite(data: CourseData) {
    return {
        title: data.title,
        description: data.description || null,
        subtitle: data.subtitle || null,
        body: data.body || null,
        outcomes: data.outcomes || null,
        level: data.level || "ALL",
        compareAtCents: data.compareAtCents ?? null,
        priceCents: Math.round(data.price * 100),
        thumbnailUrl: data.thumbnailUrl || null,
        isActive: data.isActive,
        isPublished: data.isPublished,
    }
}

async function ownedCourse(courseId: string) {
    const owned = unwrapOwnershipResult(await requireOwnedResource({
        resourceId: courseId,
        findOwned: ({ resourceId, profile }) => prisma.course.findFirst({
            where: { id: resourceId, profileId: profile.id },
        }),
    }))
    return {
        course: owned.resource,
        profileId: owned.ownership.profile.id,
    }
}

async function ownedModule(moduleId: string) {
    const owned = unwrapOwnershipResult(await requireOwnedResource({
        resourceId: moduleId,
        findOwned: ({ resourceId, profile }) => prisma.courseModule.findFirst({
            where: { id: resourceId, course: { profileId: profile.id } },
            include: { course: { select: { id: true, profileId: true } } },
        }),
    }))
    return {
        module: owned.resource,
        profileId: owned.ownership.profile.id,
    }
}

async function recountCourse(courseId: string, profileId: string) {
    const course = await prisma.course.findFirst({
        where: { id: courseId, profileId },
        include: { modules: { include: { _count: { select: { lessons: true } } } } },
    })
    if (!course) return
    await prisma.course.updateMany({
        where: { id: courseId, profileId },
        data: {
            totalModules: course.modules.length,
            totalLessons: course.modules.reduce((count, module) => count + module._count.lessons, 0),
        },
    })
}

export async function createCourse(profileId: string, data: CourseData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    const course = await prisma.course.create({
        data: {
            profileId: profile.id,
            ...courseWrite(data),
            currency: "USD",
        },
    })
    revalidatePath("/dashboard/courses")
    return course
}

export async function updateCourse(courseId: string, data: CourseData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: courseId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.course.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: courseWrite(data),
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/courses")
}

export async function deleteCourse(courseId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: courseId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.course.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/courses")
}

export async function setCoursePublished(courseId: string, published: boolean) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: courseId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.course.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: { isPublished: published, isActive: published },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/courses")
}

export async function createCourseModule(courseId: string, data: { title: string; description?: string }) {
    const { course, profileId } = await ownedCourse(courseId)
    const last = await prisma.courseModule.findFirst({
        where: { courseId: course.id },
        orderBy: { orderIndex: "desc" },
    })
    const courseModule = await prisma.courseModule.create({
        data: {
            courseId: course.id,
            title: data.title,
            description: data.description || null,
            orderIndex: (last?.orderIndex ?? -1) + 1,
        },
    })
    await recountCourse(course.id, profileId)
    revalidatePath("/dashboard/courses")
    revalidatePath(`/dashboard/courses/${course.id}/edit`)
    return courseModule
}

export async function updateCourseModule(moduleId: string, data: { title: string; description?: string }) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: moduleId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const updated = await tx.courseModule.updateMany({
                where: { id: resourceId, course: { profileId: profile.id } },
                data: { title: data.title, description: data.description || null },
            })
            if (updated.count !== 1) return null
            return tx.courseModule.findFirst({
                where: { id: resourceId, course: { profileId: profile.id } },
            })
        }),
    }))
    const courseModule = result.result
    revalidatePath(`/dashboard/courses/${courseModule.courseId}/edit`)
    return courseModule
}

export async function deleteCourseModule(moduleId: string) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: moduleId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const courseModule = await tx.courseModule.findFirst({
                where: { id: resourceId, course: { profileId: profile.id } },
                select: { courseId: true },
            })
            if (!courseModule) return null
            const deleted = await tx.courseModule.deleteMany({
                where: { id: resourceId, course: { profileId: profile.id } },
            })
            return deleted.count === 1 ? courseModule : null
        }),
    }))
    await recountCourse(result.result.courseId, result.ownership.profile.id)
    revalidatePath("/dashboard/courses")
    revalidatePath(`/dashboard/courses/${result.result.courseId}/edit`)
}

export async function moveCourseModule(moduleId: string, direction: -1 | 1) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: moduleId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const current = await tx.courseModule.findFirst({
                where: { id: resourceId, course: { profileId: profile.id } },
            })
            if (!current) return null
            const swap = await tx.courseModule.findFirst({
                where: {
                    courseId: current.courseId,
                    course: { profileId: profile.id },
                    orderIndex: direction < 0 ? { lt: current.orderIndex } : { gt: current.orderIndex },
                },
                orderBy: { orderIndex: direction < 0 ? "desc" : "asc" },
            })
            if (!swap) return { courseId: current.courseId, moved: false }
            const first = await tx.courseModule.updateMany({
                where: { id: current.id, courseId: current.courseId, course: { profileId: profile.id } },
                data: { orderIndex: swap.orderIndex },
            })
            const second = await tx.courseModule.updateMany({
                where: { id: swap.id, courseId: current.courseId, course: { profileId: profile.id } },
                data: { orderIndex: current.orderIndex },
            })
            if (first.count !== 1 || second.count !== 1) throw new Error("Course module order changed concurrently")
            return { courseId: current.courseId, moved: true }
        }),
    }))
    if (result.result.moved) revalidatePath(`/dashboard/courses/${result.result.courseId}/edit`)
}

export interface LessonData {
    title: string
    description?: string
    contentType: "VIDEO" | "TEXT" | "PDF"
    contentUrl?: string
    videoUrl?: string
    body?: string
    fileUrl?: string
    durationMinutes: number
    isFree: boolean
}

function lessonWrite(data: LessonData) {
    return {
        title: data.title,
        description: data.description || null,
        contentType: data.contentType,
        contentUrl: data.contentUrl || data.videoUrl || data.body || null,
        videoUrl: data.videoUrl || null,
        body: data.body || data.description || null,
        fileUrl: data.fileUrl || null,
        durationMinutes: data.durationMinutes,
        isFree: data.isFree,
    }
}

export async function createCourseLesson(moduleId: string, data: LessonData) {
    const { module, profileId } = await ownedModule(moduleId)
    const last = await prisma.courseLesson.findFirst({
        where: { moduleId: module.id },
        orderBy: { orderIndex: "desc" },
    })
    const lesson = await prisma.courseLesson.create({
        data: {
            moduleId: module.id,
            ...lessonWrite(data),
            orderIndex: (last?.orderIndex ?? -1) + 1,
        },
    })
    await recountCourse(module.courseId, profileId)
    revalidatePath(`/dashboard/courses/${module.courseId}/edit`)
    revalidatePath("/dashboard/courses")
    return lesson
}

export async function updateCourseLesson(lessonId: string, data: LessonData) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: lessonId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const updated = await tx.courseLesson.updateMany({
                where: { id: resourceId, module: { course: { profileId: profile.id } } },
                data: lessonWrite(data),
            })
            if (updated.count !== 1) return null
            return tx.courseLesson.findFirst({
                where: { id: resourceId, module: { course: { profileId: profile.id } } },
                include: { module: true },
            })
        }),
    }))
    const lesson = result.result
    revalidatePath(`/dashboard/courses/${lesson.module.courseId}/edit`)
    return lesson
}

export async function importModulesIntoCourse(courseId: string, outline: string) {
    const { course } = await ownedCourse(courseId)
    const { parseCurriculumOutline } = await import("@/lib/import-extract")
    const modules = parseCurriculumOutline(outline)
    for (const moduleOutline of modules) {
        const created = await createCourseModule(course.id, {
            title: moduleOutline.title,
            description: moduleOutline.description,
        })
        for (const lesson of moduleOutline.lessons) {
            await createCourseLesson(created.id, {
                title: lesson.title,
                contentType: lesson.contentType,
                durationMinutes: lesson.durationMinutes,
                isFree: lesson.isFree,
            })
        }
    }
    revalidatePath(`/dashboard/courses/${course.id}/edit`)
    return modules.length
}

export async function moveCourseLesson(lessonId: string, direction: -1 | 1) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: lessonId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const current = await tx.courseLesson.findFirst({
                where: { id: resourceId, module: { course: { profileId: profile.id } } },
                include: { module: true },
            })
            if (!current) return null
            const swap = await tx.courseLesson.findFirst({
                where: {
                    moduleId: current.moduleId,
                    module: { course: { profileId: profile.id } },
                    orderIndex: direction < 0 ? { lt: current.orderIndex } : { gt: current.orderIndex },
                },
                orderBy: { orderIndex: direction < 0 ? "desc" : "asc" },
            })
            if (!swap) return { courseId: current.module.courseId, moved: false }
            const first = await tx.courseLesson.updateMany({
                where: { id: current.id, moduleId: current.moduleId, module: { course: { profileId: profile.id } } },
                data: { orderIndex: swap.orderIndex },
            })
            const second = await tx.courseLesson.updateMany({
                where: { id: swap.id, moduleId: current.moduleId, module: { course: { profileId: profile.id } } },
                data: { orderIndex: current.orderIndex },
            })
            if (first.count !== 1 || second.count !== 1) throw new Error("Course lesson order changed concurrently")
            return { courseId: current.module.courseId, moved: true }
        }),
    }))
    if (result.result.moved) revalidatePath(`/dashboard/courses/${result.result.courseId}/edit`)
}

export async function deleteCourseLesson(lessonId: string) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: lessonId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const lesson = await tx.courseLesson.findFirst({
                where: { id: resourceId, module: { course: { profileId: profile.id } } },
                select: { module: { select: { courseId: true } } },
            })
            if (!lesson) return null
            const deleted = await tx.courseLesson.deleteMany({
                where: { id: resourceId, module: { course: { profileId: profile.id } } },
            })
            return deleted.count === 1 ? { courseId: lesson.module.courseId } : null
        }),
    }))
    await recountCourse(result.result.courseId, result.ownership.profile.id)
    revalidatePath("/dashboard/courses")
    revalidatePath(`/dashboard/courses/${result.result.courseId}/edit`)
}
