"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function addService(profileId: string, data: { name: string, description: string, price: number, duration: number }) {
    await prisma.serviceOffering.create({
        data: {
            profileId,
            name: data.name,
            description: data.description,
            priceCents: data.price * 100, // Convert to cents
            durationMinutes: data.duration,
            currency: "USD",
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
