import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AudienceExplorer } from "@/components/landing/audience-explorer"
import { HomeLanding } from "@/components/landing/home-landing"
import { PolicyPage } from "@/components/marketing/policy-page"
import type { PolicyDocument } from "@/lib/marketing-policies"

function expectSelected(tab: HTMLElement) {
    expect(tab.getAttribute("aria-selected")).toBe("true")
    expect(tab.tabIndex).toBe(0)
    const controlled = document.getElementById(tab.getAttribute("aria-controls") || "")
    expect(controlled?.getAttribute("role")).toBe("tabpanel")
    expect(controlled?.getAttribute("aria-labelledby")).toBe(tab.id)
}

describe("marketing audience explorer", () => {
    it("switches the offering and next step when a visitor chooses another audience", () => {
        render(<AudienceExplorer />)
        const creator = screen.getByRole("tab", { name: "Creators" })
        const business = screen.getByRole("tab", { name: "Local businesses" })
        expectSelected(creator)
        for (const tab of screen.getAllByRole("tab")) {
            expect(document.getElementById(tab.getAttribute("aria-controls") || "")?.getAttribute("role")).toBe("tabpanel")
        }
        expect(within(screen.getByRole("tabpanel")).getByText("Digital products, courses and events")).toBeTruthy()

        fireEvent.click(business)
        expectSelected(business)
        expect(creator.getAttribute("aria-selected")).toBe("false")
        expect(creator.tabIndex).toBe(-1)
        const panel = screen.getByRole("tabpanel", { name: "Local businesses" })
        expect(within(panel).getByText("Product catalogs and restaurant menus")).toBeTruthy()
        expect(within(panel).getByRole("link", { name: "Give your business a home" }).getAttribute("href")).toBe("/sign-up")
        expect(within(panel).queryByText("Digital products, courses and events")).toBeNull()
    })

    it("supports arrow navigation, wrapping and Home/End while maintaining keyboard focus", () => {
        render(<AudienceExplorer />)
        const tabs = screen.getAllByRole("tab")
        tabs[0].focus()
        for (const [key, expected] of [["ArrowLeft", 2], ["ArrowRight", 0], ["ArrowRight", 1], ["End", 2], ["Home", 0]] as const) {
            fireEvent.keyDown(document.activeElement!, { key })
            expect(document.activeElement).toBe(tabs[expected])
            expectSelected(tabs[expected])
            expect(tabs.filter(tab => tab.tabIndex === 0)).toHaveLength(1)
        }
        fireEvent.keyDown(tabs[0], { key: "Tab" })
        expectSelected(tabs[0])
    })

    it("keeps accessible IDs unique when two explorers are mounted", () => {
        const { container } = render(<><AudienceExplorer /><AudienceExplorer /></>)
        const ids = Array.from(container.querySelectorAll("[id]")).map(element => element.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const tab of screen.getAllByRole("tab", { selected: true })) expectSelected(tab)
    })
})

describe("marketing FAQ and navigation", () => {
    it("opens and closes the payment FAQ without changing another expanded answer", () => {
        render(<HomeLanding />)
        const paymentSummary = screen.getByText("Can visitors pay or book through my page?").closest("summary")!
        const aiSummary = screen.getByText("Does the page include an AI assistant?").closest("summary")!
        const payment = paymentSummary.closest("details")!
        const ai = aiSummary.closest("details")!
        expect(payment.open).toBe(false)
        fireEvent.click(paymentSummary)
        expect(payment.open).toBe(true)
        expect(within(payment).getByText(/Online card checkout is not currently enabled/)).toBeTruthy()
        fireEvent.click(aiSummary)
        expect(ai.open).toBe(true)
        expect(payment.open).toBe(true)
        expect(within(ai).getByText(/on our roadmap/)).toBeTruthy()
        fireEvent.click(paymentSummary)
        expect(payment.open).toBe(false)
        expect(ai.open).toBe(true)
    })

    it("provides a real main-content skip target and valid homepage section links", () => {
        render(<HomeLanding />)
        expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content")
        expect(screen.getByRole("main").id).toBe("main-content")
        for (const link of screen.getAllByRole("link")) {
            const href = link.getAttribute("href") || ""
            if (href.startsWith("/#")) expect(document.getElementById(href.slice(2))).not.toBeNull()
        }
    })
})

const draftDocument: PolicyDocument = {
    slug: "contact", title: "Contact Introify", kicker: "Contact", description: "Public business details.",
    updatedOn: "8 September 2026", draft: true,
    sections: [{ id: "business", title: "Business details", fields: [
        { label: "Operator name", value: "" },
        { label: "Support email", value: "" },
        { label: "Refund window", value: "" },
    ] }],
}

describe("policy fields awaiting owner details", () => {
    it("keeps missing details empty without creating a fake contact address or refund promise", () => {
        render(<PolicyPage document={draftDocument} />)
        expect(screen.getByText("This page is a draft.", { exact: false })).toBeTruthy()
        for (const label of ["Operator name", "Support email", "Refund window"]) {
            const field = screen.getByText(label).closest("div")!.querySelector("dd")!
            expect(field.querySelector("a")).toBeNull()
            expect(field.textContent).not.toMatch(/@|\d+\s*days?/i)
            expect(field.querySelector(".mk-blank-field")).not.toBeNull()
            expect(within(field).getByText("Not yet provided").classList.contains("sr-only")).toBe(true)
        }
        expect(document.querySelector("a[href^='mailto:']")).toBeNull()
    })

    it("does not keep draft labels after a completed policy is approved", () => {
        render(<PolicyPage document={{ ...draftDocument, draft: false, sections: [] }} />)
        expect(screen.queryByText("Draft for review")).toBeNull()
        expect(screen.queryByText("This page is a draft.", { exact: false })).toBeNull()
    })
})
