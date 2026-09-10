import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/ada",
}))
vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

// Keep the entire ProfileView -> ChatInterface -> ChatAvatar -> WelcomeOrb chain real.
// A renderer-only test missed the public prop forwarding gap in the deployed build.
const { ProfileView } = await import("@/components/profile/profile-view")

const PROFILE = {
    id: "p1",
    slug: "ada",
    displayName: "Ada Lovelace",
    headline: "Mathematician",
    bio: "First programmer.",
    welcomeMessageOverride: null,
    contentDisplayMode: "chat",
    workExperiences: [],
    projects: [],
    serviceOfferings: [],
} as unknown as Parameters<typeof ProfileView>[0]["profile"]

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    installMatchMedia({ [REDUCE_MOTION]: true })
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    localStorage.clear()
    window.history.replaceState({}, "", "/ada")
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("ProfileView - saved Retro LCD appearance", () => {
    it("forwards LCD into the real chat avatar without a legacy accent override or dark intro veil", () => {
        const { container } = render(<ProfileView profile={PROFILE} animationConfig={{ theme: "retro-lcd", look: "glass" }} colors={["#52E8FF"]} />)
        const profile = container.querySelector<HTMLElement>('[data-public-profile-theme="retro-lcd"]')!
        const chat = container.querySelector<HTMLElement>('[data-chat-theme="retro-lcd"]')!
        expect(profile).not.toBeNull()
        expect(chat).not.toBeNull()
        expect(profile.style.getPropertyValue("--pl-aurora")).toBe("")
        expect(chat.style.getPropertyValue("--chat-accent")).toBe("")
        expect(container.querySelector(".pl-intro-veil")).toBeNull()
        expect(container.querySelector(".pl-orb-aura")).toBeNull()
        expect(container.querySelectorAll(".retro-lcd-orb [data-lcd-eye]")).toHaveLength(2)
    })

    it("returns to the classic appearance when the configured bot changes", () => {
        const { container, rerender } = render(<ProfileView profile={PROFILE} animationConfig={{ theme: "retro-lcd" }} colors={["#52E8FF"]} />)
        rerender(<ProfileView profile={PROFILE} animationConfig={{}} colors={["#52E8FF"]} />)
        const chat = container.querySelector<HTMLElement>('[data-chat-theme="classic"]')!
        expect(container.querySelector('[data-public-profile-theme="retro-lcd"]')).toBeNull()
        expect(container.querySelector(".retro-lcd-orb")).toBeNull()
        expect(chat.style.getPropertyValue("--chat-accent")).not.toBe("")
    })

    it("keeps LCD on both the conversation header and assistant message after a visitor sends a question", async () => {
        let finishReply: (() => void) | undefined
        const reply = new Promise<Response>((resolve) => {
            finishReply = () => resolve(new Response('0:"Hello Ada"\n', { headers: { "X-Conversation-Id": "c1" } }))
        })
        vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input) === "/api/chat"
            ? reply
            : Promise.resolve({ ok: true, json: async () => ({}) })))
        const { container } = render(<ProfileView profile={PROFILE} animationConfig={{ theme: "retro-lcd", look: "bloub" }} colors={["#52E8FF"]} />)
        await act(async () => { await Promise.resolve() })
        const input = screen.getByPlaceholderText("Tell me more about...")
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)

        const bots = container.querySelectorAll(".retro-lcd-orb")
        expect(bots).toHaveLength(2)
        expect(Array.from(bots, bot => bot.getAttribute("data-mood"))).toEqual(["thinking", "thinking"])
        expect(container.querySelectorAll(".retro-lcd-orb [data-lcd-eye]")).toHaveLength(4)
        expect(container.querySelector(".pl-orb-aura")).toBeNull()
        expect(container.querySelector(".pl-orb-core")).toBeNull()

        await act(async () => { finishReply?.(); await reply })
        expect(screen.getByText("Hello Ada")).toBeTruthy()
        expect(container.querySelectorAll(".retro-lcd-orb")).toHaveLength(2)
    })
})
