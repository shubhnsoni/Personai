"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function updateProfile(profileId: string, data: any) {
    // Validate slug uniqueness if changed
    if (data.slug) {
        const existing = await prisma.profile.findUnique({
            where: { slug: data.slug },
        })
        if (existing && existing.id !== profileId) {
            throw new Error("Slug already taken")
        }
    }

    await prisma.profile.update({
        where: { id: profileId },
        data: {
            displayName: data.displayName,
            headline: data.headline,
            bio: data.bio,
            slug: data.slug,
            roleTemplate: data.roleTemplate,
            primaryGoal: data.primaryGoal,
            language: data.language,
            timezone: data.timezone,
            animationStyleId: data.animationStyleId,
            isPublic: data.isPublic,
            welcomeMessageOverride: data.welcomeMessageOverride,
            contentDisplayMode: data.contentDisplayMode,
            personalityConfig: data.personalityConfig,
            aiModel: data.aiModel,
        },
    })

    revalidatePath("/dashboard/profile")
    revalidatePath(`/${data.slug}`)
}

// Work Experience Actions
export async function createWorkExperience(profileId: string, data: any) {
    await prisma.workExperience.create({
        data: {
            profileId,
            company: data.company,
            role: data.role,
            startDate: data.startDate,
            endDate: data.endDate,
            description: data.description,
            achievements: data.achievements, // Assuming string or JSON string
        }
    })
    revalidatePath("/dashboard/profile")
}

export async function updateWorkExperience(id: string, data: any) {
    await prisma.workExperience.update({
        where: { id },
        data: {
            company: data.company,
            role: data.role,
            startDate: data.startDate,
            endDate: data.endDate,
            description: data.description,
            achievements: data.achievements,
        }
    })
    revalidatePath("/dashboard/profile")
}

export async function deleteWorkExperience(id: string) {
    await prisma.workExperience.delete({
        where: { id }
    })
    revalidatePath("/dashboard/profile")
}

// Project Actions
export async function createProject(profileId: string, data: any) {
    await prisma.project.create({
        data: {
            profileId,
            title: data.title,
            description: data.description,
            client: data.client,
            year: data.year,
            imageUrl: data.imageUrl,
            link: data.link,
        }
    })
    revalidatePath("/dashboard/profile")
}

export async function updateProject(id: string, data: any) {
    await prisma.project.update({
        where: { id },
        data: {
            title: data.title,
            description: data.description,
            client: data.client,
            year: data.year,
            imageUrl: data.imageUrl,
            link: data.link,
        }
    })
    revalidatePath("/dashboard/profile")
}

export async function deleteProject(id: string) {
    await prisma.project.delete({
        where: { id }
    })
    revalidatePath("/dashboard/profile")
}
