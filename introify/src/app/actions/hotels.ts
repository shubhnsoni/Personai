"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { hotelCanOpen, hotelCanWrite, hotelWebhookReady, isHotelRole, parseHotelStaffJson, type HotelDeskSurface, type HotelStaffAssignment } from "@/lib/hotels"
import { resolveKitRole } from "@/lib/role-alias"
import { loadHotelStaffRole } from "@/lib/hotels/desk-access"
import { syncUser } from "@/lib/auth-sync"
import { lookupProfileEntitlement } from "@/lib/billing/entitlements"
import {
    addHotelRooms,
    advanceHotelRequest,
    attachHotelRequestPhoto,
    connectRestaurant,
    connectRestaurantBySlug,
    createHotelStay,
    deleteHotelKnowledgeRow,
    disconnectRestaurant,
    ensureHotelProperty,
    ensurePropertyQr,
    ensureRoomQrs,
    findHotelRoom,
    listLinkedRestaurants,
    markAllHotelNoticesRead,
    markHotelNoticeRead,
    saveHotelKnowledgeRow,
    saveHotelProperty,
    setHotelRoomActive,
} from "@/lib/hotels/store"

async function hotelDesk(surface: HotelDeskSurface, opts?: { write?: boolean }) {
    const permission = opts?.write ? "operations.write" as const : "read" as const
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ permission }))
    if (!isHotelRole(profile.roleTemplate)) throw new Error("This desk is for hotel profiles.")
    const user = await syncUser()
    if (!user) throw new Error("Sign in with a verified email address.")
    const property = await ensureHotelProperty(profile.id, { receptionWhatsapp: profile.whatsapp || undefined, timezone: profile.timezone || undefined })
    const access = user.profileAccess[profile.id]
    const staffRole = await loadHotelStaffRole({
        userId: user.id,
        profileId: profile.id,
        profileUserId: profile.userId,
        workspaceRole: access?.role,
        owner: access?.owner,
        staffJson: property.staffJson,
    })
    if (!hotelCanOpen(staffRole, surface)) throw new Error("This desk is not available for your role.")
    if (opts?.write && !hotelCanWrite(staffRole, surface)) throw new Error("Your desk cannot change this.")
    return { profile, staffRole, property }
}

async function hotelOwner() {
    const { profile } = await hotelDesk("edit", { write: true })
    return profile
}

function touch() {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/requests")
    revalidatePath("/dashboard/rooms")
    revalidatePath("/dashboard/qr")
    revalidatePath("/dashboard/restaurants")
    revalidatePath("/dashboard/knowledge")
    revalidatePath("/dashboard/analytics")
    revalidatePath("/dashboard/group")
    revalidatePath("/dashboard/integrations")
    revalidatePath("/dashboard/team")
}

export async function saveHotelSetup(input: {
    address?: string
    receptionPhone?: string
    receptionWhatsapp?: string
    checkInTime?: string
    checkOutTime?: string
    wifiName?: string
    wifiPassword?: string
    roomCount?: number
    policiesSummary?: string
    amenities?: string[]
    emergencyContact?: string
    services?: string[]
    quietHours?: string
    parkingInfo?: string
    propertyHours?: string
}) {
    const profile = await hotelOwner()
    await saveHotelProperty(profile.id, {
        address: input.address?.trim() || null,
        receptionPhone: input.receptionPhone?.trim() || null,
        receptionWhatsapp: input.receptionWhatsapp?.trim() || null,
        checkInTime: input.checkInTime?.trim() || "14:00",
        checkOutTime: input.checkOutTime?.trim() || "11:00",
        wifiName: input.wifiName?.trim() || null,
        wifiPassword: input.wifiPassword?.trim() || null,
        roomCount: input.roomCount && input.roomCount > 0 ? Math.floor(input.roomCount) : null,
        policiesSummary: input.policiesSummary?.trim() || null,
        amenitiesJson: JSON.stringify(input.amenities || []),
        emergencyContact: input.emergencyContact?.trim() || null,
        servicesJson: JSON.stringify(input.services || []),
        quietHours: input.quietHours?.trim() || null,
        parkingInfo: input.parkingInfo?.trim() || null,
        propertyHours: input.propertyHours?.trim() || null,
    })
    if (input.receptionWhatsapp?.trim()) {
        await prisma.profile.update({
            where: { id: profile.id },
            data: { whatsapp: input.receptionWhatsapp.trim() },
        })
    }
    touch()
}

