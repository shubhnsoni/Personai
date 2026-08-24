"use server"

import { prisma } from "@/lib/prisma"
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

export async function createCourse(profileId: string, data: CourseData) {
    const course = await prisma.course.create({
        data: {
            profileId,
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
            currency: "USD",
        }
    })
    revalidatePath("/dashboard/courses")
    return course
}

export async function updateCourse(courseId: string, data: CourseData) {
    await prisma.course.update({
        where: { id: courseId },
        data: {
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
    })
    revalidatePath("/dashboard/courses")
}

export async function deleteCourse(courseId: string) {
    await prisma.course.delete({
        where: { id: courseId }
    })
    revalidatePath("/dashboard/courses")
}

export async function setCoursePublished(courseId: string, published: boolean) {
    await prisma.course.update({
        where: { id: courseId },
        data: { isPublished: published, isActive: published },
    })
    revalidatePath("/dashboard/courses")
}

async function recountCourse(courseId: string) {
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { modules: { include: { _count: { select: { lessons: true } } } } },
    })
    if (!course) return
    await prisma.course.update({
        where: { id: courseId },
        data: {
            totalModules: course.modules.length,
            totalLessons: course.modules.reduce((n, m) => n + m._count.lessons, 0),
        },
    })
}

export async function createCourseModule(courseId: string, data: { title: string; description?: string }) {
    const last = await prisma.courseModule.findFirst({
        where: { courseId },
        orderBy: { orderIndex: "desc" },
    })
    const module = await prisma.courseModule.create({
        data: {
            courseId,
            title: data.title,
            description: data.description || null,
            orderIndex: (last?.orderIndex ?? -1) + 1,
        },
    })
    await recountCourse(courseId)
    revalidatePath("/dashboard/courses")
    revalidatePath(`/dashboard/courses/${courseId}/edit`)
    return module
}

export async function updateCourseModule(moduleId: string, data: { title: string; description?: string }) {
    const module = await prisma.courseModule.update({
        where: { id: moduleId },
        data: {
            title: data.title,
            description: data.description || null,
        },
    })
    revalidatePath(`/dashboard/courses/${module.courseId}/edit`)
    return module
}

export async function deleteCourseModule(moduleId: string) {
    const module = await prisma.courseModule.delete({ where: { id: moduleId } })
    await recountCourse(module.courseId)
    revalidatePath("/dashboard/courses")
    revalidatePath(`/dashboard/courses/${module.courseId}/edit`)
}

export async function moveCourseModule(moduleId: string, direction: -1 | 1) {
    const current = await prisma.courseModule.findUnique({ where: { id: moduleId } })
    if (!current) return
    const swap = await prisma.courseModule.findFirst({
        where: {
            courseId: current.courseId,
            orderIndex: direction < 0 ? { lt: current.orderIndex } : { gt: current.orderIndex },
        },
        orderBy: { orderIndex: direction < 0 ? "desc" : "asc" },
    })
    if (!swap) return
    await prisma.$transaction([
        prisma.courseModule.update({ where: { id: current.id }, data: { orderIndex: swap.orderIndex } }),
        prisma.courseModule.update({ where: { id: swap.id }, data: { orderIndex: current.orderIndex } }),
    ])
    revalidatePath(`/dashboard/courses/${current.courseId}/edit`)
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

export async function createCourseLesson(moduleId: string, data: LessonData) {
    const last = await prisma.courseLesson.findFirst({
        where: { moduleId },
        orderBy: { orderIndex: "desc" },
    })
    const lesson = await prisma.courseLesson.create({
        data: {
            moduleId,
            title: data.title,
            description: data.description || null,
            contentType: data.contentType,
            contentUrl: data.contentUrl || data.videoUrl || data.body || null,
            videoUrl: data.videoUrl || null,
            body: data.body || data.description || null,
            fileUrl: data.fileUrl || null,
            durationMinutes: data.durationMinutes,
            isFree: data.isFree,
            orderIndex: (last?.orderIndex ?? -1) + 1,
        },
    })
    const module = await prisma.courseModule.findUnique({ where: { id: moduleId } })
    if (module) {
        await recountCourse(module.courseId)
        revalidatePath(`/dashboard/courses/${module.courseId}/edit`)
    }
    revalidatePath("/dashboard/courses")
    return lesson
}

export async function updateCourseLesson(lessonId: string, data: LessonData) {
    const lesson = await prisma.courseLesson.update({
        where: { id: lessonId },
        data: {
            title: data.title,
            description: data.description || null,
            contentType: data.contentType,
            contentUrl: data.contentUrl || data.videoUrl || data.body || null,
            videoUrl: data.videoUrl || null,
            body: data.body || data.description || null,
            fileUrl: data.fileUrl || null,
            durationMinutes: data.durationMinutes,
            isFree: data.isFree,
        },
        include: { module: true },
    })
    revalidatePath(`/dashboard/courses/${lesson.module.courseId}/edit`)
    return lesson
}

export async function importModulesIntoCourse(courseId: string, outline: string) {
    const { parseCurriculumOutline } = await import("@/lib/import-extract")
    const modules = parseCurriculumOutline(outline)
    for (const mod of modules) {
        const created = await createCourseModule(courseId, { title: mod.title, description: mod.description })
        for (const lesson of mod.lessons) {
            await createCourseLesson(created.id, {
                title: lesson.title,
                contentType: lesson.contentType,
                durationMinutes: lesson.durationMinutes,
                isFree: lesson.isFree,
            })
        }
    }
    revalidatePath(`/dashboard/courses/${courseId}/edit`)
    return modules.length
}

export async function moveCourseLesson(lessonId: string, direction: -1 | 1) {
    const current = await prisma.courseLesson.findUnique({
        where: { id: lessonId },
        include: { module: true },
    })
    if (!current) return
    const swap = await prisma.courseLesson.findFirst({
        where: {
            moduleId: current.moduleId,
            orderIndex: direction < 0 ? { lt: current.orderIndex } : { gt: current.orderIndex },
        },
        orderBy: { orderIndex: direction < 0 ? "desc" : "asc" },
    })
    if (!swap) return
    await prisma.$transaction([
        prisma.courseLesson.update({ where: { id: current.id }, data: { orderIndex: swap.orderIndex } }),
        prisma.courseLesson.update({ where: { id: swap.id }, data: { orderIndex: current.orderIndex } }),
    ])
    revalidatePath(`/dashboard/courses/${current.module.courseId}/edit`)
}

export async function deleteCourseLesson(lessonId: string) {
    const lesson = await prisma.courseLesson.delete({
        where: { id: lessonId },
        include: { module: true },
    })
    await recountCourse(lesson.module.courseId)
    revalidatePath("/dashboard/courses")
    revalidatePath(`/dashboard/courses/${lesson.module.courseId}/edit`)
}
