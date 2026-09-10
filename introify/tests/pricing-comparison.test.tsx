import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PlanComparison } from "@/components/billing/plan-comparison"
import { PlanFeatureMatrix } from "@/components/billing/plan-feature-matrix"
import { AiCreditGuide, PricingFaq, PublicCreditPacks } from "@/components/billing/pricing-details"

describe("Introify plan comparison", () => {
    it("shows three public plans with Pro recommended and Scale as a contact CTA", () => {
        render(<PlanComparison compact />)
        const features = (name: string) => within(screen.getByRole("list", { name: `${name} features` }))
        expect(screen.getByRole("article", { name: "Free" })).toBeTruthy()
        expect(screen.getByRole("article", { name: "Pro" }).getAttribute("data-featured")).toBe("true")
        expect(within(screen.getByRole("article", { name: "Pro" })).getByText("Most Popular")).toBeTruthy()
        expect(screen.queryByRole("article", { name: "Starter" })).toBeNull()
        expect(screen.queryByRole("article", { name: "Scale" })).toBeNull()
        expect(features("Free").getByText("50 AI credits/month")).toBeTruthy()
        expect(features("Free").getByText("Fast AI")).toBeTruthy()
        expect(features("Pro").getByText("2,000 AI credits/month")).toBeTruthy()
        expect(features("Pro").getByText("Designed for regular AI conversations and content generation.")).toBeTruthy()
        expect(features("Pro").getByText("Fast + Smart + Reasoning AI")).toBeTruthy()
        expect(features("Pro").getByText("3 seats")).toBeTruthy()
        expect(features("Business").getByText("5 businesses")).toBeTruthy()
        expect(features("Business").getByText("7,500 AI credits/month")).toBeTruthy()
        expect(screen.getByRole("link", { name: "Talk to us about Scale" }).getAttribute("href")).toBe("/contact")
        expect(screen.getByText(/Managing more than 5 businesses/)).toBeTruthy()
    })

    it("opens the native feature disclosure with public plan columns and accurate entitlements", () => {
        render(<PlanFeatureMatrix />)
        const summary = screen.getByText("Compare all features").closest("summary")!
        const disclosure = summary.closest("details")!
        expect(disclosure.open).toBe(false)
        fireEvent.click(summary)
        expect(disclosure.open).toBe(true)

        const table = screen.getByRole("table", { name: "Features and limits for the Free, Pro and Business plans." })
        expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Feature", "Free", "Pro", "Business"])
        const expectRow = (label: RegExp, values: string[]) => {
            const row = within(table).getByRole("rowheader", { name: label }).closest("tr")!
            const cells = within(row).getAllByRole("cell")
            expect(cells).toHaveLength(3)
            cells.forEach((cell, index) => expect(within(cell).getByText(values[index], { exact: true })).toBeTruthy())
        }
        expectRow(/^Custom orb & brand styles$/, ["Not included", "Included", "Included"])
        expectRow(/^30-day trends, traffic sources & funnel/, ["Not included", "Included", "Included"])
        expectRow(/^Published offerings/, ["10", "500", "2,000"])
        expectRow(/^Photoreal 3D generations/, ["1 lifetime trial", "10 / month", "30 / month"])
    })

    it("shows the annual equivalent monthly price and two months free without changing monthly allowances", () => {
        render(<PlanComparison />)
        const pro = screen.getByRole("article", { name: "Pro" })
        expect(within(pro).getByText("$19")).toBeTruthy()
        expect(within(pro).getByText("$19 billed monthly")).toBeTruthy()
        expect(screen.getByText("Get 2 months free with annual billing")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /Annual/ }))
        expect(screen.getByRole("button", { name: /Annual/ }).getAttribute("aria-pressed")).toBe("true")
        expect(screen.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("false")
        expect(within(pro).getByText("$15.83")).toBeTruthy()
        expect(within(pro).getByText("$15.83/mo billed annually")).toBeTruthy()
        expect(within(pro).getByText("2,000 AI credits/month")).toBeTruthy()
        expect(within(pro).getByText("10 3D generations")).toBeTruthy()
        expect(within(pro).getByText("Every month, including annual plans")).toBeTruthy()
        expect(within(pro).getByRole("link", { name: "View Pro" }).getAttribute("href")).toBe("/dashboard/billing?plan=pro&cadence=yearly")
        const business = screen.getByRole("article", { name: "Business" })
        expect(within(business).getByText("$40.83")).toBeTruthy()
        expect(within(business).getByText("$40.83/mo billed annually")).toBeTruthy()
        expect(within(business).getByRole("link", { name: "View Business" }).getAttribute("href")).toBe("/dashboard/billing?plan=business&cadence=yearly")
    })

    it("keeps the Free trial lifetime-only and gives a real no-card signup destination", () => {
        render(<PlanComparison initialCadence="yearly" />)
        const free = screen.getByRole("article", { name: "Free" })
        expect(within(free).getByText("$0")).toBeTruthy()
        expect(within(free).getByText("1 trial 3D generation")).toBeTruthy()
        expect(within(free).getByText("Once per eligible user, not monthly")).toBeTruthy()
        expect(within(free).getByRole("link", { name: "Start free" }).getAttribute("href")).toBe("/sign-up")
        expect(screen.getByText(/Paid subscriptions are not open yet/)).toBeTruthy()
        expect(screen.getByText(/Explore the planned Pro and Business plans below/)).toBeTruthy()
    })

    it("requires billing availability and permission before a plan can be selected", () => {
        const choose = vi.fn()
        const view = render(<PlanComparison currentPlanId="free" billingAvailable={false} onChoose={choose} />)
        fireEvent.click(screen.getByRole("button", { name: "View Pro" }))
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
        render(<PlanComparison currentPlanId="pro" currentCadence="monthly" billingAvailable onChoose={choose} />)
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Current plan" }).disabled).toBe(true)
        fireEvent.click(screen.getByRole("button", { name: /Annual/ }))
        fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }))
        expect(choose).toHaveBeenCalledExactlyOnceWith("pro", "yearly")
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
