import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PlanComparison } from "@/components/billing/plan-comparison"
import { PlanFeatureMatrix } from "@/components/billing/plan-feature-matrix"
import { AiCreditGuide, PricingFaq, PublicCreditPacks } from "@/components/billing/pricing-details"

describe("Introify plan comparison", () => {
    it("keeps the actual tier benefits visible in compact homepage cards", () => {
        render(<PlanComparison compact />)
        const features = (name: string) => within(screen.getByRole("list", { name: `${name} features` }))
        expect(features("Starter").getByText("Remove the Introify footer")).toBeTruthy()
        expect(features("Starter").getByText("Your assistant, your instructions")).toBeTruthy()
        expect(features("Pro").getByText("30-day trends & traffic sources")).toBeTruthy()
        expect(features("Pro").getByText("Conversion funnel overview")).toBeTruthy()
        expect(features("Pro").getByText("Individual team roles")).toBeTruthy()
        expect(features("Business").getByText("3 separate business workspaces")).toBeTruthy()
        expect(features("Scale").getByText("10 separate business workspaces")).toBeTruthy()
        for (const name of ["Business", "Scale"]) expect(features(name).getByText("Assign people by business")).toBeTruthy()
    })

    it("opens the native feature disclosure with five named plan columns and accurate entitlements", () => {
        render(<PlanFeatureMatrix />)
        const summary = screen.getByText("Compare all features").closest("summary")!
        const disclosure = summary.closest("details")!
        expect(disclosure.open).toBe(false)
        fireEvent.click(summary)
        expect(disclosure.open).toBe(true)

        const table = screen.getByRole("table", { name: "Features and limits for the Free, Starter, Pro, Business and Scale plans." })
        expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Feature", "Free", "Starter", "Pro", "Business", "Scale"])
        const expectRow = (label: RegExp, values: string[]) => {
            const row = within(table).getByRole("rowheader", { name: label }).closest("tr")!
            const cells = within(row).getAllByRole("cell")
            expect(cells).toHaveLength(5)
            cells.forEach((cell, index) => expect(within(cell).getByText(values[index], { exact: true })).toBeTruthy())
        }
        expectRow(/^Custom orb & brand styles$/, ["Not included", "Included", "Included", "Included", "Included"])
        expectRow(/^30-day trends, traffic sources & funnel/, ["Not included", "Not included", "Included", "Included", "Included"])
        expectRow(/^Published offerings/, ["10", "100", "500", "1,500", "5,000"])
        expectRow(/^Photoreal 3D generations/, ["1 lifetime trial", "3 / month", "10 / month", "20 / month", "50 / month"])
    })

    it("shows the annual total and monthly equivalent without changing monthly allowances", () => {
        render(<PlanComparison />)
        const starter = screen.getByRole("article", { name: "Starter" })
        expect(within(starter).getByText("$10")).toBeTruthy()
        expect(within(starter).getByText("$10 billed monthly")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /Annual/ }))
        expect(screen.getByRole("button", { name: /Annual/ }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("false")
        expect(within(starter).getByText("$9")).toBeTruthy()
        expect(within(starter).getByText("$108 billed annually")).toBeTruthy()
        expect(within(starter).getByText("500 AI credits")).toBeTruthy()
        expect(within(starter).getByText("3 3D generations")).toBeTruthy()
        expect(within(starter).getByText("Every month, including annual plans")).toBeTruthy()
        expect(within(starter).getByRole("link", { name: "Explore Starter" }).getAttribute("href")).toBe("/dashboard/billing?plan=starter&cadence=yearly")
        const totals = { Pro: "$216 billed annually", Business: "$432 billed annually", Scale: "$1,080 billed annually" }
        for (const [name, total] of Object.entries(totals)) expect(within(screen.getByRole("article", { name })).getByText(total)).toBeTruthy()
    })

    it("keeps the Free trial lifetime-only and gives a real no-card signup destination", () => {
        render(<PlanComparison initialCadence="yearly" />)
        const free = screen.getByRole("article", { name: "Free" })
        expect(within(free).getByText("$0")).toBeTruthy()
        expect(within(free).getByText("1 trial 3D generation")).toBeTruthy()
        expect(within(free).getByText("Once per eligible user, not monthly")).toBeTruthy()
        expect(within(free).getByRole("link", { name: "Start free" }).getAttribute("href")).toBe("/sign-up")
        expect(screen.getByText(/Paid checkout is not available yet/)).toBeTruthy()
    })

    it("requires billing availability and permission before a plan can be selected", () => {
        const choose = vi.fn()
        const view = render(<PlanComparison currentPlanId="free" billingAvailable={false} onChoose={choose} />)
        fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }))
        expect(choose).not.toHaveBeenCalled()
        view.rerender(<PlanComparison currentPlanId="free" billingAvailable canManage={false} onChoose={choose} />)
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Choose Pro" }).disabled).toBe(true)
        view.rerender(<PlanComparison currentPlanId="free" billingAvailable onChoose={choose} />)
        fireEvent.click(screen.getByRole("button", { name: /Annual/ }))
        fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }))
        expect(choose).toHaveBeenCalledExactlyOnceWith("pro", "yearly")
    })

    it("keeps active-plan selection disabled while allowing a different billing cadence", () => {
        const choose = vi.fn()
        render(<PlanComparison currentPlanId="starter" currentCadence="monthly" billingAvailable onChoose={choose} />)
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Current plan" }).disabled).toBe(true)
        fireEvent.click(screen.getByRole("button", { name: /Annual/ }))
        fireEvent.click(screen.getByRole("button", { name: "Choose Starter" }))
        expect(choose).toHaveBeenCalledExactlyOnceWith("starter", "yearly")
    })

    it("keeps standard reply charges, paid pack dependency and planned features explicit", () => {
        render(<><AiCreditGuide /><PublicCreditPacks /><PricingFaq /></>)
        expect(screen.getByText("1 credit")).toBeTruthy()
        expect(screen.getByText("20 credits")).toBeTruthy()
        expect(screen.getByText("40 credits")).toBeTruthy()
        expect(screen.getByText(/Long requests, extra context or paid tools need a higher quote/)).toBeTruthy()
        expect(screen.getByText(/One-time packs add to an active paid plan/)).toBeTruthy()
        expect(screen.getByText(/unused units pause on Free and resume with an active paid plan/)).toBeTruthy()
        expect(screen.getByText("On the roadmap, with no delivery date promised.")).toBeTruthy()
        const faq = screen.getByText("Is every feature and integration available now?").closest("details")!
        fireEvent.click(within(faq).getByText("Is every feature and integration available now?"))
        expect(faq.open).toBe(true)
        expect(within(faq).getByText(/They are not included as currently working capabilities/)).toBeTruthy()
        expect(screen.queryByText(/unlimited models/i)).toBeNull()
    })
})
