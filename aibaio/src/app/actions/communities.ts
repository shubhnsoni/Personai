"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface CommunityData {
    name: string
    description?: string
    platform: "TELEGRAM" | "DISCORD"
    inviteLink?: string
    price: number
    billingCycle: "MONTHLY" | "YEARLY" | "ONE_TIME"
    isActive: boolean
}

export async function createCommunity(profileId: string, data: CommunityData) {
    await prisma.community.create({
        data: {
            profileId,
            name: data.name,
            description: data.description || null,
            platform: data.platform,
            inviteLink: data.inviteLink || null,
            priceCents: Math.round(data.price * 100),
            billingCycle: data.billingCycle,
            isActive: data.isActive,
            currency: "USD",
        }
    })
    revalidatePath("/dashboard/community")
}

export async function updateCommunity(communityId: string, data: CommunityData) {
    await prisma.community.update({
        where: { id: communityId },
        data: {
            name: data.name,
            description: data.description || null,
            platform: data.platform,
            inviteLink: data.inviteLink || null,
            priceCents: Math.round(data.price * 100),
            billingCycle: data.billingCycle,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/community")
}

export async function deleteCommunity(communityId: string) {
    await prisma.community.delete({
        where: { id: communityId }
    })
    revalidatePath("/dashboard/community")
}
