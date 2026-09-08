"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { syncUser } from "@/lib/auth-sync"
import { LEAD_STATUSES, leadStatusLabel } from "@/lib/lead-status"
import { parseLeadTags, pushActivity } from "@/lib/lead-meta"

async function ownedLead(leadId: string) {
    const user = await syncUser()
    const profileId = user?.profiles[0]?.id
    if (!profileId) throw new Error("Unauthorized")
    const lead = await prisma.visitorLead.findUnique({ where: { id: leadId } })
    if (!lead || lead.profileId !== profileId) throw new Error("Not found")
    return { profileId, lead }
}

function saveTags(leadId: string, tags: ReturnType<typeof parseLeadTags>) {
    return prisma.visitorLead.update({
        where: { id: leadId },
        data: { tags: JSON.stringify(tags) },
    })
}

export async function updateLeadStatus(leadId: string, status: string) {
    const allowed = LEAD_STATUSES.some((s) => s.id === status)
    if (!allowed) throw new Error("Invalid status")
    const { lead } = await ownedLead(leadId)
    const tags = pushActivity(parseLeadTags(lead.tags), `Moved to ${leadStatusLabel(status)}`, "status")
    await prisma.visitorLead.update({
        where: { id: leadId },
        data: { status, tags: JSON.stringify(tags) },
    })
    revalidatePath("/dashboard/leads")
    revalidatePath("/dashboard/inbox")
}

export async function updateLeadNote(leadId: string, note: string) {
    const { lead } = await ownedLead(leadId)
    let tags = parseLeadTags(lead.tags)
    tags.note = note
    tags = pushActivity(tags, note.trim() ? "Updated note" : "Cleared note", "note")
    await saveTags(leadId, tags)
    revalidatePath("/dashboard/leads")
}

export async function setLeadFollowUp(leadId: string, followUpAt: string | null) {
    const { lead } = await ownedLead(leadId)
    let tags = parseLeadTags(lead.tags)
    tags.followUpAt = followUpAt
    tags = pushActivity(tags, followUpAt ? `Follow up ${followUpAt}` : "Cleared follow-up", "follow")
    await saveTags(leadId, tags)
    revalidatePath("/dashboard/leads")
}

export async function createLead(data: {
    name: string
    email: string
    company?: string
    budgetRange?: string
    note?: string
}) {
    const user = await syncUser()
    const profileId = user?.profiles[0]?.id
    if (!profileId) throw new Error("Unauthorized")
    const email = data.email.trim().toLowerCase()
    if (!data.name.trim() || !email.includes("@")) throw new Error("Name and email required")

    const tags = pushActivity(
        { note: data.note?.trim() || undefined },
        "Lead added",
        "created"
    )

    await prisma.visitorLead.create({
        data: {
            profileId,
            name: data.name.trim(),
            email,
            company: data.company?.trim() || null,
            budgetRange: data.budgetRange?.trim() || null,
            status: "NEW",
            tags: JSON.stringify(tags),
        },
    })
    revalidatePath("/dashboard/leads")
}

export async function deleteLead(leadId: string) {
    await ownedLead(leadId)
    await prisma.visitorLead.delete({ where: { id: leadId } })
    revalidatePath("/dashboard/leads")
}