export async function addHotelRoomNumbers(raw: string, floor?: string, category?: string) {
    const { profile } = await hotelDesk("rooms", { write: true })
    const numbers = raw.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)
    if (!numbers.length) throw new Error("Add at least one room number.")
    const created = await addHotelRooms(profile.id, numbers, { floor, category })
    touch()
    return created.length
}

export async function setHotelRoomLive(roomId: string, isActive: boolean) {
    const { profile } = await hotelDesk("rooms", { write: true })
    await setHotelRoomActive(profile.id, roomId, isActive)
    touch()
}

export async function generateHotelQrs() {
    const { profile } = await hotelDesk("qr", { write: true })
    await ensurePropertyQr(profile.id)
    const rooms = await prisma.hotelRoom.findMany({ where: { profileId: profile.id, isActive: true }, select: { id: true } })
    await ensureRoomQrs(profile.id, rooms.map((row) => row.id))
    touch()
}

export async function listStaffRestaurantChoices() {
    const { profile, actor } = unwrapOwnershipResult(await requireProfileAccess({ permission: "operations.write" }))
    const rows = await prisma.profile.findMany({
        where: { id: { in: actor.profiles.map((item) => item.id) }, NOT: { id: profile.id } },
        select: { id: true, displayName: true, slug: true, roleTemplate: true },
    })
    return rows
        .filter((item) => resolveKitRole(item.roleTemplate) === "RESTAURANT")
        .map((item) => ({ id: item.id, name: item.displayName, slug: item.slug }))
}

export async function connectHotelRestaurant(restaurantProfileId: string) {
    const { profile } = await hotelDesk("restaurants", { write: true })
    await connectRestaurant(profile.id, restaurantProfileId)
    touch()
}

export async function connectHotelRestaurantSlug(slug: string) {
    const { profile } = await hotelDesk("restaurants", { write: true })
    await connectRestaurantBySlug(profile.id, slug)
    touch()
}

export async function removeHotelRestaurant(restaurantProfileId: string) {
    const { profile } = await hotelDesk("restaurants", { write: true })
    await disconnectRestaurant(profile.id, restaurantProfileId)
    touch()
}

export async function setHotelRequestStatus(requestId: string, status: string) {
    const { profile } = await hotelDesk("requests", { write: true })
    await advanceHotelRequest(profile.id, requestId, status)
    touch()
}

export async function createStayLink(roomId: string, guestName?: string) {
    const { profile } = await hotelDesk("rooms", { write: true })
    const room = await findHotelRoom(profile.id, roomId).catch(() => null)
    const byId = await prisma.hotelRoom.findFirst({ where: { id: roomId, profileId: profile.id } })
    const target = byId || room
    if (!target) throw new Error("Unknown room.")
    const stay = await createHotelStay(profile.id, { roomId: target.id, guestName })
    touch()
    return stay.token
}

export async function hotelLinkedRestaurants() {
    const { profile } = await hotelDesk("restaurants")
    return listLinkedRestaurants(profile.id)
}

export async function saveHotelKnowledge(input: {
    id?: string
    bucket: string
    title: string
    body: string
    guestVisible: boolean
}) {
    const { profile } = await hotelDesk("knowledge", { write: true })
    await saveHotelKnowledgeRow(profile.id, {
        id: input.id,
        bucket: input.bucket.trim().toUpperCase(),
        title: input.title.trim().slice(0, 80),
        body: input.body.trim().slice(0, 4000),
        guestVisible: input.guestVisible,
    })
    touch()
}

export async function removeHotelKnowledge(id: string) {
    const { profile } = await hotelDesk("knowledge", { write: true })
    await deleteHotelKnowledgeRow(profile.id, id)
    touch()
}

export async function saveHotelMap(input: {
    mapImageUrl?: string | null
    markers: Array<{ id: string; kind: string; label: string; x: number; y: number; hint: string; aliases?: string[] }>
}) {
    const { profile } = await hotelDesk("knowledge", { write: true })
    await saveHotelProperty(profile.id, {
        mapImageUrl: input.mapImageUrl?.trim() || null,
        mapMarkersJson: JSON.stringify(input.markers.map((row) => ({
            id: row.id,
            kind: row.kind,
            label: row.label,
            x: Math.max(0, Math.min(100, row.x)),
            y: Math.max(0, Math.min(100, row.y)),
            hint: row.hint,
            aliases: row.aliases || [row.label, row.kind],
        }))),
    })
    touch()
}

