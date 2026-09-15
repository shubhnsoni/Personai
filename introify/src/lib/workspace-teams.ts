export function skillDependencyLine(input: { name: string; uses: string[] }) {
    if (!input.uses.length) return `${input.name} has no skill dependencies.`
    return `${input.name} uses ${input.uses.join(", ")}`
}

export function teamEventPlan(event: string) {
    if (event === "reservation") {
        return [
            { skill: "BOOK", job: "Update covers" },
            { skill: "CHEF", job: "Adjust preparation forecast" },
            { skill: "STOK", job: "Update ingredient forecast" },
            { skill: "ROTA", job: "Check staffing" },
        ]
    }
    return []
}

export function remixPresets() {
    return [
        { id: "none", label: "No remix", royaltyLive: false },
        { id: "private", label: "Private remix", royaltyLive: false },
        { id: "public", label: "Public remix", royaltyLive: false },
        { id: "commercial", label: "Commercial remix", royaltyLive: false },
    ] as const
}

export function teamsEmptyCopy(creationCount: number) {
    if (creationCount === 0) {
        return { title: "No teams yet", body: "Create AIs first, then group them." }
    }
    return { title: "No teams yet", body: "Name a team above and pick the AIs that should work together." }
}

export function attachSkillInput(hostId: string, usesId: string) {
    if (hostId === usesId) throw new Error("An AI cannot depend on itself.")
    return { hostId, usesId }
}

export function scheduleCadences() {
    return ["daily", "weekly"] as const
}

export function scheduleJobInput(input: { creationId: string; jobId: string; cadence: string }) {
    const cadence = input.cadence.trim().toLowerCase()
    if (!scheduleCadences().includes(cadence as "daily" | "weekly")) {
        throw new Error("Use a daily or weekly cadence.")
    }
    return { creationId: input.creationId, jobId: input.jobId, cadence }
}

export function teamTemplates() {
    return [
        { id: "restaurant", name: "Restaurant operations", skills: ["MILO", "BOOK", "STOK", "CHEF", "COST", "ROTA"] },
        { id: "studio", name: "Creator studio", skills: ["ANI", "VECT", "MOCK"] },
        { id: "ecommerce", name: "Ecommerce launch", skills: ["PROD", "COPY", "SEOX", "BGFX"] },
        { id: "podcast", name: "Podcast production", skills: ["CUTR"] },
        { id: "release", name: "Development release", skills: ["PRRV", "SEOX"] },
    ]
}
