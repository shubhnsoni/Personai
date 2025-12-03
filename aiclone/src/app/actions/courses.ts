"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface CourseData {
    title: string
    description?: string
    price: number
    thumbnailUrl?: string
    isActive: boolean
    isPublished: boolean
}

export async function createCourse(profileId: string, data: CourseData) {
    await prisma.course.create({
        data: {
            profileId,
            title: data.title,
            description: data.description || null,
            priceCents: Math.round(data.price * 100),
            thumbnailUrl: data.thumbnailUrl || null,
            isActive: data.isActive,
            isPublished: data.isPublished,
            currency: "USD",
        }
    })
    revalidatePath("/dashboard/courses")
}

export async function updateCourse(courseId: string, data: CourseData) {
    await prisma.course.update({
        where: { id: courseId },
        data: {
            title: data.title,
            description: data.description || null,
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
