import { prisma } from "@/lib/prisma"
import { clipUtf8, streamChatWithFailover, type ApiRecipe } from "@/lib/ai-runtime"
import { finishAiUsage, prepareAiUsage } from "@/lib/ai-usage"
import { randomBytes } from "node:crypto"

function operationKey() {
    return `creation-job:${randomBytes(12).toString("hex")}`
}

export async function defineCreationJob(profileId: string, creationId: string, input: { name: string; description?: string; inputHint?: string }) {
    const owned = await prisma.creation.findFirst({ where: { id: creationId, profileId }, select: { id: true } })
    if (!owned) return null
    const name = input.name.trim().slice(0, 120)
    if (name.length < 3) throw new Error("Name the job in a short sentence.")
    return prisma.creationJob.create({
        data: {
            creationId,
            name,
            description: input.description?.trim().slice(0, 500) || null,
            inputHint: input.inputHint?.trim().slice(0, 500) || null,
        },
    })
}

export async function listProfileJobRuns(profileId: string) {
    return prisma.creationJobRun.findMany({
        where: { creation: { profileId } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { creation: { select: { id: true, name: true } }, job: { select: { id: true, name: true } } },
    })
}

export async function getOwnedRun(profileId: string, runId: string) {
    return prisma.creationJobRun.findFirst({
        where: { id: runId, creation: { profileId } },
        include: { creation: { select: { id: true, name: true, slug: true } }, job: true },
    })
}

async function collectAssistantText(recipe: ApiRecipe, messages: { role: "system" | "user"; content: string }[]) {
    const input = {
        model: recipe.model,
        stream: true as const,
        messages: messages.map((message) => ({ ...message, content: clipUtf8(message.content, recipe.inputBudget * 4) })),
        max_completion_tokens: recipe.outputBudget,
    }
    let text = ""
    for await (const chunk of await streamChatWithFailover(input, recipe)) {
        text += chunk.choices[0]?.delta?.content || ""
    }
    return text.trim()
}

export async function runCreationJob(profileId: string, creationId: string, input: { jobId?: string; jobName?: string; prompt: string }) {
    const creation = await prisma.creation.findFirst({
        where: { id: creationId, profileId },
        include: { knowledge: { orderBy: { createdAt: "desc" }, take: 8 } },
    })
    if (!creation) return null
    const prompt = input.prompt.trim()
    if (prompt.length < 3) throw new Error("Describe what this AI should produce.")

    let job = input.jobId
        ? await prisma.creationJob.findFirst({ where: { id: input.jobId, creationId } })
        : null
    if (!job && input.jobName) {
        job = await prisma.creationJob.create({
            data: { creationId, name: input.jobName.trim().slice(0, 120) },
        })
    }

    const run = await prisma.creationJobRun.create({
        data: { creationId, jobId: job?.id, status: "running", input: prompt },
    })

    let reservationId: string | null = null
    try {
        const usage = await prepareAiUsage({
            profileId,
            storedModel: "fast",
            operationKey: operationKey(),
            metadata: { creationId, runId: run.id },
        })
        reservationId = usage.id
        const knowledge = creation.knowledge.map((item) => `${item.title}:\n${item.rawText}`).join("\n\n")
        const system = [
            creation.instructions || `You are ${creation.name}. Produce a concrete deliverable, not only advice.`,
            creation.purpose ? `Purpose: ${creation.purpose}` : "",
            knowledge ? `Creator knowledge:\n${knowledge}` : "",
            "Stay in Read/Create. Return the deliverable as clear text the creator can copy or download.",
        ].filter(Boolean).join("\n\n")
        const output = await collectAssistantText(usage.recipe, [
            { role: "system", content: clipUtf8(system, usage.recipe.inputBudget * 3) },
            { role: "user", content: clipUtf8(prompt, usage.recipe.inputBudget * 2) },
        ])
        await finishAiUsage(usage.id, "CONSUME", { reason: "creation_job_delivered" })
        return prisma.creationJobRun.update({
            where: { id: run.id },
            data: { status: "done", output: output || "(Empty response)", completedAt: new Date() },
        })
    } catch (error) {
        if (reservationId) {
            await finishAiUsage(reservationId, "RELEASE", { reason: "creation_job_failed" }).catch(() => {})
        }
        const message = error instanceof Error ? error.message : "The job could not finish."
        return prisma.creationJobRun.update({
            where: { id: run.id },
            data: { status: "failed", error: message, completedAt: new Date() },
        })
    }
}

export async function chatWithCreation(profileId: string, creationId: string, message: string) {
    const creation = await prisma.creation.findFirst({
        where: { id: creationId, profileId },
        include: { knowledge: { orderBy: { createdAt: "desc" }, take: 8 } },
    })
    if (!creation) return null
    const text = message.trim()
    if (text.length < 1) throw new Error("Write a message.")
    const usage = await prepareAiUsage({
        profileId,
        storedModel: "fast",
        operationKey: operationKey(),
        metadata: { creationId, kind: "creator-chat" },
    })
    const knowledge = creation.knowledge.map((item) => `${item.title}:\n${item.rawText}`).join("\n\n")
    const system = [creation.instructions || `You are ${creation.name}.`, knowledge ? `Knowledge:\n${knowledge}` : ""].filter(Boolean).join("\n\n")
    try {
        const reply = await collectAssistantText(usage.recipe, [
            { role: "system", content: clipUtf8(system, usage.recipe.inputBudget * 3) },
            { role: "user", content: clipUtf8(text, usage.recipe.inputBudget * 2) },
        ])
        await finishAiUsage(usage.id, "CONSUME", { reason: "creation_chat_delivered" })
        return { reply }
    } catch (error) {
        await finishAiUsage(usage.id, "RELEASE", { reason: "creation_chat_failed" }).catch(() => {})
        throw error
    }
}
