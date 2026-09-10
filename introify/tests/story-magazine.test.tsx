import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/font/google", () => ({
    Syne: () => ({ className: "syne" }),
    Fraunces: () => ({ className: "fraunces" }),
}))

const { StoryMagazine } = await import("@/components/profile/story-magazine")

describe("about magazine", () => {
    it("uses the Landor about layout with logo and details, not a photo wall", () => {
        const { container } = render(
            <StoryMagazine
                slug="aura-fitness-ranchi"
                name="Aura Fitness Ranchi"
                headline="Kanke Road floor in Maru Tower"
                bio={"704 Maru Tower, Kanke Road.\nIndependent gym."}
                role="GYM"
                logoUrl="/uploads/aura-fitness-ranchi/logo.png"
                whatsapp="917766005931"
                frames={[]}
                hoursLabel="Open today 6:00–20:00"
                venue={{
                    address: { formatted: "704 Maru Tower, Kanke Road, Ranchi 834008" },
                    phone: { display: "077660 05931", e164: "+917766005931" },
                }}
            />,
        )
        expect(container.querySelector(".about-landor")).toBeTruthy()
        expect(screen.getByText("About us")).toBeTruthy()
        expect(screen.getByAltText("Aura Fitness Ranchi logo")).toBeTruthy()
        expect(screen.getAllByText(/704 Maru Tower/).length).toBeGreaterThan(0)
        expect(container.textContent).not.toMatch(/Step inside/)
        expect(container.querySelector("img[class*='object-cover'][class*='absolute']")).toBeNull()
    })
})
