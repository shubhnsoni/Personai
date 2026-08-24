import { createHash, randomBytes } from "crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { sendPurchaseConfirmation } from "@/lib/email"

export const MEMBER_COOKIE = "pl_member"

export type PurchaseItemType = "product" | "course" | "event" | "community"

export function normalizeEmail(email: string) {
    return email.trim().toLowerCase()
}

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex")
}

export async function upsertMember(email: string, name?: string | null) {
    const normalized = normalizeEmail(email)
    if (!normalized || !normalized.includes("@")) throw new Error("Valid email required")
    return prisma.member.upsert({
        where: { email: normalized },
        create: { email: normalized, name: name?.trim() || null },
        update: {
            name: name?.trim() || undefined,
            lastSeenAt: new Date(),
        },
    })
}

export async function createLibraryLink(memberId: string) {
    const token = randomBytes(32).toString("hex")
    await prisma.libraryLink.create({
        data: {
            memberId,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    })
    return token
}

export async function consumeLibraryLink(token: string) {
    const link = await prisma.libraryLink.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { member: true },
    })
    if (!link || link.usedAt || link.expiresAt < new Date()) return null
    await prisma.libraryLink.update({
        where: { id: link.id },
        data: { usedAt: new Date() },
    })
    return link.member
}

export async function createMemberSession(memberId: string) {
    const token = randomBytes(32).toString("hex")
    await prisma.memberSession.create({
        data: {
            memberId,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    })
    return token
}

export async function setMemberCookie(token: string) {
    const jar = await cookies()
    jar.set(MEMBER_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
    })
}

export async function clearMemberCookie() {
    const jar = await cookies()
    jar.delete(MEMBER_COOKIE)
}

export async function getMemberFromSession() {
    const jar = await cookies()
    const token = jar.get(MEMBER_COOKIE)?.value
    if (!token) return null
    const session = await prisma.memberSession.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { member: true },
    })
    if (!session || session.expiresAt < new Date()) return null
    await prisma.member.update({
        where: { id: session.memberId },
        data: { lastSeenAt: new Date() },
    })
    return session.member
}

export async function issueLibraryAccess(memberId: string, baseUrl: string) {
    const token = await createLibraryLink(memberId)
    return `${baseUrl}/library/enter?token=${token}`
}

