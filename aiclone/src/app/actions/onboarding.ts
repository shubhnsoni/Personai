"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { extrasFromAddons, needById, type AddonId, type NeedId } from "@/lib/onboarding-needs"
import { writeExtras } from "@/lib/surfaces"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"
import { requireAuthenticatedUser, unwrapOwnershipResult } from "@/lib/security"

export interface CreateProfileData {
    displayName: string
    headline?: string
    bio?: string
    roleTemplate: string
    primaryGoal: string
    language?: string
    timezone?: string
    animationStyleId?: string
    needId?: NeedId
    addons?: AddonId[]
    activate?: boolean
    imageUrl?: string
    chatAvatarMode?: string
    personalityConfig?: string
}

export interface CreateProfileResult {
    slug: string
    next: string
}

export async function createProfile(
    dataOrClaimedUserId: CreateProfileData | string,
    legacyData?: CreateProfileData,
): Promise<CreateProfileResult> {
    const actor = unwrapOwnershipResult(await requireAuthenticatedUser())
    const claimedUserId = typeof dataOrClaimedUserId === "string" ? dataOrClaimedUserId : undefined
    const data = typeof dataOrClaimedUserId === "string" ? legacyData : dataOrClaimedUserId

    if (!data) throw new TypeError("Profile data is required")
    if (claimedUserId !== undefined && claimedUserId !== actor.userId) {
        unwrapOwnershipResult({
            ok: false,
            refusal: { code: "FORBIDDEN", status: 403, message: "Access denied" },
        })
    }

    let slug = data.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    if (!slug) slug = "page"
    const existing = await prisma.profile.findUnique({ where: { slug } })
    if (existing) slug = `${slug}-${Math.floor(Math.random() * 1000)}`

    const extras = extrasFromAddons(data.roleTemplate, data.addons || [])
    const profile = await prisma.profile.create({
        data: {
            userId: actor.userId,
            slug,
            displayName: data.displayName,
            headline: data.headline,
            bio: data.bio,
            roleTemplate: data.roleTemplate,
            primaryGoal: data.primaryGoal,
            language: data.language || "en",
            timezone: data.timezone || "UTC",
            animationStyleId: data.animationStyleId || null,
            isPublic: true,
            imageUrl: data.imageUrl || null,
            chatAvatarMode: data.chatAvatarMode === "IMAGE" && data.imageUrl ? "IMAGE" : "ORB",
            personalityConfig: writeExtras(data.personalityConfig || null, extras),
        },
    })

    if (data.roleTemplate === "RESTAURANT") {
        await prisma.serviceOffering.create({
            data: {
                profileId: profile.id,
                name: "Reserve a table",
                description: "Dine-in seating",
                priceCents: 0,
                isFree: true,
                durationMinutes: 90,
                currency: "USD",
                isActive: true,
                kind: "TABLE",
                covers: 20,
            },
        })
        await prisma.availabilitySchedule.createMany({
            data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                profileId: profile.id,
                dayOfWeek,
                startTime: "12:00",
                endTime: "22:00",
                isEnabled: dayOfWeek !== 1,
            })),
        })
    }

    if (data.roleTemplate === "CONSULTANT" || data.roleTemplate === "CA" || data.roleTemplate === "COACH") {
        await prisma.serviceOffering.create({
            data: {
                profileId: profile.id,
                name: data.roleTemplate === "COACH" ? "Intro session" : "Fit call",
                description: "A first conversation to see if we should work together.",
                priceCents: 0,
                isFree: true,
                durationMinutes: 30,
                currency: "USD",
                isActive: true,
                kind: "SESSION",
            },
        })
        await prisma.availabilitySchedule.createMany({
            data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                profileId: profile.id,
                dayOfWeek,
                startTime: "10:00",
                endTime: "18:00",
                isEnabled: dayOfWeek >= 1 && dayOfWeek <= 5,
            })),
        })
    }

    if (data.addons?.includes("services") && data.roleTemplate !== "CONSULTANT" && data.roleTemplate !== "CA" && data.roleTemplate !== "COACH" && data.roleTemplate !== "RESTAURANT") {
        await prisma.serviceOffering.create({
            data: {
                profileId: profile.id,
                name: "Fit call",
                description: "A first conversation to see if we should work together.",
                priceCents: 0,
                isFree: true,
                durationMinutes: 30,
                currency: "USD",
                isActive: true,
                kind: "SESSION",
            },
        })
    }

    revalidatePath("/dashboard")
    if (data.activate) {
        const jar = await cookies()
        jar.set(ACTIVE_PROFILE_COOKIE, profile.id, { path: "/", sameSite: "lax", httpOnly: true })
    }
    const need = needById(data.needId)
    const next = data.needId ? need.next : (
        data.roleTemplate === "RESTAURANT" || data.roleTemplate === "SHOP" ? "/dashboard/products"
        : data.roleTemplate === "CONSULTANT" || data.roleTemplate === "CA" ? "/dashboard/services"
        : data.roleTemplate === "COACH" ? "/dashboard/courses"
        : "/dashboard"
    )
    return { slug: profile.slug, next }
}
