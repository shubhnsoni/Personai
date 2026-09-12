import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
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
    checkUsername: vi.fn(async (value: string) => ({ ok: true, slug: value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })),
}))

vi.mock("@/components/welcome-orb", () => ({ WelcomeOrb: () => <div data-testid="orb" /> }))

const { OnboardingWizard } = await import("@/components/onboarding/onboarding-wizard")

function start() {
    return render(<OnboardingWizard presets={[]} />)
}

async function nameThenUsername(name = "Suneja Medicos") {
    fireEvent.change(screen.getByPlaceholderText(COPY.name.placeholder), { target: { value: name } })
    fireEvent.click(screen.getByLabelText("Send"))
    expect(screen.getByText(COPY.username.h)).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Send"))
    await waitFor(() => expect(screen.getByText(COPY.who.h)).toBeTruthy())
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

    it("sends the business name as a user bubble then asks for a username", () => {
        start()
        fireEvent.change(screen.getByPlaceholderText(COPY.name.placeholder), { target: { value: "Suneja Medicos" } })
        fireEvent.click(screen.getByLabelText("Send"))
        expect(screen.getByText("Suneja Medicos")).toBeTruthy()
        expect(screen.getByText(COPY.username.h)).toBeTruthy()
        expect(screen.getByDisplayValue("suneja-medicos")).toBeTruthy()
    })

    it("confirms username then asks who", async () => {
        start()
        await nameThenUsername()
        expect(screen.getByText(COPY.who.skip)).toBeTruthy()
    })

    it("skips who and shows kit chips plus a full-width Something else row", async () => {
        start()
        await nameThenUsername()
        fireEvent.click(screen.getByText(COPY.who.skip))
        expect(screen.getByText(COPY.type.h)).toBeTruthy()
        expect(screen.getByText("Medicines & pharmacy")).toBeTruthy()
        expect(screen.getByText("Gold & jewellery wholesale")).toBeTruthy()
        const elseRow = screen.getAllByText(COPY.type.else)[0]
        expect(elseRow.closest("button")?.className).toMatch(/w-full/)
    })

    it("opens Something else with free-type and Optics/Clinic/Salon", async () => {
        start()
        await nameThenUsername("Nia Studio")
        fireEvent.click(screen.getByText(COPY.who.skip))
        fireEvent.click(screen.getAllByText(COPY.type.else)[0])
        expect(screen.getByPlaceholderText(COPY.type.elsePlaceholder)).toBeTruthy()
        expect(screen.getByText("Optics")).toBeTruthy()
        expect(screen.getByText("Clinic")).toBeTruthy()
        expect(screen.getByText("Salon")).toBeTruthy()
    })

    async function goldExtras() {
        await nameThenUsername("City Gold")
        fireEvent.click(screen.getByText(COPY.who.skip))
        fireEvent.click(screen.getByText("Gold & jewellery wholesale"))
        fireEvent.click(screen.getByText(COPY.features.confirm))
        expect(screen.getByText(COPY.extras.goldWholesale.h)).toBeTruthy()
    }

    it("shows a large labeled Gold city picker on extras", async () => {
        start()
        await goldExtras()
        expect(screen.getByText(COPY.extras.cityLabel)).toBeTruthy()
        for (const city of GOLD_CITIES) {
            expect(screen.getByText(city)).toBeTruthy()
        }
        const ranchi = screen.getByText("Ranchi")
        expect(ranchi.tagName).toBe("BUTTON")
        expect(ranchi.className).toMatch(/min-h-12/)
    })

    it("lets you type a city or pick one, then continue without WhatsApp", async () => {
        start()
        await goldExtras()
        const cityBox = screen.getByLabelText(COPY.extras.cityEnter)
        expect(cityBox).toBeTruthy()
        fireEvent.change(cityBox, { target: { value: "Patna" } })
        expect((cityBox as HTMLInputElement).value).toBe("Patna")
        fireEvent.click(screen.getByText("Jamshedpur"))
        expect((screen.getByLabelText(COPY.extras.cityEnter) as HTMLInputElement).value).toBe("Jamshedpur")
        fireEvent.click(screen.getByRole("button", { name: COPY.extras.continue }))
        expect(screen.getByText(COPY.look.h)).toBeTruthy()
    })

    it("shows phone and email on extras instead of a Skip pile", async () => {
        start()
        await goldExtras()
        expect(screen.queryByRole("button", { name: /^Skip$/ })).toBeNull()
        expect(screen.getByLabelText(COPY.extras.phoneLabel)).toBeTruthy()
        expect(screen.getByLabelText(COPY.extras.emailLabel)).toBeTruthy()
        expect(screen.getAllByText(COPY.extras.continue)).toHaveLength(1)
    })

    it("pins the step rail so only the chat column scrolls", async () => {
        start()
        const rail = screen.getByLabelText("Onboarding steps").closest("aside")
        const shell = rail?.parentElement
        expect(shell?.className).toMatch(/\bh-dvh\b/)
        expect(shell?.className).toMatch(/\boverflow-hidden\b/)
        expect(rail?.className).toMatch(/\bh-full\b/)
        expect(screen.getByRole("log").className).toMatch(/\boverflow-y-auto\b/)
    })

    it("lets a free shop customise colour, mood and aura then preview the live page", async () => {
        start()
        await nameThenUsername("Powehi")
        fireEvent.click(screen.getByText(COPY.who.skip))
        fireEvent.click(screen.getAllByText(COPY.type.else)[0])
        fireEvent.click(screen.getByText("Optics"))
        fireEvent.click(screen.getByText(COPY.features.confirm))
        expect(screen.getByText(COPY.look.h)).toBeTruthy()
        expect(screen.getByText("Calm")).toBeTruthy()
        expect(screen.getByText("Pulse")).toBeTruthy()
        expect(screen.getByLabelText("Glow")).toBeTruthy()
        fireEvent.click(screen.getByLabelText("Blob"))
        fireEvent.click(screen.getByLabelText("8-Bit, premium"))
        expect(toast.message).toHaveBeenCalledWith("This is a premium bot")
        fireEvent.click(screen.getByText("Happy"))
        fireEvent.click(screen.getByText(COPY.look.continue))
        expect(screen.getByText(COPY.ready.h)).toBeTruthy()
        expect(screen.getByText("Live page")).toBeTruthy()
        expect(screen.getByText("Save and go to dashboard")).toBeTruthy()
        expect(screen.getByText("Keep modifying")).toBeTruthy()
        fireEvent.click(screen.getByText("Keep modifying"))
        expect(screen.getByText(COPY.look.h)).toBeTruthy()
    })
})
