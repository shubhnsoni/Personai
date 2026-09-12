import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render } from "@testing-library/react"
import { ProfileOrbit } from "@/components/profile-orbit"
import { profileOrbitPose } from "@/lib/profile-orbit"
import { ChatAvatar } from "@/components/chat/chat-avatar"
import { WelcomeOrb } from "@/components/welcome-orb"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"

beforeEach(() => { installMatchMedia({ [REDUCE_MOTION]: true }) })

describe("profile satellite", () => {
    it("completes an upright orbit inside the avatar bounds, passing behind and in front", () => {
        let fronts = 0, backs = 0
        for (let i = 0; i < 120; i++) {
            const pose = profileOrbitPose(i / 120)
            expect(Math.abs(pose.x) + 0.08 * pose.scale).toBeLessThan(0.5)
            expect(Math.abs(pose.y) + 0.08 * pose.scale).toBeLessThan(0.5)
            if (pose.front) fronts++; else backs++
        }
        expect(fronts).toBeGreaterThan(50)
        expect(backs).toBeGreaterThan(50)
        expect(profileOrbitPose(0).x).toBeCloseTo(profileOrbitPose(1).x)
        expect(profileOrbitPose(0).y).toBeCloseTo(profileOrbitPose(1).y)
        const { container } = render(<ProfileOrbit size={168} imageUrl="/portrait.jpg" frozenAt={6}><span>Bot</span></ProfileOrbit>)
        const photo = container.querySelector<HTMLElement>(".profile-orbit-photo")!
        expect(photo.dataset.orbitDepth).toBe("back")
        expect(photo.style.zIndex).toBe("1")
        expect(photo.style.transform).not.toContain("rotate")
    })

    it.each([
        { look: "bloub", theme: "classic" },
        { look: "pixel", theme: "classic" },
        { look: "glass", theme: "classic" },
        { look: "animoji", theme: "classic" },
        { look: "bloub", theme: "retro-lcd" },
        { look: "bloub", theme: "liquid-chrome" },
        { look: "bloub", theme: "planet-azure" },
    ])("adds the same photo orbit to $look / $theme", (props) => {
        const { container } = render(<WelcomeOrb {...props} size={168} still orbitProfile profileImageUrl="/portrait.jpg" />)
        expect(container.querySelector("[data-profile-orbit] img")?.getAttribute("src")).toBe("/portrait.jpg")
    })

    it("uses the bot with its satellite when enabled, including an older IMAGE preference", () => {
        const { container } = render(<ChatAvatar size={36} name="Ada" mode="IMAGE" imageUrl="/portrait.jpg" orbitProfile theme="planet-azure" />)
        expect(container.querySelector("[data-chat-avatar='photo']")).toBeNull()
        expect(container.querySelector("[data-profile-orbit]")).not.toBeNull()
        expect(container.querySelector("[data-bot-theme='planet-azure']")).not.toBeNull()
    })

    it("leaves the bot usable with no picture and no visitor-facing setup prompt", () => {
        const { container } = render(<ChatAvatar size={96} name="Ada" mode="IMAGE" orbitProfile theme="planet-azure" />)
        expect(container.querySelector("[data-profile-orbit]")).toBeNull()
        expect(container.querySelector(".pl-orb-scene")).not.toBeNull()
        expect(container.textContent).toBe("")
    })

    it("removes a failed photo instead of showing a broken image and retries a replacement", () => {
        const { container, rerender } = render(<ProfileOrbit size={120} imageUrl="/missing.jpg"><span>Bot</span></ProfileOrbit>)
        fireEvent.error(container.querySelector("img")!)
        expect(container.querySelector("[data-profile-orbit]")).toBeNull()
        expect(container.textContent).toBe("Bot")
        rerender(<ProfileOrbit size={120} imageUrl="/replacement.jpg"><span>Bot</span></ProfileOrbit>)
        expect(container.querySelector("img")?.getAttribute("src")).toBe("/replacement.jpg")
    })

    it("stops immediately when reduced motion is enabled and cleans up the animation", () => {
        const media = installMatchMedia()
        const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(17)
        const cancel = vi.spyOn(window, "cancelAnimationFrame")
        const { unmount } = render(<ProfileOrbit size={120} imageUrl="/portrait.jpg"><span>Bot</span></ProfileOrbit>)
        expect(request).toHaveBeenCalledTimes(1)
        act(() => media.set(REDUCE_MOTION, true))
        expect(cancel).toHaveBeenCalledWith(17)
        expect(request).toHaveBeenCalledTimes(1)
        unmount()
        expect(media.listenerCount(REDUCE_MOTION)).toBe(0)
    })

    it("keeps its current position when paused or when the speed changes", () => {
        installMatchMedia()
        let frame: FrameRequestCallback = () => undefined
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1 })
        const { container, rerender } = render(<ProfileOrbit size={120} imageUrl="/portrait.jpg"><span>Bot</span></ProfileOrbit>)
        act(() => { frame(1000); frame(1040) })
        const current = container.querySelector<HTMLElement>(".profile-orbit-photo")!.style.transform
        rerender(<ProfileOrbit size={120} imageUrl="/portrait.jpg" still><span>Bot</span></ProfileOrbit>)
        expect(container.querySelector<HTMLElement>(".profile-orbit-photo")!.style.transform).toBe(current)
        rerender(<ProfileOrbit size={120} imageUrl="/portrait.jpg" speed={2}><span>Bot</span></ProfileOrbit>)
        expect(container.querySelector<HTMLElement>(".profile-orbit-photo")!.style.transform).toBe(current)
    })
})
