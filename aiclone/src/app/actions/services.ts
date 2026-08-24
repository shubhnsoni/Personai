"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function addService(profileId: string, data: { name: string, description: string, price: number, duration: number, isRecurring?: boolean, packageSessions?: number, kind?: "SESSION" | "TABLE", covers?: number | null }) {
    const priceCents = Math.round((Number.isFinite(data.price) ? data.price : 0) * 100)
    const kind = data.kind === "TABLE" ? "TABLE" : "SESSION"
    await prisma.serviceOffering.create({
        data: {
            profileId,
            name: data.name,
            description: data.description,
            priceCents,
            isFree: priceCents === 0,
            durationMinutes: data.duration,
            currency: "USD",
            isActive: true,
            isRecurring: Boolean(data.isRecurring),
            packageSessions: data.packageSessions && data.packageSessions > 0 ? data.packageSessions : 1,
            kind,
            covers: kind === "TABLE" ? (data.covers && data.covers > 0 ? data.covers : 20) : data.covers ?? null,
        }
    })
    revalidatePath("/dashboard/services")
}

export async function updateService(serviceId: string, data: { name: string, description: string, price: number, duration: number, isRecurring?: boolean, packageSessions?: number, kind?: "SESSION" | "TABLE", covers?: number | null }) {
    const priceCents = Math.round((Number.isFinite(data.price) ? data.price : 0) * 100)
    const kind = data.kind === "TABLE" ? "TABLE" : data.kind === "SESSION" ? "SESSION" : undefined
    await prisma.serviceOffering.update({
        where: { id: serviceId },
        data: {
            name: data.name,
            description: data.description,
            priceCents,
            isFree: priceCents === 0,
            durationMinutes: data.duration,
            isRecurring: Boolean(data.isRecurring),
            packageSessions: data.packageSessions && data.packageSessions > 0 ? data.packageSessions : 1,
            ...(kind ? { kind, covers: kind === "TABLE" ? (data.covers && data.covers > 0 ? data.covers : 20) : data.covers ?? null } : {}),
        }
    })
    revalidatePath("/dashboard/services")
}

export async function deleteService(serviceId: string) {
    await prisma.serviceOffering.delete({
        where: { id: serviceId }
    })
    revalidatePath("/dashboard/services")
}

export async function setServiceActive(serviceId: string, isActive: boolean) {
    await prisma.serviceOffering.update({
        where: { id: serviceId },
        data: { isActive },
    })
    revalidatePath("/dashboard/services")
}
