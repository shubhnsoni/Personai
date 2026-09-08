import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import type { HomeStats } from "@/lib/analytics"

vi.mock("next/link", () => ({
    default: function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
        return <a href={href} className={className}>{children}</a>
    },
}))

vi.mock("@/components/dashboard/analytics-charts", () => ({ AnalyticsCharts: () => null }))
vi.mock("@/components/dashboard/studio-pulse", () => ({ StudioPulse: () => null }))

const { HomePulse } = await import("@/components/dashboard/home-pulse")

const stats: HomeStats = {
    visits: 40,
    visits7: 12,
    chats: 8,
    chats30: 8,
    leads: 5,
    leads7: 2,
    bookings: 3,
    upcoming: 1,
    bookingNoun: "Bookings",
    revenueCents: 12000,
    sales: 4,
    series: [],
    funnel: { visits: 40, chats: 8, leads: 5, buys: 4 },
    sources: [],
    unanswered: 0,
}

describe("HomePulse KPIs", () => {
    it("renders a single compact strip like the leads counts", () => {
        const { container } = render(<HomePulse stats={stats} slug="studio" />)
        const strip = container.querySelector(".divide-x")
        expect(strip).toBeTruthy()
        const cells = strip!.querySelectorAll("a")
        expect(cells).toHaveLength(4)
        expect(strip!.textContent).toContain("Visits")
        expect(strip!.textContent).toContain("Chats")
        expect(strip!.textContent).toContain("Leads")
        expect(strip!.textContent).toContain("Bookings")
        expect(cells[0].className).toContain("py-2.5")
        expect(cells[0].className).not.toContain("py-4")
        expect(strip!.className).toContain("studio-panel")
    })
})
