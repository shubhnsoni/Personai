"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function updateLeadStatus(leadId: string, status: string) {
    await prisma.visitorLead.update({
        where: { id: leadId },
        data: { status },
    })

    revalidatePath("/dashboard/leads")
}
