"use server"

import { prisma } from "@/lib/prisma"
import { executeOwnedResourceWrite, requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { revalidatePath } from "next/cache"

type ServiceData = {
    name: string
    description: string
    price: number
    duration: number
    isRecurring?: boolean
    packageSessions?: number
    kind?: "SESSION" | "TABLE"
    covers?: number | null
}

function serviceWrite(data: ServiceData, preserveKind = false) {
    const priceCents = Math.round((Number.isFinite(data.price) ? data.price : 0) * 100)
    const kind = data.kind === "TABLE" ? "TABLE" : preserveKind && data.kind !== "SESSION" ? undefined : "SESSION"
    return {
        name: data.name,
        description: data.description,
        priceCents,
        isFree: priceCents === 0,
        durationMinutes: data.duration,
        isRecurring: Boolean(data.isRecurring),
        packageSessions: data.packageSessions && data.packageSessions > 0 ? data.packageSessions : 1,
        ...(kind ? {
            kind,
            covers: kind === "TABLE"
                ? (data.covers && data.covers > 0 ? data.covers : 20)
                : data.covers ?? null,
        } : {}),
    }
}

export async function addService(profileId: string, data: ServiceData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    await prisma.serviceOffering.create({
        data: {
            profileId: profile.id,
            ...serviceWrite(data),
            currency: "USD",
            isActive: true,
        },
    })
    revalidatePath("/dashboard/services")
}

export async function updateService(serviceId: string, data: ServiceData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: serviceId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.serviceOffering.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: serviceWrite(data, true),
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/services")
}

export async function deleteService(serviceId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: serviceId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.serviceOffering.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/services")
}

export async function setServiceActive(serviceId: string, isActive: boolean) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: serviceId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.serviceOffering.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: { isActive },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/services")
}
