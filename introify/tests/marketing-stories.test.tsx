import { describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { PeopleStories } from "@/components/landing/people-stories"

describe("illustrative people stories", () => {
    it("clearly identifies the businesses and portraits as examples rather than customer testimonials", () => {
        render(<PeopleStories />)
        expect(screen.getByText(/Three imagined businesses/)).toBeTruthy()
        expect(screen.getByText(/Illustrative stories and generated portraits—not customer testimonials/)).toBeTruthy()
        const stories = screen.getAllByRole("article")
        expect(stories).toHaveLength(3)
        for (const story of stories) {
            expect(within(story).getByText(/EXAMPLE STORY/)).toBeTruthy()
            expect(within(story).getByRole("img").getAttribute("alt")).toMatch(/^Illustrative portrait/)
        }
    })

    it("opens each native story disclosure independently and offers a truthful create-page next step", () => {
        render(<PeopleStories />)
        const stories = screen.getAllByRole("article")
        for (const story of stories) {
            const disclosure = story.querySelector("details")!
            const summary = within(story).getByText("Inside this example")
            expect(disclosure.open).toBe(false)
            fireEvent.click(summary)
            expect(disclosure.open).toBe(true)
            expect(within(disclosure).getByRole("list").children).toHaveLength(3)
            expect(within(disclosure).getByRole("link").getAttribute("href")).toBe("/sign-up")
            for (const other of stories.filter((item) => item !== story)) {
                expect(other.querySelector("details")!.open).toBe(false)
            }
            fireEvent.click(summary)
            expect(disclosure.open).toBe(false)
        }
    })
})
