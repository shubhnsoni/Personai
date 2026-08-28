"use server"

import { prisma } from "@/lib/prisma"
import {
    executeOwnedResourceWrite,
    requireOwnedProfile,
    unwrapOwnershipResult,
} from "@/lib/security"
import { revalidatePath } from "next/cache"

export type ProfileUpdateData = {
    displayName?: string
    headline?: string
    bio?: string
    slug?: string
    roleTemplate?: string
    primaryGoal?: string
    language?: string
    timezone?: string
    animationStyleId?: string
    isPublic?: boolean
    welcomeMessageOverride?: string
    contentDisplayMode?: string
    personalityConfig?: string
    aiModel?: string
    imageUrl?: string
    shopLogoUrl?: string
    chatAvatarMode?: string
    autoMemoryEnabled?: boolean
    liveChatEnabled?: boolean
    liveChatSlaMinutes?: number
    whatsapp?: string
    upiId?: string
    gstin?: string
    deliveryNote?: string
}

export type WorkExperienceData = {
    company: string
    role: string
    startDate: string
    endDate?: string | null
    description?: string | null
    achievements?: string | null
}

export type ProjectData = {
    title: string
    description?: string | null
    client?: string | null
    year?: string | null
    imageUrl?: string | null
    link?: string | null
}

export async function updateProfile(profileId: string, data: ProfileUpdateData) {
    const result = unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: profileId,
        claimedProfileId: profileId,
        writeOwned: async ({ resourceId, actor }) => {
            if (data.slug) {
                const existing = await prisma.profile.findUnique({
                    where: { slug: data.slug },
                    select: { id: true },
                })
                if (existing && existing.id !== resourceId) throw new Error("Slug already taken")
            }

            const updated = await prisma.profile.updateMany({
                where: { id: resourceId, userId: actor.userId },
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
                    imageUrl: data.imageUrl || null,
                    shopLogoUrl: data.shopLogoUrl || null,
                    chatAvatarMode: data.chatAvatarMode === "IMAGE" ? "IMAGE" : "ORB",
                    autoMemoryEnabled: Boolean(data.autoMemoryEnabled),
                    liveChatEnabled: Boolean(data.liveChatEnabled),
                    liveChatSlaMinutes: Number(data.liveChatSlaMinutes) || 10,
                    whatsapp: data.whatsapp?.trim() || null,
                    upiId: data.upiId?.trim() || null,
                    gstin: data.gstin?.trim() || null,
                    deliveryNote: data.deliveryNote?.trim() || null,
                },
            })
            return updated.count === 1 ? true : null
        },
    }))
    void result

    revalidatePath("/dashboard/profile")
    if (data.slug) revalidatePath(`/${data.slug}`)
}

export async function createWorkExperience(profileId: string, data: WorkExperienceData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    await prisma.workExperience.create({
        data: {
            profileId: profile.id,
            company: data.company,
            role: data.role,
            startDate: data.startDate,
            endDate: data.endDate || null,
            description: data.description,
            achievements: data.achievements,
        },
    })
    revalidatePath("/dashboard/profile")
}

export async function updateWorkExperience(id: string, data: WorkExperienceData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: id,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.workExperience.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: {
                    company: data.company,
                    role: data.role,
                    startDate: data.startDate,
                    endDate: data.endDate || null,
                    description: data.description,
                    achievements: data.achievements,
                },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/profile")
}

export async function deleteWorkExperience(id: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: id,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.workExperience.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/profile")
}

export async function createProject(profileId: string, data: ProjectData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    await prisma.project.create({
        data: {
            profileId: profile.id,
            title: data.title,
            description: data.description,
            client: data.client,
            year: data.year,
            imageUrl: data.imageUrl,
            link: data.link,
        },
    })
    revalidatePath("/dashboard/profile")
}

export async function updateProject(id: string, data: ProjectData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: id,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.project.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: {
                    title: data.title,
                    description: data.description,
                    client: data.client,
                    year: data.year,
                    imageUrl: data.imageUrl,
                    link: data.link,
                },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/profile")
}

export async function deleteProject(id: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: id,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.project.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/profile")
}