export async function fulfillPurchase(input: {
    itemType: PurchaseItemType
    itemId: string
    visitorEmail: string
    visitorName?: string | null
    paymentId?: string | null
    amountCents?: number
    baseUrl: string
}) {
    const email = normalizeEmail(input.visitorEmail)
    const member = await upsertMember(email, input.visitorName)
    const libraryUrl = await issueLibraryAccess(member.id, input.baseUrl)

    switch (input.itemType) {
        case "product": {
            const product = await prisma.digitalProduct.findUnique({
                where: { id: input.itemId },
                include: { profile: true },
            })
            if (!product) throw new Error("Product not found")
            const token = randomBytes(32).toString("hex")
            await prisma.productPurchase.create({
                data: {
                    productId: product.id,
                    memberId: member.id,
                    visitorEmail: email,
                    visitorName: input.visitorName || member.name,
                    paymentId: input.paymentId || null,
                    status: "COMPLETED",
                    downloadToken: token,
                    downloadExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                },
            })
            if ((input.amountCents ?? product.priceCents) > 0) {
                await prisma.payment.create({
                    data: {
                        profileId: product.profileId,
                        amountCents: input.amountCents ?? product.priceCents,
                        currency: "USD",
                        status: "SUCCEEDED",
                        provider: "STRIPE",
                        providerPaymentId: input.paymentId || null,
                    },
                })
            }
            await sendPurchaseConfirmation({
                visitorEmail: email,
                visitorName: input.visitorName || member.name || undefined,
                itemType: "product",
                itemName: product.title,
                priceCents: input.amountCents ?? product.priceCents,
                profileDisplayName: product.profile.displayName,
                downloadUrl: `${input.baseUrl}/api/downloads/${token}`,
                accessUrl: libraryUrl,
            })
            return { member, libraryUrl, profileSlug: product.profile.slug }
        }
        case "course": {
            const course = await prisma.course.findUnique({
                where: { id: input.itemId },
                include: { profile: true },
            })
            if (!course) throw new Error("Course not found")
            const existing = await prisma.courseEnrollment.findFirst({
                where: { courseId: course.id, visitorEmail: email, status: { in: ["ACTIVE", "COMPLETED"] } },
            })
            if (existing) {
                await prisma.courseEnrollment.update({
                    where: { id: existing.id },
                    data: { memberId: member.id, visitorName: input.visitorName || existing.visitorName },
                })
            } else {
                await prisma.courseEnrollment.create({
                    data: {
                        courseId: course.id,
                        memberId: member.id,
                        visitorEmail: email,
                        visitorName: input.visitorName || member.name,
                        paymentId: input.paymentId || null,
                        status: "ACTIVE",
                    },
                })
            }
            if ((input.amountCents ?? course.priceCents) > 0) {
                await prisma.payment.create({
                    data: {
                        profileId: course.profileId,
                        amountCents: input.amountCents ?? course.priceCents,
                        currency: "USD",
                        status: "SUCCEEDED",
                        provider: "STRIPE",
                        providerPaymentId: input.paymentId || null,
                    },
                })
            }
            await sendPurchaseConfirmation({
                visitorEmail: email,
                visitorName: input.visitorName || member.name || undefined,
                itemType: "course",
                itemName: course.title,
                priceCents: input.amountCents ?? course.priceCents,
                profileDisplayName: course.profile.displayName,
                accessUrl: libraryUrl,
            })
            return { member, libraryUrl, profileSlug: course.profile.slug }
        }
        case "event": {
            const event = await prisma.event.findUnique({
                where: { id: input.itemId },
                include: { profile: true },
            })
            if (!event) throw new Error("Event not found")
            await prisma.eventRegistration.create({
                data: {
                    eventId: event.id,
                    memberId: member.id,
                    visitorEmail: email,
                    visitorName: input.visitorName || member.name,
                    paymentId: input.paymentId || null,
                    status: "REGISTERED",
                },
            })
            if ((input.amountCents ?? event.priceCents) > 0) {
                await prisma.payment.create({
                    data: {
                        profileId: event.profileId,
                        amountCents: input.amountCents ?? event.priceCents,
                        currency: "USD",
                        status: "SUCCEEDED",
                        provider: "STRIPE",
                        providerPaymentId: input.paymentId || null,
                    },
                })
            }
            await sendPurchaseConfirmation({
                visitorEmail: email,
                visitorName: input.visitorName || member.name || undefined,
                itemType: "event",
                itemName: event.title,
                priceCents: input.amountCents ?? event.priceCents,
                profileDisplayName: event.profile.displayName,
                accessUrl: libraryUrl,
                eventDetails: {
                    startTime: event.startTime,
                    endTime: event.endTime,
                    meetingLink: event.meetingUrl || undefined,
                },
            })
            return { member, libraryUrl, profileSlug: event.profile.slug }
        }
        case "community": {
            const community = await prisma.community.findUnique({
                where: { id: input.itemId },
                include: { profile: true },
            })
            if (!community) throw new Error("Community not found")
            await prisma.communityMember.create({
                data: {
                    communityId: community.id,
                    memberId: member.id,
                    visitorEmail: email,
                    visitorName: input.visitorName || member.name,
                    paymentId: input.paymentId || null,
                    status: "ACTIVE",
                    subscriptionEndsAt:
                        community.billingCycle === "ONE_TIME"
                            ? null
                            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            })
            if ((input.amountCents ?? community.priceCents) > 0) {
                await prisma.payment.create({
                    data: {
                        profileId: community.profileId,
                        amountCents: input.amountCents ?? community.priceCents,
                        currency: "USD",
                        status: "SUCCEEDED",
                        provider: "STRIPE",
                        providerPaymentId: input.paymentId || null,
                    },
                })
            }
            await sendPurchaseConfirmation({
                visitorEmail: email,
                visitorName: input.visitorName || member.name || undefined,
                itemType: "community",
                itemName: community.name,
                priceCents: input.amountCents ?? community.priceCents,
                profileDisplayName: community.profile.displayName,
                accessUrl: community.inviteLink || libraryUrl,
            })
            return { member, libraryUrl, profileSlug: community.profile.slug }
        }
    }
}
