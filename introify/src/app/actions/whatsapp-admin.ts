"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import {
    ensureSeedWhatsappNumber,
    setWhatsappNumberDefault,
    setWhatsappNumberStatus,
    unlinkWhatsappNumberCredentials,
    upsertWhatsappBusinessNumber,
} from "@/lib/whatsapp/numbers"

async function audit(actorUserId: string, action: string, meta?: unknown) {
    await prisma.auditEvent.create({
        data: {
            actorUserId,
            action,
            profileId: null,
            meta: meta ? JSON.stringify(meta).slice(0, 2000) : null,
        },
    }).catch(() => {})
}

export async function upsertAdminWhatsappNumber(input: {
    id?: string
    e164: string
    label: string
    accountSid?: string
    authToken?: string
    whatsappFrom?: string
    status?: "ACTIVE" | "DISABLED"
    isDefault?: boolean
}) {
    const admin = await requireAdmin()
    const row = await upsertWhatsappBusinessNumber(input)
    await audit(admin.id, "whatsapp_number_upsert", { id: row.id, e164: row.e164, status: row.status })
    revalidatePath("/admin/whatsapp")
    return { id: row.id }
}

export async function disableAdminWhatsappNumber(id: string) {
    const admin = await requireAdmin()
    await setWhatsappNumberStatus(id, "DISABLED")
    await audit(admin.id, "whatsapp_number_disable", { id })
    revalidatePath("/admin/whatsapp")
}

export async function enableAdminWhatsappNumber(id: string) {
    const admin = await requireAdmin()
    await setWhatsappNumberStatus(id, "ACTIVE")
    await audit(admin.id, "whatsapp_number_enable", { id })
    revalidatePath("/admin/whatsapp")
}

export async function defaultAdminWhatsappNumber(id: string) {
    const admin = await requireAdmin()
    await setWhatsappNumberDefault(id)
    await audit(admin.id, "whatsapp_number_default", { id })
    revalidatePath("/admin/whatsapp")
}

export async function unlinkAdminWhatsappNumber(id: string) {
    const admin = await requireAdmin()
    await unlinkWhatsappNumberCredentials(id)
    await audit(admin.id, "whatsapp_number_unlink", { id })
    revalidatePath("/admin/whatsapp")
}

export async function seedAdminWhatsappNumber() {
    const admin = await requireAdmin()
    const row = await ensureSeedWhatsappNumber()
    await audit(admin.id, "whatsapp_number_seed", { id: row.id, e164: row.e164 })
    revalidatePath("/admin/whatsapp")
    return { id: row.id, e164: row.e164 }
}
