import { describe, expect, it } from "vitest"
import { attachSkillInput, remixPresets, scheduleCadences, scheduleJobInput, skillDependencyLine, teamEventPlan, teamsEmptyCopy } from "@/lib/workspace-teams"

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

    it("does not tell people to create AIs first when they already have some", () => {
        expect(teamsEmptyCopy(0).body).toMatch(/create ais first/i)
        expect(teamsEmptyCopy(1).body).toMatch(/name a team/i)
        expect(teamsEmptyCopy(1).body).not.toMatch(/create ais first/i)
    })

    it("refuses a skill depending on itself and only allows daily or weekly schedules", () => {
        expect(() => attachSkillInput("c1", "c1")).toThrow(/itself/i)
        expect(attachSkillInput("c1", "c2")).toEqual({ hostId: "c1", usesId: "c2" })
        expect(scheduleCadences()).toEqual(["daily", "weekly"])
        expect(scheduleJobInput({ creationId: "c1", jobId: "j1", cadence: "Daily" })).toEqual({
            creationId: "c1",
            jobId: "j1",
            cadence: "daily",
        })
        expect(() => scheduleJobInput({ creationId: "c1", jobId: "j1", cadence: "hourly" })).toThrow(/daily or weekly/i)
    })
})
