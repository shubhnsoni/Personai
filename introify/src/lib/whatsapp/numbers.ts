import { prisma } from "@/lib/prisma"
import { normalizeE164 } from "@/lib/whatsapp/phone"
import { twilioWhatsappFrom } from "@/lib/whatsapp/twilio"
import type { WhatsappBusinessNumber, WhatsappNumberStatus } from "@prisma/client"

export type PublicWhatsappNumber = Omit<WhatsappBusinessNumber, "authToken" | "accountSid"> & {
    accountSidMasked: string
    authTokenMasked: string
    hasCredentials: boolean
}

function maskSecret(value: string): string {
    const v = value || ""
    if (!v) return ""
    if (v.length <= 4) return "••••"
    return `${"•".repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`
}

export function toPublicNumber(row: WhatsappBusinessNumber): PublicWhatsappNumber {
    const { authToken, accountSid, ...rest } = row
    return {
        ...rest,
        accountSidMasked: maskSecret(accountSid),
        authTokenMasked: maskSecret(authToken),
        hasCredentials: Boolean(accountSid && authToken),
    }
}

export async function listWhatsappBusinessNumbers() {
    const rows = await prisma.whatsappBusinessNumber.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] })
    return rows.map(toPublicNumber)
}

export async function getDefaultActiveWhatsappNumber() {
    const preferred = await prisma.whatsappBusinessNumber.findFirst({
        where: { status: "ACTIVE", isDefault: true },
    })
    if (preferred) return preferred
    return prisma.whatsappBusinessNumber.findFirst({ where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" } })
}

export async function findWhatsappNumberForInboundTo(toRaw: string) {
    const e164 = normalizeE164(toRaw.replace(/^whatsapp:/i, ""))
    if (!e164) return getDefaultActiveWhatsappNumber()
    const from = twilioWhatsappFrom(e164)
    const hit = await prisma.whatsappBusinessNumber.findFirst({
        where: {
            OR: [
                { e164 },
                { whatsappFrom: from },
                { whatsappFrom: e164 },
            ],
        },
    })
    return hit || getDefaultActiveWhatsappNumber()
}

export type UpsertWhatsappNumberInput = {
    id?: string
    e164: string
    label: string
    accountSid?: string
    authToken?: string
    whatsappFrom?: string
    status?: WhatsappNumberStatus
    isDefault?: boolean
}

export async function upsertWhatsappBusinessNumber(input: UpsertWhatsappNumberInput) {
    const e164 = normalizeE164(input.e164)
    if (!e164) throw new Error("Invalid WhatsApp number")
    const whatsappFrom = input.whatsappFrom?.trim()
        ? (input.whatsappFrom.trim().startsWith("whatsapp:") ? input.whatsappFrom.trim() : twilioWhatsappFrom(input.whatsappFrom.trim()))
        : twilioWhatsappFrom(e164)

    if (input.isDefault) {
        await prisma.whatsappBusinessNumber.updateMany({ data: { isDefault: false } })
    }

    if (input.id) {
        const existing = await prisma.whatsappBusinessNumber.findUnique({ where: { id: input.id } })
        if (!existing) throw new Error("Number not found")
        const data: Record<string, unknown> = {
            e164,
            label: input.label.trim() || e164,
            whatsappFrom,
            status: input.status ?? existing.status,
            isDefault: input.isDefault ?? existing.isDefault,
        }
        if (input.accountSid !== undefined && input.accountSid !== "") data.accountSid = input.accountSid.trim()
        if (input.authToken !== undefined && input.authToken !== "") data.authToken = input.authToken.trim()
        // Explicit clear when caller sends empty string with intent to unlink secrets — handled by unlinkCredentials
        return prisma.whatsappBusinessNumber.update({ where: { id: input.id }, data })
    }

    return prisma.whatsappBusinessNumber.create({
        data: {
            e164,
            label: input.label.trim() || e164,
            provider: "TWILIO",
            accountSid: input.accountSid?.trim() || "",
            authToken: input.authToken?.trim() || "",
            whatsappFrom,
            status: input.status ?? "ACTIVE",
            isDefault: Boolean(input.isDefault),
        },
    })
}

export async function setWhatsappNumberStatus(id: string, status: WhatsappNumberStatus) {
    return prisma.whatsappBusinessNumber.update({ where: { id }, data: { status } })
}

export async function setWhatsappNumberDefault(id: string) {
    await prisma.$transaction([
        prisma.whatsappBusinessNumber.updateMany({ data: { isDefault: false } }),
        prisma.whatsappBusinessNumber.update({ where: { id }, data: { isDefault: true, status: "ACTIVE" } }),
    ])
}

/** Unlink = clear Twilio credentials (keep row for history / re-link). */
export async function unlinkWhatsappNumberCredentials(id: string) {
    return prisma.whatsappBusinessNumber.update({
        where: { id },
        data: { accountSid: "", authToken: "", status: "DISABLED", isDefault: false },
    })
}

export async function ensureSeedWhatsappNumber() {
    const e164 = "+917970547297"
    const existing = await prisma.whatsappBusinessNumber.findUnique({ where: { e164 } })
    if (existing) return existing
    const anyDefault = await prisma.whatsappBusinessNumber.findFirst({ where: { isDefault: true } })
    return prisma.whatsappBusinessNumber.create({
        data: {
            e164,
            label: "Introify primary",
            provider: "TWILIO",
            whatsappFrom: twilioWhatsappFrom(e164),
            status: "ACTIVE",
            isDefault: !anyDefault,
        },
    })
}
