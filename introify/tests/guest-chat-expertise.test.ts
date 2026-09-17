import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { guestChatExpertise, guestChatHasExpertiseChrome } from "@/lib/guest-chat-expertise"

describe("guest chat expertise chrome", () => {
    it("never puts Knowledge or self-assessments on the main guest chat welcome", () => {
        const chrome = guestChatExpertise({
            introductionCount: 1,
            showcaseCount: 2,
            frameworkCount: 4,
            publicKnowledgeCount: 7,
        })
        expect(chrome.showKnowledge).toBe(false)
        expect(chrome.showFrameworks).toBe(false)
        expect(chrome.showIntroduction).toBe(true)
        expect(chrome.showShowcase).toBe(true)
        expect(guestChatHasExpertiseChrome({
            introductionCount: 0,
            showcaseCount: 0,
            frameworkCount: 3,
            publicKnowledgeCount: 5,
        })).toBe(false)
    })

    it("does not inject a Knowledge or self-assessment pill on the public chat screen", () => {
        const src = readFileSync(path.join(process.cwd(), "src/app/[slug]/public-profile-screen.tsx"), "utf8")
        expect(src).toMatch(/guestChatExpertise/)
        expect(src).not.toMatch(/\/knowledge/)
        expect(src).not.toMatch(/Self-assessments/)
        expect(src).not.toMatch(/publicKnowledgeCount/)
    })

    it("keeps introductions and showcase AIs when those belong on chat", () => {
        expect(guestChatHasExpertiseChrome({
            introductionCount: 1,
            showcaseCount: 0,
            frameworkCount: 0,
            publicKnowledgeCount: 0,
        })).toBe(true)
        expect(guestChatHasExpertiseChrome({
            introductionCount: 0,
            showcaseCount: 1,
            frameworkCount: 9,
            publicKnowledgeCount: 9,
        })).toBe(true)
    })
})
