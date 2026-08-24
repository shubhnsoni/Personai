"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import {
    clearMemberCookie,
    createLibraryLink,
    issueLibraryAccess,
    upsertMember,
} from "@/lib/members"
import { sendEmail } from "@/lib/email"

export async function requestLibraryLink(email: string) {
    const member = await prisma.member.findUnique({
        where: { email: email.trim().toLowerCase() },
    })
    if (!member) {
        return { ok: true }
    }
    const headersList = await headers()
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
    const proto = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const url = await issueLibraryAccess(member.id, `${proto}://${host}`)
    await sendEmail({
        to: member.email,
        subject: "Your PersonaLink library",
        html: `<p>Open your library: <a href="${url}">${url}</a></p>`,
        text: `Open your library: ${url}`,
    })
    return { ok: true }
}

export async function logoutLibrary() {
    await clearMemberCookie()
    redirect("/library/login")
}

export async function resendLibraryLink(email: string) {
    const member = await upsertMember(email)
    const headersList = await headers()
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
    const proto = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const token = await createLibraryLink(member.id)
    const url = `${proto}://${host}/library/enter?token=${token}`
    await sendEmail({
        to: member.email,
        subject: "Your PersonaLink library",
        html: `<p>Open your library: <a href="${url}">${url}</a></p>`,
        text: `Open your library: ${url}`,
    })
    return { ok: true }
}
