"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface ProductData {
    title: string
    description?: string
    type: "PDF" | "VIDEO" | "AUDIO" | "OTHER"
    price: number
    fileUrl?: string
    thumbnailUrl?: string
    isActive: boolean
}

export async function createProduct(profileId: string, data: ProductData) {
    await prisma.digitalProduct.create({
        data: {
            profileId,
            title: data.title,
            description: data.description || null,
            type: data.type,
            priceCents: Math.round(data.price * 100),
            fileUrl: data.fileUrl || null,
            thumbnailUrl: data.thumbnailUrl || null,
            isActive: data.isActive,
            currency: "USD",
        }
    })
    revalidatePath("/dashboard/products")
}

export async function updateProduct(productId: string, data: ProductData) {
    await prisma.digitalProduct.update({
        where: { id: productId },
        data: {
            title: data.title,
            description: data.description || null,
            type: data.type,
            priceCents: Math.round(data.price * 100),
            fileUrl: data.fileUrl || null,
            thumbnailUrl: data.thumbnailUrl || null,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/products")
}

export async function deleteProduct(productId: string) {
    await prisma.digitalProduct.delete({
        where: { id: productId }
    })
    revalidatePath("/dashboard/products")
}
