"use server"

import { prisma } from "@/lib/prisma"
import { executeOwnedResourceWrite, requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
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

function communityWrite(data: CommunityData) {
    return {
        name: data.name,
        description: data.description || null,
        platform: data.platform,
        inviteLink: data.inviteLink || null,
        priceCents: Math.round(data.price * 100),
        billingCycle: data.billingCycle,
        isActive: data.isActive,
    }
}

export async function createCommunity(profileId: string, data: CommunityData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    await prisma.community.create({
        data: {
            profileId: profile.id,
            ...communityWrite(data),
            currency: "USD",
        },
    })
    revalidatePath("/dashboard/community")
}

export async function updateCommunity(communityId: string, data: CommunityData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: communityId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.community.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: communityWrite(data),
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/community")
}

export async function deleteCommunity(communityId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: communityId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.community.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/community")
}
