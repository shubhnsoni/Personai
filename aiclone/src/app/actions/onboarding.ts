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

const DEFAULT_SERVICE_BY_ROLE: Readonly<Record<string, { name: string; description: string }>> = {
    CONSULTANT: { name: "Fit call", description: "A first conversation to see if we should work together." },
    CA: { name: "Fit call", description: "A first conversation to see if we should work together." },
    COACH: { name: "Intro session", description: "A first conversation to see if we should work together." },
    SALON_SPA: { name: "Consultation", description: "A first appointment before choosing a treatment." },
    EVENTS_STUDIO: { name: "Event discovery call", description: "A first conversation about the event brief." },
    REAL_ESTATE_BROKERAGE: { name: "Property consultation", description: "A first conversation about a mandate or viewing." },
    RECRUITMENT_AGENCY: { name: "Hiring brief", description: "A first conversation about the role to fill." },
}

async function availableBusinessSlug(displayName: string): Promise<string> {
    const base = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"
    let candidate = base
    let suffix = 2

    while (true) {
        const [profile, workspace] = await Promise.all([
            prisma.profile.findUnique({ where: { slug: candidate }, select: { id: true } }),
            prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } }),
        ])
        if (!profile && !workspace) return candidate
        candidate = `${base}-${suffix++}`
    }
}

export async function createProfile(data: CreateProfileData): Promise<CreateProfileResult> {
    const actor = unwrapOwnershipResult(await requireAuthenticatedUser())
    const displayName = data.displayName.trim()
    if (!displayName) throw new TypeError("Profile display name is required")

    const slug = await availableBusinessSlug(displayName)
    const extras = extrasFromAddons(data.roleTemplate, data.addons || [])
    const defaultService = DEFAULT_SERVICE_BY_ROLE[data.roleTemplate]
    const profile = await prisma.$transaction(async (tx) => {
        const created = await tx.profile.create({
            data: {
                userId: actor.userId,
                slug,
                displayName,
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
        const workspace = await tx.workspace.create({
            data: {
                profileId: created.id,
                name: created.displayName,
                slug: created.slug,
            },
        })
        await tx.membership.create({
            data: {
                workspaceId: workspace.id,
                userId: actor.userId,
                role: "OWNER",
            },
        })

        if (data.roleTemplate === "RESTAURANT") {
            await tx.serviceOffering.create({
                data: {
                    profileId: created.id,
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
            await tx.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId: created.id,
                    dayOfWeek,
                    startTime: "12:00",
                    endTime: "22:00",
                    isEnabled: dayOfWeek !== 1,
                })),
            })
        }

        if (defaultService) {
            await tx.serviceOffering.create({
                data: {
                    profileId: created.id,
                    name: defaultService.name,
                    description: defaultService.description,
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: 30,
                    currency: "USD",
                    isActive: true,
                    kind: "SESSION",
                },
            })
            await tx.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId: created.id,
                    dayOfWeek,
                    startTime: "10:00",
                    endTime: "18:00",
                    isEnabled: dayOfWeek >= 1 && dayOfWeek <= 5,
                })),
            })
        }

        if (data.addons?.includes("services") && !defaultService && data.roleTemplate !== "RESTAURANT") {
            await tx.serviceOffering.create({
                data: {
                    profileId: created.id,
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

        return created
    })

    revalidatePath("/dashboard")
    if (data.activate) {
        const jar = await cookies()
        jar.set(ACTIVE_PROFILE_COOKIE, profile.id, { path: "/", sameSite: "lax", httpOnly: true })
    }
    const need = needById(data.needId)
    const next = data.needId ? need.next : (
        data.roleTemplate === "DISTRIBUTOR" ? "/dashboard/orders" : data.roleTemplate === "RESTAURANT" || data.roleTemplate === "SHOP" || data.roleTemplate === "JEWELRY_RETAIL" || data.roleTemplate === "JEWELRY_WHOLESALE" || data.roleTemplate === "PHARMACY" || data.roleTemplate === "AUTO_PARTS" ? "/dashboard/products"
        : data.roleTemplate === "CONSULTANT" || data.roleTemplate === "CA" ? "/dashboard/services"
        : data.roleTemplate === "COACH" ? "/dashboard/courses"
        : "/dashboard"
    )
    return { slug: profile.slug, next }
}
