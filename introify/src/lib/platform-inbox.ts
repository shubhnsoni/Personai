import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { marketingBusiness } from "@/lib/marketing-business"
import type { InquiryKind } from "@/lib/platform-inbox-parse"

export type { InquiryKind } from "@/lib/platform-inbox-parse"
export { inquiryRateLimited, parseInquiryInput } from "@/lib/platform-inbox-parse"

function hashIp(ip: string | null | undefined) {
    if (!ip) return null
    return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}

export async function recordPlatformInquiry(input: {
    kind: InquiryKind
    email: string
    name?: string | null
    message?: string | null
    plan?: string | null
    cadence?: string | null
    ip?: string | null
}) {
    const row = await prisma.platformInquiry.create({
        data: {
            kind: input.kind,
            email: input.email,
            name: input.name || null,
            message: input.message || null,
            plan: input.plan || null,
            cadence: input.cadence || null,
            ipHash: hashIp(input.ip),
        },
        select: { id: true },
    })
    return row.id
}

export async function notifyOperator(input: {
    kind: InquiryKind
    email: string
    name?: string | null
    message?: string | null
    plan?: string | null
}) {
    const to = marketingBusiness.supportEmail
    if (!to) return false
    const subject = input.kind === "WAITLIST"
        ? `Introify waitlist: ${input.plan || "paid plans"} — ${input.email}`
        : `Introify contact: ${input.name || input.email}`
    const text = [
        input.kind === "WAITLIST" ? "Paid-plan waitlist signup" : "Contact form",
        `From: ${input.name || "—"} <${input.email}>`,
        input.plan ? `Plan: ${input.plan}` : "",
        input.message ? `\n${input.message}` : "",
    ].filter(Boolean).join("\n")
    return sendEmail({
        to,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
    })
}