export async function saveHotelSla(sla: Record<string, number>) {
    const { profile } = await hotelDesk("knowledge", { write: true })
    const clean: Record<string, number> = {}
    for (const [key, value] of Object.entries(sla)) {
        const n = Math.floor(Number(value))
        if (n > 0) clean[key] = n
    }
    await saveHotelProperty(profile.id, { slaJson: JSON.stringify(clean) })
    touch()
}

export async function saveHotelUpsells(upsells: Array<{
    id: string
    kind: "late_checkout" | "spa" | "transport"
    prompt: string
    audience: "during" | "checkout" | "pre_arrival" | "after" | "any"
    frequency: "once" | "daily"
}>) {
    const { profile } = await hotelDesk("knowledge", { write: true })
    await saveHotelProperty(profile.id, {
        upsellsJson: JSON.stringify(upsells.map((row) => ({
            ...row,
            prompt: row.prompt.trim().slice(0, 240),
        }))),
    })
    touch()
}

export async function readHotelNotice(id: string) {
    const { profile } = await hotelDesk("home")
    await markHotelNoticeRead(profile.id, id)
    touch()
}

export async function readAllHotelNotices() {
    const { profile } = await hotelDesk("home")
    await markAllHotelNoticesRead(profile.id)
    touch()
}

export async function addHotelRequestPhoto(requestId: string, photoUrl: string) {
    const { profile } = await hotelDesk("requests", { write: true })
    await attachHotelRequestPhoto(profile.id, requestId, photoUrl)
    touch()
}

export async function saveHotelStaffAssignments(assignments: HotelStaffAssignment[]) {
    const { profile } = await hotelDesk("staff", { write: true })
    await saveHotelProperty(profile.id, { staffJson: JSON.stringify(parseHotelStaffJson(JSON.stringify(assignments))) })
    touch()
    revalidatePath("/dashboard/team")
}

export async function saveHotelGroup(input: { name: string; hotelProfileIds: string[] }) {
    const { profile } = await hotelDesk("group", { write: true })
    const ids = [...new Set(input.hotelProfileIds.filter((id) => typeof id === "string" && id.trim()))].slice(0, 50)
    await saveHotelProperty(profile.id, {
        groupJson: JSON.stringify({ name: input.name.trim().slice(0, 80), hotelProfileIds: ids }),
    })
    touch()
    revalidatePath("/dashboard/group")
}

export async function saveHotelWebhook(url: string) {
    const { profile } = await hotelDesk("integrations", { write: true })
    const trimmed = url.trim()
    if (trimmed) {
        const status = hotelWebhookReady(trimmed)
        if (!status.ready) throw new Error("Use an HTTPS URL without vendor secrets. Leave blank to clear.")
    }
    await saveHotelProperty(profile.id, { webhookUrl: trimmed || null, integrationsJson: JSON.stringify({ pms: "stub", pos: "stub", whatsapp: "stub", webhook: trimmed ? "placeholder" : "stub" }) })
    touch()
    revalidatePath("/dashboard/integrations")
}

export async function saveHotelWhiteLabel(enabled: boolean) {
    const { profile } = await hotelDesk("edit", { write: true })
    const entitled = await lookupProfileEntitlement(profile.id).then((row) => row.features.customBranding).catch(() => false)
    if (enabled && !entitled) throw new Error("White label needs a paid branding plan.")
    await saveHotelProperty(profile.id, { whiteLabel: Boolean(enabled && entitled) })
    let bag: Record<string, unknown> = {}
    try {
        const parsed = JSON.parse(profile.personalityConfig || "{}")
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) bag = parsed
    } catch { /* keep empty */ }
    if (enabled && entitled) bag.hideIntroifyBrand = true
    else delete bag.hideIntroifyBrand
    await prisma.profile.update({
        where: { id: profile.id },
        data: { personalityConfig: JSON.stringify(bag) },
    })
    touch()
}
