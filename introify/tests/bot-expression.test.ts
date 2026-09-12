import { describe, expect, it } from "vitest"
import { botExpressionStyle, resolveBotExpression } from "@/lib/bot-expression"
import { BLOUB_EXPRESSIONS } from "@/lib/bloub/catalog"

describe("shared bot expressions", () => {
    it("preserves every saved expression at rest with a distinct visible pose", () => {
        const poses = BLOUB_EXPRESSIONS.map(({ id }) => {
            expect(resolveBotExpression(id)).toBe(id)
            return JSON.stringify(botExpressionStyle(id))
        })
        expect(new Set(poses).size).toBe(BLOUB_EXPRESSIONS.length)
        expect(resolveBotExpression("invalid")).toBe("centre")
    })

    it.each([
        ["greeting", "excite"], ["listening", "attentif"], ["thinking", "confus"],
        ["speaking", "curieux"], ["success", "heureux"], ["error", "triste"], ["react", "heureux"],
    ])("temporarily uses %s while retaining the saved resting expression", (mood, expected) => {
        expect(resolveBotExpression("timide", mood)).toBe(expected)
        expect(resolveBotExpression("timide", "idle")).toBe("timide")
    })
})
