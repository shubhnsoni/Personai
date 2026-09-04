import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { COPY, GOLD_CITIES } from "@/lib/onboarding-chat"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("next/link", () => ({
    default: function Link({ href, children }: { href: string; children: React.ReactNode }) {
        return <a href={href}>{children}</a>
    },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))

vi.mock("@clerk/nextjs", () => ({
    useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock("@/app/actions/onboarding", () => ({
    createProfile: vi.fn(),
}))

const { OnboardingWizard } = await import("@/components/onboarding/onboarding-wizard")

function start() {
    return render(<OnboardingWizard presets={[]} />)
}

describe("v4 onboarding chat", () => {
    it("opens on the name beat as a chat, not a form wizard", () => {
        start()
        expect(screen.getByText(COPY.name.h)).toBeTruthy()
        expect(screen.getByText(COPY.name.s)).toBeTruthy()
        expect(screen.queryByText("Who are you?")).toBeNull()
        expect(screen.queryByText("1 / 4")).toBeNull()
        expect(screen.getByLabelText("Send")).toBeTruthy()
    })

    it("sends the business name as a user bubble then asks who", () => {
        start()
        fireEvent.change(screen.getByPlaceholderText(COPY.name.placeholder), { target: { value: "Suneja Medicos" } })
        fireEvent.click(screen.getByLabelText("Send"))
        expect(screen.getByText("Suneja Medicos")).toBeTruthy()
        expect(screen.getByText(COPY.who.h)).toBeTruthy()
        expect(screen.getByText(COPY.who.skip)).toBeTruthy()
    })

    it("skips who and shows kit chips plus a full-width Something else row", () => {
        start()
        fireEvent.change(screen.getByPlaceholderText(COPY.name.placeholder), { target: { value: "Suneja Medicos" } })
        fireEvent.click(screen.getByLabelText("Send"))
        fireEvent.click(screen.getByText(COPY.who.skip))
        expect(screen.getByText(COPY.type.h)).toBeTruthy()
        expect(screen.getByText("Pharmacy")).toBeTruthy()
        expect(screen.getByText("Gold wholesale")).toBeTruthy()
        const elseRow = screen.getAllByText(COPY.type.else)[0]
        expect(elseRow.closest("button")?.className).toMatch(/w-full/)
    })

    it("opens Something else with free-type and Optics/Clinic/Salon", () => {
        start()
        fireEvent.change(screen.getByPlaceholderText(COPY.name.placeholder), { target: { value: "Nia Studio" } })
        fireEvent.click(screen.getByLabelText("Send"))
        fireEvent.click(screen.getByText(COPY.who.skip))
        fireEvent.click(screen.getAllByText(COPY.type.else)[0])
        expect(screen.getByPlaceholderText(COPY.type.elsePlaceholder)).toBeTruthy()
        expect(screen.getByText("Optics")).toBeTruthy()
        expect(screen.getByText("Clinic")).toBeTruthy()
        expect(screen.getByText("Salon")).toBeTruthy()
    })

    it("shows a large labeled Gold city picker on extras", () => {
        start()
        fireEvent.change(screen.getByPlaceholderText(COPY.name.placeholder), { target: { value: "City Gold" } })
        fireEvent.click(screen.getByLabelText("Send"))
        fireEvent.click(screen.getByText(COPY.who.skip))
        fireEvent.click(screen.getByText("Gold wholesale"))
        fireEvent.click(screen.getByText(COPY.extras.continue))
        expect(screen.getByText(COPY.extras.goldWholesale.h)).toBeTruthy()
        expect(screen.getByText(COPY.extras.cityLabel)).toBeTruthy()
        for (const city of GOLD_CITIES) {
            expect(screen.getByText(city)).toBeTruthy()
        }
        const ranchi = screen.getByText("Ranchi")
        expect(ranchi.tagName).toBe("BUTTON")
        expect(ranchi.className).toMatch(/min-h-12/)
    })
})
