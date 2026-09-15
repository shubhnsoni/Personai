import { describe, expect, it } from "vitest"
import { remixPresets, skillDependencyLine, teamEventPlan } from "@/lib/workspace-teams"

describe("Phase 5 teams and skills", () => {
    it("makes skill dependencies explicit", () => {
        expect(skillDependencyLine({ name: "PROD", uses: ["BGFX", "COPY"] })).toMatch(/PROD uses BGFX, COPY/)
    })

    it("plans a restaurant reservation through named specialists", () => {
        expect(teamEventPlan("reservation")).toEqual([
            { skill: "BOOK", job: "Update covers" },
            { skill: "CHEF", job: "Adjust preparation forecast" },
            { skill: "STOK", job: "Update ingredient forecast" },
            { skill: "ROTA", job: "Check staffing" },
        ])
    })

    it("offers remix presets without implying a royalty engine is live", () => {
        const names = remixPresets().map((item) => item.id)
        expect(names).toEqual(["none", "private", "public", "commercial"])
        expect(remixPresets().every((item) => item.royaltyLive === false)).toBe(true)
    })
})
