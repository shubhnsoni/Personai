"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import {
    requireOwnedResource,
    unwrapOwnershipResult,
} from "@/lib/security"
import {
    clearMemberCookie,
    createLibraryLink,
    issueLibraryAccess,
    normalizeEmail,
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

async function requireOwnedLibraryRecipient(email: string) {
    const normalized = normalizeEmail(email)
    unwrapOwnershipResult(await requireOwnedResource({
        resourceId: normalized,
        findOwned: ({ resourceId, actor }) => {
            const profileIds = actor.profiles.map((profile) => profile.id)
            const recipient = { equals: resourceId, mode: "insensitive" as const }
            return prisma.profile.findFirst({
                where: {
                    id: { in: profileIds },
                    OR: [
                        { digitalProducts: { some: { purchases: { some: { visitorEmail: recipient } } } } },
                        { courses: { some: { enrollments: { some: { visitorEmail: recipient } } } } },
                        { events: { some: { registrations: { some: { visitorEmail: recipient } } } } },
                        { communities: { some: { members: { some: { visitorEmail: recipient } } } } },
                        { bookings: { some: { visitorEmail: recipient } } },
                        { conversations: { some: { visitorEmail: recipient } } },
                        { leads: { some: { email: recipient } } },
                        { restaurantOrders: { some: { guestEmail: recipient } } },
                    ],
                },
                select: { id: true },
            })
        },
    }))
    return normalized
}

export async function resendLibraryLink(email: string) {
    const normalized = await requireOwnedLibraryRecipient(email)
    const member = await upsertMember(normalized)
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
